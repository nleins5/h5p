import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
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
  private readonly uploadsRoot: string;

  constructor(
    tempRoot = process.env.VERCEL ? "/tmp/h5p-generator" : path.resolve(projectRoot, "temp"),
    uploadsRoot = process.env.VERCEL ? "/tmp/h5p-uploads" : path.resolve(projectRoot, "uploads")
  ) {
    this.tempRoot = tempRoot;
    this.uploadsRoot = uploadsRoot;
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
      await this.embedAudioFiles(input.interactions, contentDir);

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

  /**
   * Copy uploaded audio or inline audio data into content/audios and rewrite
   * interaction URLs so the generated package is self-contained.
   */
  private async embedAudioFiles(interactions: Interaction[], contentDir: string) {
    const audioDir = path.join(contentDir, "audios");
    let audioDirCreated = false;

    for (const interaction of interactions) {
      const urls = this.extractAudioUrls(interaction);
      for (const urlInfo of urls) {
        const inlineAudio = resolveAudioDataUrl(urlInfo.url);

        if (inlineAudio) {
          if (!audioDirCreated) {
            await mkdir(audioDir, { recursive: true });
            audioDirCreated = true;
          }

          const filename = `${uuidv4()}${inlineAudio.extension}`;
          await writeFile(path.join(audioDir, filename), inlineAudio.buffer);
          urlInfo.rewrite(`audios/${filename}`);
          continue;
        }

        const filename = this.resolveUploadedFile(urlInfo.url);
        if (!filename) continue;

        const sourcePath = path.join(this.uploadsRoot, filename);
        try {
          await access(sourcePath);
        } catch {
          continue;
        }

        if (!audioDirCreated) {
          await mkdir(audioDir, { recursive: true });
          audioDirCreated = true;
        }

        const destPath = path.join(audioDir, filename);
        await copyFile(sourcePath, destPath);

        // Rewrite the URL to the relative path inside the H5P package
        urlInfo.rewrite(`audios/${filename}`);
      }
    }
  }

  private extractAudioUrls(interaction: Interaction): Array<{ url: string; rewrite: (newUrl: string) => void }> {
    const results: Array<{ url: string; rewrite: (newUrl: string) => void }> = [];

    if (interaction.type === "listen-choice") {
      const content = interaction.content as ListenChoiceContent;
      if (content.promptAudioUrl) {
        results.push({
          url: content.promptAudioUrl,
          rewrite: (u) => { content.promptAudioUrl = u; }
        });
      }
      for (const option of content.options) {
        if (option.audioUrl) {
          results.push({
            url: option.audioUrl,
            rewrite: (u) => { option.audioUrl = u; }
          });
        }
      }
    }

    return results;
  }

  /**
   * If the URL points to one of our uploaded files, return just the filename.
   * Handles both full URLs (http://host/uploads/xyz.mp3) and bare filenames.
   */
  private resolveUploadedFile(url: string): string | null {
    // /uploads/filename.mp3 or http://host/uploads/filename.mp3
    const uploadsMatch = url.match(/\/uploads\/([^/?#]+)/);
    if (uploadsMatch) {
      const filename = decodeURIComponent(uploadsMatch[1]);
      return isUploadedAudioFileName(filename) ? filename : null;
    }

    // Bare filename that exists in uploads dir
    if (isUploadedAudioFileName(url)) return url;

    return null;
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

function isUploadedAudioFileName(value: string) {
  return /^[a-f0-9-]+\.(mp3|wav|ogg|m4a|webm|flac)$/i.test(value);
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
