import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BookmarkContent,
  FillBlankContent,
  GenerateH5PRequest,
  ImageContent,
  Interaction,
  JumpToTimeContent,
  LinkContent,
  MultipleChoiceContent,
  TextContent
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export interface GeneratedPackage {
  id: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
}

export class H5PGenerator {
  private readonly tempRoot: string;

  constructor(tempRoot = path.resolve(projectRoot, "temp")) {
    this.tempRoot = tempRoot;
  }

  async generate(input: GenerateH5PRequest): Promise<GeneratedPackage> {
    const id = uuidv4();
    const workDir = path.join(this.tempRoot, id);
    const packageDir = path.join(workDir, "package");
    const contentDir = path.join(packageDir, "content");
    const outputDir = path.join(this.tempRoot, "outputs");
    const safeTitle = slugify(input.title);
    const fileName = `${safeTitle || "interactive-video"}.h5p`;
    const filePath = path.join(outputDir, `${id}-${fileName}`);

    await mkdir(contentDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    try {
      await writeJson(path.join(packageDir, "h5p.json"), this.createManifest(input.title));
      await writeJson(path.join(contentDir, "content.json"), this.createContent(input));

      const zip = new AdmZip();
      zip.addLocalFolder(packageDir);
      zip.writeZip(filePath);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }

    return {
      id,
      fileName,
      filePath,
      downloadUrl: `/downloads/${id}-${fileName}`
    };
  }

  private createManifest(title: string) {
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

  private createContent(input: GenerateH5PRequest) {
    const interactions = input.interactions
      .slice()
      .sort((a, b) => a.time - b.time)
      .map((item) => this.createAction(item));

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
              label: (item.content as BookmarkContent).label
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

  createAction(item: Interaction) {
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
      case "text": {
        const content = item.content as TextContent;
        return {
          ...base,
          action: {
            library: "H5P.Text 1.1",
            params: { text: content.text },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Text" }
          }
        };
      }
      case "multiple-choice": {
        const content = item.content as MultipleChoiceContent;
        return {
          ...base,
          action: {
            library: "H5P.MultiChoice 1.16",
            params: {
              question: content.question,
              answers: content.options.map((text, index) => ({
                text,
                correct: index === content.correctIndex
              })),
              behaviour: {
                enableRetry: true,
                enableSolutionsButton: true,
                singlePoint: true,
                randomAnswers: false
              }
            },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Multiple Choice" }
          }
        };
      }
      case "image": {
        const content = item.content as ImageContent;
        return {
          ...base,
          action: {
            library: "H5P.Image 1.1",
            params: {
              file: { path: content.url, mime: "image/*" },
              alt: content.alt ?? ""
            },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Image" }
          }
        };
      }
      case "link": {
        const content = item.content as LinkContent;
        return {
          ...base,
          action: {
            library: "H5P.Link 1.3",
            params: {
              title: content.label,
              url: content.url
            },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Link" }
          }
        };
      }
      case "fill-blank": {
        const content = item.content as FillBlankContent;
        return {
          ...base,
          action: {
            library: "H5P.Blanks 1.14",
            params: {
              questions: [{ text: content.text }],
              behaviour: {
                enableRetry: true,
                enableSolutionsButton: true,
                autoCheck: false,
                caseSensitive: false
              }
            },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Fill in the Blanks" }
          }
        };
      }
      case "jump-to-time": {
        const content = item.content as JumpToTimeContent;
        return {
          ...base,
          action: {
            library: "H5P.Link 1.3",
            params: {
              title: content.label,
              url: `#h5p-jump-${content.targetTime}`
            },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Jump to Time" }
          },
          adaptivity: {
            seekTo: content.targetTime
          }
        };
      }
      case "bookmark": {
        const content = item.content as BookmarkContent;
        return {
          ...base,
          action: {
            library: "H5P.Text 1.1",
            params: { text: content.label },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Bookmark" }
          }
        };
      }
      default:
        throw new Error(`Unsupported interaction type: ${item.type}`);
    }
  }
}

function uuidv4() {
  return randomUUID();
}

function writeJson(filePath: string, value: unknown) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
