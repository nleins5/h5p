import { z } from "zod";

const positioningSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  pause: z.boolean()
});

const interactionSchema = z.object({
  id: z.string().optional(),
  time: z.number().min(0),
  type: z.enum([
    "text",
    "multiple-choice",
    "image",
    "link",
    "fill-blank",
    "jump-to-time",
    "bookmark"
  ]),
  content: z.record(z.unknown()),
  positioning: positioningSchema
});

export const generateH5PSchema = z.object({
  youtubeUrl: z.string().url(),
  title: z.string().min(1).max(120),
  interactions: z.array(interactionSchema).default([])
});
