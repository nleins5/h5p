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

export interface TextContent {
  text: string;
}

export interface MultipleChoiceContent {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ImageContent {
  url: string;
  alt?: string;
}

export interface LinkContent {
  label: string;
  url: string;
}

export interface FillBlankContent {
  text: string;
}

export interface JumpToTimeContent {
  label: string;
  targetTime: number;
}

export interface BookmarkContent {
  label: string;
}

export interface AudioChoiceOption {
  label: string;
  audioUrl: string;
}

export interface ListenChoiceContent {
  question: string;
  promptAudioUrl?: string;
  options: AudioChoiceOption[];
  correctIndex: number;
}

export interface ReadAloudContent {
  prompt: string;
  word: string;
  acceptedAnswers: string[];
  inputLanguage: string;
}

export interface Interaction {
  id?: string;
  time: number;
  type: InteractionType;
  content:
    | TextContent
    | MultipleChoiceContent
    | ImageContent
    | LinkContent
    | FillBlankContent
    | JumpToTimeContent
    | BookmarkContent
    | ListenChoiceContent
    | ReadAloudContent;
  positioning: Positioning;
}

export interface GenerateH5PRequest {
  youtubeUrl: string;
  title: string;
  interactions: Interaction[];
}
