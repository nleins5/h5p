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
  const packageInput = cloneInput(input);

  embedAudioDataUrls(packageInput.interactions, zip);
  zip.addFile("h5p.json", Buffer.from(`${JSON.stringify(createManifest(packageInput.title), null, 2)}\n`));
  zip.addFile("content/content.json", Buffer.from(`${JSON.stringify(createContent(packageInput), null, 2)}\n`));

  return zip.toBuffer();
}

function cloneInput(input: GenerateH5PRequest): GenerateH5PRequest {
  return JSON.parse(JSON.stringify(input)) as GenerateH5PRequest;
}

function embedAudioDataUrls(interactions: Interaction[], zip: AdmZip) {
  for (const interaction of interactions) {
    if (interaction.type !== "listen-choice") continue;

    const promptAudioUrl = String(interaction.content.promptAudioUrl ?? "");
    const promptAudio = resolveAudioDataUrl(promptAudioUrl);

    if (promptAudio) {
      const filename = `audios/${randomUUID()}${promptAudio.extension}`;
      zip.addFile(`content/${filename}`, promptAudio.buffer);
      interaction.content.promptAudioUrl = filename;
    }

    const options = normalizeAudioOptions(interaction.content.options);
    interaction.content.options = options.map((option) => {
      const audio = resolveAudioDataUrl(option.audioUrl);
      if (!audio) return option;

      const filename = `audios/${randomUUID()}${audio.extension}`;
      zip.addFile(`content/${filename}`, audio.buffer);
      return { ...option, audioUrl: filename };
    });
  }
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
  if (lowerUrl.startsWith("data:audio/wav")) return "audio/wav";
  if (lowerUrl.startsWith("data:audio/ogg")) return "audio/ogg";
  if (lowerUrl.startsWith("data:audio/mp4") || lowerUrl.startsWith("data:audio/m4a")) return "audio/mp4";
  if (lowerUrl.startsWith("data:audio/webm")) return "audio/webm";
  if (lowerUrl.startsWith("data:audio/flac")) return "audio/flac";
  if (lowerUrl.startsWith("data:audio/mpeg") || lowerUrl.startsWith("data:audio/mp3")) return "audio/mpeg";
  if (lowerUrl.includes(".wav")) return "audio/wav";
  if (lowerUrl.includes(".ogg")) return "audio/ogg";
  if (lowerUrl.includes(".m4a")) return "audio/mp4";
  if (lowerUrl.includes(".webm")) return "audio/webm";
  if (lowerUrl.includes(".flac")) return "audio/flac";
  return "audio/mpeg";
}

function resolveAudioDataUrl(value: string) {
  const match = value.match(/^data:(audio\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  return {
    buffer: Buffer.from(match[2], "base64"),
    extension: audioExtension(mime)
  };
}

function audioExtension(mime: string) {
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return ".m4a";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("flac")) return ".flac";
  return ".mp3";
}

function createMultimediaChoiceL10n() {
  return {
    checkAnswerButtonText: "Kiểm tra",
    submitAnswerButtonText: "Gửi",
    checkAnswer: "Kiểm tra đáp án.",
    showSolutionButtonText: "Xem đáp án",
    showSolution: "Xem đáp án đúng.",
    correctAnswer: "Đáp án đúng",
    wrongAnswer: "Đáp án sai",
    shouldCheck: "Nên được chọn",
    shouldNotCheck: "Không nên được chọn",
    noAnswer: "Vui lòng trả lời trước khi xem đáp án",
    retryText: "Thử lại",
    retry: "Thử lại bài tập.",
    result: "Bạn đạt :num trên :total điểm",
    confirmCheck: {
      header: "Hoàn thành?",
      body: "Bạn có chắc muốn hoàn thành?",
      cancelLabel: "Hủy",
      confirmLabel: "Hoàn thành"
    },
    confirmRetry: {
      header: "Thử lại?",
      body: "Bạn có chắc muốn thử lại?",
      cancelLabel: "Hủy",
      confirmLabel: "Thử lại"
    },
    missingAltText: "Thiếu mô tả hình ảnh",
    closeModalText: "Đóng"
  };
}

function createAudioRecorderL10n() {
  return {
    recordAnswer: "Ghi âm",
    pause: "Tạm dừng",
    continue: "Tiếp tục",
    download: "Tải xuống",
    done: "Hoàn tất",
    retry: "Thử lại",
    microphoneNotSupported: "Trình duyệt không hỗ trợ micro. Hãy dùng trình duyệt cho phép ghi âm.",
    microphoneInaccessible: "Không thể truy cập micro. Hãy bật quyền sử dụng micro trong trình duyệt.",
    insecureNotAllowed: "Không thể sử dụng micro vì trang không dùng HTTPS.",
    statusReadyToRecord: "Nhấn nút bên dưới để ghi âm câu trả lời.",
    statusRecording: "Đang ghi âm...",
    statusPaused: "Đã tạm dừng ghi âm.",
    statusFinishedRecording: "Bạn đã ghi âm thành công! Nghe lại bên dưới.",
    downloadRecording: "Tải bản ghi âm hoặc thử lại.",
    retryDialogHeaderText: "Ghi âm lại?",
    retryDialogBodyText: "Nhấn Thử lại sẽ xóa bản ghi âm hiện tại.",
    retryDialogConfirmText: "Thử lại",
    retryDialogCancelText: "Hủy",
    statusCantCreateTheAudioFile: "Không thể tạo file âm thanh."
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
