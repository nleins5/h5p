import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";

export type InteractionType =
  | "text"
  | "multiple-choice"
  | "image"
  | "link"
  | "fill-blank"
  | "jump-to-time"
  | "bookmark"
  | "listen-choice"
  | "read-aloud";

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
      { machineName: "H5P.Blanks", majorVersion: 1, minorVersion: 14 },
      { machineName: "H5P.MultiMediaChoice", majorVersion: 0, minorVersion: 3 },
      { machineName: "H5P.Audio", majorVersion: 1, minorVersion: 5 },
      { machineName: "H5P.AudioRecorder", majorVersion: 1, minorVersion: 0 },
      { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
      { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
      { machineName: "H5P.MaterialDesignIcons", majorVersion: 1, minorVersion: 0 },
      { machineName: "H5P.Components", majorVersion: 1, minorVersion: 0 },
      { machineName: "H5P.FontIcons", majorVersion: 1, minorVersion: 0 },
      { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 }
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
    case "listen-choice": {
      const options = normalizeAudioOptions(item.content.options);
      const promptAudioUrl = String(item.content.promptAudioUrl ?? "");
      return {
        ...base,
        action: {
          library: "H5P.MultiMediaChoice 0.3",
          params: {
            media: promptAudioUrl ? { type: createAudioContent(promptAudioUrl, "Prompt audio") } : {},
            question: String(item.content.question ?? ""),
            options: options.map((option, index) => ({
              media: createAudioContent(option.audioUrl, option.label || `Option ${index + 1}`),
              correct: index === Number(item.content.correctIndex ?? 0)
            })),
            behaviour: {
              enableRetry: true,
              enableSolutionsButton: true,
              confirmCheckDialog: false,
              confirmRetryDialog: false,
              singlePoint: true,
              showSolutionsRequiresInput: true,
              questionType: "single",
              aspectRatio: "auto",
              maxAlternativesPerRow: "2",
              passPercentage: 100
            },
            l10n: createMultimediaChoiceL10n()
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Listen and Choose" }
        }
      };
    }
    case "read-aloud":
      return {
        ...base,
        action: {
          library: "H5P.AudioRecorder 1.0",
          params: {
            title: `${String(item.content.prompt ?? "")}\n\n${String(item.content.word ?? "")}`.trim(),
            l10n: createAudioRecorderL10n()
          },
          subContentId: item.id ?? randomUUID(),
          metadata: { title: "Read Aloud" }
        }
      };
    case "text":
    default:
      return createTextAction(base, item, String(item.content.text ?? ""), "Text");
  }
}

function normalizeAudioOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((option) => {
    if (typeof option !== "object" || option === null) {
      return { label: "", audioUrl: "" };
    }

    const record = option as Record<string, unknown>;
    return {
      label: String(record.label ?? ""),
      audioUrl: String(record.audioUrl ?? "")
    };
  });
}

function createAudioContent(audioUrl: string, title: string) {
  return {
    library: "H5P.Audio 1.5",
    params: {
      files: [
        {
          path: audioUrl,
          mime: audioMimeType(audioUrl)
        }
      ],
      playerMode: "minimalistic",
      fitToWrapper: true,
      controls: true,
      contentName: title,
      audioNotSupported: "Your browser does not support this audio"
    },
    subContentId: randomUUID(),
    metadata: { title }
  };
}

function audioMimeType(audioUrl: string) {
  const lowerUrl = audioUrl.toLowerCase();
  if (lowerUrl.includes(".wav")) return "audio/wav";
  if (lowerUrl.includes(".ogg")) return "audio/ogg";
  if (lowerUrl.includes(".m4a")) return "audio/mp4";
  return "audio/mpeg";
}

function createMultimediaChoiceL10n() {
  return {
    checkAnswerButtonText: "Check",
    submitAnswerButtonText: "Submit",
    checkAnswer: "Check the answers.",
    showSolutionButtonText: "Show solution",
    showSolution: "Show the solution.",
    correctAnswer: "Correct answer",
    wrongAnswer: "Wrong answer",
    shouldCheck: "Should have been checked",
    shouldNotCheck: "Should not have been checked",
    noAnswer: "Please answer before viewing the solution",
    retryText: "Retry",
    retry: "Retry the task.",
    result: "You got :num out of :total points",
    confirmCheck: {
      header: "Finish?",
      body: "Are you sure you want to finish?",
      cancelLabel: "Cancel",
      confirmLabel: "Finish"
    },
    confirmRetry: {
      header: "Retry?",
      body: "Are you sure you wish to retry?",
      cancelLabel: "Cancel",
      confirmLabel: "Retry"
    },
    missingAltText: "Alt text missing",
    closeModalText: "Close modal"
  };
}

function createAudioRecorderL10n() {
  return {
    recordAnswer: "Record",
    pause: "Pause",
    continue: "Continue",
    download: "Download",
    done: "Done",
    retry: "Retry",
    microphoneNotSupported: "Microphone not supported. Make sure you are using a browser that allows microphone recording.",
    microphoneInaccessible: "Microphone is not accessible. Make sure that the browser microphone is enabled.",
    insecureNotAllowed: "Access to microphone is not allowed because this page is not served using HTTPS.",
    statusReadyToRecord: "Press a button below to record your answer.",
    statusRecording: "Recording...",
    statusPaused: "Recording paused.",
    statusFinishedRecording: "You have successfully recorded your answer! Listen to the recording below.",
    downloadRecording: "Download this recording or retry.",
    retryDialogHeaderText: "Retry recording?",
    retryDialogBodyText: "By pressing Retry you will lose your current recording.",
    retryDialogConfirmText: "Retry",
    retryDialogCancelText: "Cancel",
    statusCantCreateTheAudioFile: "Can't create the audio file."
  };
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
