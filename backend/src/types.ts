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
    | BookmarkContent;
  positioning: Positioning;
}

export interface GenerateH5PRequest {
  youtubeUrl: string;
  title: string;
  interactions: Interaction[];
}
