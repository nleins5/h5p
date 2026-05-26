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

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>H5P Backend</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #eef2f6;
        color: #17212f;
        font-family: Arial, Helvetica, sans-serif;
      }

      main {
        width: min(680px, calc(100vw - 32px));
        border: 1px solid #d8dee8;
        border-radius: 8px;
        background: #fff;
        padding: 28px;
        box-shadow: 0 18px 50px rgba(23, 33, 47, 0.11);
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      p {
        margin: 0 0 18px;
        color: #526173;
        line-height: 1.5;
      }

      code {
        display: inline-block;
        border-radius: 6px;
        background: #f7f8fb;
        padding: 4px 7px;
        color: #0f7b6c;
      }

      ul {
        margin: 0;
        padding-left: 20px;
      }

      li {
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>H5P Backend is running</h1>
      <p>This service generates H5P interactive video packages. Use the frontend editor for the visual app.</p>
      <ul>
        <li>Health check: <code>GET /health</code></li>
        <li>Generate package: <code>POST /api/generate-h5p</code></li>
        <li>Frontend: <a href="https://frontend-eight-lemon-78.vercel.app">https://frontend-eight-lemon-78.vercel.app</a></li>
      </ul>
    </main>
  </body>
</html>`);
});

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
