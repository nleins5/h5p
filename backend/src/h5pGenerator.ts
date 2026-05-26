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
  ListenChoiceContent,
  LinkContent,
  MultipleChoiceContent,
  ReadAloudContent,
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

  constructor(tempRoot = process.env.VERCEL ? "/tmp/h5p-generator" : path.resolve(projectRoot, "temp")) {
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
      case "listen-choice": {
        const content = item.content as ListenChoiceContent;
        return {
          ...base,
          action: {
            library: "H5P.MultiMediaChoice 0.3",
            params: {
              media: content.promptAudioUrl
                ? { type: createAudioContent(content.promptAudioUrl, "Prompt audio") }
                : {},
              question: content.question,
              options: content.options.map((option, index) => ({
                media: createAudioContent(option.audioUrl, option.label || `Option ${index + 1}`),
                correct: index === content.correctIndex
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
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Listen and Choose" }
          }
        };
      }
      case "read-aloud": {
        const content = item.content as ReadAloudContent;
        return {
          ...base,
          action: {
            library: "H5P.AudioRecorder 1.0",
            params: {
              title: `${content.prompt}\n\n${content.word}`.trim(),
              l10n: createAudioRecorderL10n()
            },
            subContentId: item.id ?? uuidv4(),
            metadata: { title: "Read Aloud" }
          }
        };
      }
      default:
        throw new Error(`Unsupported interaction type: ${item.type}`);
    }
  }
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
    subContentId: uuidv4(),
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
