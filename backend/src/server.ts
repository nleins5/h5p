import cors from "cors";
import express from "express";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { H5PGenerator } from "./h5pGenerator.js";
import type { GenerateH5PRequest } from "./types.js";
import { generateH5PSchema } from "./validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT ?? 4000);
const app = express();
const tempRoot = process.env.VERCEL ? "/tmp/h5p-generator" : path.resolve(projectRoot, "temp");
const generator = new H5PGenerator(tempRoot);
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "https://frontend-eight-lemon-78.vercel.app"
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/downloads", express.static(path.resolve(tempRoot, "outputs")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/generate-h5p", async (req, res, next) => {
  const parsed = generateH5PSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      issues: parsed.error.flatten()
    });
    return;
  }

  try {
    const result = await generator.generate(parsed.data as unknown as GenerateH5PRequest);

    if (process.env.VERCEL) {
      res.download(result.filePath, result.fileName, async (error) => {
        await rm(result.filePath, { force: true });
        if (error && !res.headersSent) {
          next(error);
        }
      });
      return;
    }

    const protocol = String(req.get("x-forwarded-proto") ?? req.protocol).split(",")[0];
    res.status(201).json({
      ...result,
      downloadUrl: `${protocol}://${req.get("host")}${result.downloadUrl}`
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Failed to generate H5P package" });
});

app.listen(port, () => {
  console.log(`H5P backend listening on http://localhost:${port}`);
});
