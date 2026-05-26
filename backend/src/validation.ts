import { z } from "zod";

const positioningSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  pause: z.boolean()
});

const interactionBaseSchema = z.object({
  id: z.string().optional(),
  time: z.number().min(0),
  positioning: positioningSchema
});

const textContentSchema = z.object({
  text: z.string().min(1)
});

const multipleChoiceContentSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0)
});

const imageContentSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional()
});

const linkContentSchema = z.object({
  label: z.string().min(1),
  url: z.string().url()
});

const fillBlankContentSchema = z.object({
  text: z.string().regex(/\*[^*]+\*/, "Blank text must wrap the correct answer in *asterisks*")
});

const jumpToTimeContentSchema = z.object({
  label: z.string().min(1),
  targetTime: z.number().min(0)
});

const bookmarkContentSchema = z.object({
  label: z.string().min(1)
});

const audioChoiceOptionSchema = z.object({
  label: z.string().default(""),
  audioUrl: z.string().min(1)
});

const listenChoiceContentSchema = z.object({
  question: z.string().min(1),
  promptAudioUrl: z.string().optional(),
  options: z.array(audioChoiceOptionSchema).min(2),
  correctIndex: z.number().int().min(0)
});

const readAloudContentSchema = z.object({
  prompt: z.string().min(1),
  word: z.string().min(1),
  acceptedAnswers: z.array(z.string()).default([]),
  inputLanguage: z.string().default("vi-VN")
});

const interactionSchema = z.discriminatedUnion("type", [
  interactionBaseSchema.extend({
    type: z.literal("text"),
    content: textContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("multiple-choice"),
    content: multipleChoiceContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("image"),
    content: imageContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("link"),
    content: linkContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("fill-blank"),
    content: fillBlankContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("jump-to-time"),
    content: jumpToTimeContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("bookmark"),
    content: bookmarkContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("listen-choice"),
    content: listenChoiceContentSchema
  }),
  interactionBaseSchema.extend({
    type: z.literal("read-aloud"),
    content: readAloudContentSchema
  })
]);

export const generateH5PSchema = z.object({
  youtubeUrl: z.string().url(),
  title: z.string().min(1).max(120),
  interactions: z.array(interactionSchema).default([])
}).superRefine((value, context) => {
  for (const [interactionIndex, interaction] of value.interactions.entries()) {
    if (interaction.type === "multiple-choice") {
      const optionCount = interaction.content.options.length;
      if (interaction.content.correctIndex >= optionCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interactions", interactionIndex, "content", "correctIndex"],
          message: "Correct option is outside the available options"
        });
      }
    }

    if (interaction.type === "listen-choice") {
      const optionCount = interaction.content.options.length;
      if (interaction.content.correctIndex >= optionCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interactions", interactionIndex, "content", "correctIndex"],
          message: "Correct audio option is outside the available options"
        });
      }
    }
  }
});
