import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";

export type InteractionType =
  | "text"
  | "multiple-choice"
  | "image"
  | "link"
  | "fill-blank"
  | "jump-to-time"
  | "bookmark";

export interface Positioning {
  x: number;
  y: number;
  width: number;
  height: number;
  pause: boolean;
}

export interface Interaction {
  id?: string;
  time: number;
  type: InteractionType;
  content: Record<string, unknown>;
  positioning: Positioning;
}

export interface GenerateH5PRequest {
  youtubeUrl: string;
  title: string;
  interactions: Interaction[];
}

export function createH5PBuffer(input: GenerateH5PRequest) {
  const zip = new AdmZip();

  zip.addFile("h5p.json", Buffer.from(`${JSON.stringify(createManifest(input.title), null, 2)}\n`));
  zip.addFile("content/content.json", Buffer.from(`${JSON.stringify(createContent(input), null, 2)}\n`));

  return zip.toBuffer();
}

function createManifest(title: string) {
  return {
    title,
    language: "en",
    mainLibrary: "H5P.InteractiveVideo",
    embedTypes: ["div"],
    license: "U",
    preloadedDependencies: [
      { machineName: "H5P.InteractiveVideo", majorVersion: 1, minorVersion: 26 },
      { machineName: "H5P.Text", majorVersion: 1, minorVersion: 1 },
      { machineName: "H5P.MultiChoice", majorVersion: 1, minorVersion: 16 },
      { machineName: "H5P.Image", majorVersion: 1, minorVersion: 1 },
      { machineName: "H5P.Link", majorVersion: 1, minorVersion: 3 },
      { machineName: "H5P.Blanks", majorVersion: 1, minorVersion: 14 }
    ]
  };
}

function createContent(input: GenerateH5PRequest) {
  const interactions = input.interactions
    .slice()
    .sort((a, b) => a.time - b.time)
    .map(createAction);

  return {
    interactiveVideo: {
      video: {
        startScreenOptions: {
          title: input.title,
          hideStartTitle: false
        },
        files: [
          {
            path: input.youtubeUrl,
            mime: "video/YouTube"
          }
        ],
        tracks: []
      },
      assets: {
        interactions,
        bookmarks: input.interactions
          .filter((item) => item.type === "bookmark")
          .map((item) => ({
            time: item.time,
            label: String(item.content.label ?? "Bookmark")
          }))
      },
      summary: {
        task: {
          text: "Summary",
          summary: []
        },
        displayAt: 3
      }
    }
  };
}

function createAction(item: Interaction) {
  const base = {
    x: item.positioning.x,
    y: item.positioning.y,
    width: item.positioning.width,
    height: item.positioning.height,
    duration: {
      from: item.time,
      to: item.time + 6
    },
    pause: item.positioning.pause,
    displayType: "button",
    buttonOnMobile: true,
    adaptivity: {}
  };

  switch (item.type) {
    case "multiple-choice": {
      const options = Array.isArray(item.content.options) ? item.content.options : [];
      const correctIndex = Number(item.content.correctIndex ?? 0);
      return {
        ...base,
        action: {
          library: "H5P.MultiChoice 1.16",
          params: {
            question: String(item.content.question ?? ""),
            answers: options.map((text, index) => ({
              text: String(text),
              correct: index === correctIndex
            })),
            behaviour: {
              enableRetry: true,
              enableSolutionsButton: true,
              singlePoint: true,
              randomAnswers: false
            }
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Multiple Choice" }
        }
      };
    }
    case "image":
      return {
        ...base,
        action: {
          library: "H5P.Image 1.1",
          params: {
            file: { path: String(item.content.url ?? ""), mime: "image/*" },
            alt: String(item.content.alt ?? "")
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Image" }
        }
      };
    case "link":
      return {
        ...base,
        action: {
          library: "H5P.Link 1.3",
          params: {
            title: String(item.content.label ?? "Open link"),
            url: String(item.content.url ?? "")
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Link" }
        }
      };
    case "fill-blank":
      return {
        ...base,
        action: {
          library: "H5P.Blanks 1.14",
          params: {
            questions: [{ text: String(item.content.text ?? "") }],
            behaviour: {
              enableRetry: true,
              enableSolutionsButton: true,
              autoCheck: false,
              caseSensitive: false
            }
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Fill in the Blanks" }
        }
      };
    case "jump-to-time":
      return {
        ...base,
        action: {
          library: "H5P.Link 1.3",
          params: {
            title: String(item.content.label ?? "Jump"),
            url: `#h5p-jump-${Number(item.content.targetTime ?? 0)}`
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Jump to Time" }
        },
        adaptivity: {
          seekTo: Number(item.content.targetTime ?? 0)
        }
      };
    case "bookmark":
      return createTextAction(base, item, String(item.content.label ?? "Bookmark"), "Bookmark");
    case "text":
    default:
      return createTextAction(base, item, String(item.content.text ?? ""), "Text");
  }
}

function createTextAction(base: Record<string, unknown>, item: Interaction, text: string, title: string) {
  return {
    ...base,
    action: {
      library: "H5P.Text 1.1",
      params: { text },
      subContentId: item.id ?? randomUUID(),
      metadata: { title }
    }
  };
}

export function h5pFileName(title: string) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "interactive-video"}.h5p`;
}
