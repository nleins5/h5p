# Project Handoff

## Links

- GitHub repository: https://github.com/nleins5/h5p
- Frontend production: https://frontend-eight-lemon-78.vercel.app
- Backend production: https://h5p-backend-five.vercel.app
- Backend health check: https://h5p-backend-five.vercel.app/health

## One-Sentence Summary

H5P Interactive Video Generator lets users build a YouTube-based interactive video, add timed quiz/audio/recording interactions, drag popup positions, and export a `.h5p` package for H5P-compatible platforms.

## Current Feature Set

- YouTube video preview.
- Timeline and current time tracking.
- Timed interaction list.
- Drag-and-drop positioning for interaction popup markers.
- H5P export through backend.
- Audio embedding into generated `.h5p` packages.
- Listen & choose interaction for audio-based multiple-choice activities.
- Read aloud interaction using H5P Audio Recorder.
- Backend health page and health JSON endpoint.

## Architecture

Frontend:

- Next.js App Router.
- React client editor in `frontend/app/page.tsx`.
- `react-player` for YouTube preview.
- Calls backend endpoint from `NEXT_PUBLIC_API_BASE_URL`.

Backend:

- Express + TypeScript.
- `backend/src/server.ts` defines routes and CORS.
- `backend/src/h5pGenerator.ts` builds H5P-compatible package folders and zips them with `adm-zip`.
- `backend/src/validation.ts` validates request payloads with Zod.
- Temporary files are written to `/tmp` on Vercel.

H5P output:

- `h5p.json`
- `content/content.json`
- `content/audios/*` when audio is embedded

## Local Setup

Prerequisites:

- Node.js 20 LTS or newer.
- npm.

Commands:

```bash
npm install
npm run dev
```

Local app:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

Optional env setup:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

## Production Setup

Backend project:

- Root directory: `backend`
- Build command: `npm run build`
- Output/start command: `npm run start`
- Environment variables:
  - `FRONTEND_ORIGIN=https://frontend-eight-lemon-78.vercel.app`

Frontend project:

- Root directory: `frontend`
- Build command: `npm run build`
- Environment variables:
  - `NEXT_PUBLIC_API_BASE_URL=https://h5p-backend-five.vercel.app`

## Demo Data

Video URL:

```text
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

Audio files:

```text
demo-assets/audio/prompt-audio-small.m4a
demo-assets/audio/option-audio-a-small.m4a
demo-assets/audio/option-audio-b-small.m4a
```

## Demo Script

1. Open the frontend URL.
2. Show the YouTube preview and title input.
3. Select `Listen & choose`.
4. Click `Add Interaction`.
5. Upload prompt audio and two option audio files from `demo-assets/audio`.
6. Keep `Correct option` as `Am A`.
7. Drag the interaction marker on top of the video to show popup positioning.
8. Select `Read aloud`.
9. Click `Add Interaction`.
10. Show the `Record` button and explain that learners can record their voice.
11. Click `Generate H5P`.
12. Download the `.h5p` file.
13. Explain that `.h5p` must be uploaded to Lumi/Moodle/WordPress H5P, not opened directly in Finder.

Suggested narration:

```text
This tool converts a YouTube video into an H5P interactive video. I can add timed activities, including listening questions like Duolingo, drag their popup position on the video, add a read-aloud recording prompt, and export a single .h5p file for an LMS.
```

## Verified Status

Last verified locally on 2026-05-27:

- Frontend production URL returns `200`.
- Backend production URL returns `200`.
- Backend health endpoint returns OK.
- TypeScript typecheck passes for backend and frontend.
- Backend can generate `.h5p` with `Listen & choose` and `Read aloud`.
- Generated package contains `h5p.json`, `content/content.json`, and embedded audio files.

Known verification note:

- Codex in-app browser cannot capture browser downloads directly, so file download was verified through backend response and package inspection.

## Known Limitations

- `.h5p` files are package files and need an H5P player/platform.
- The current app is a generator/editor, not a full H5P runtime previewer.
- Audio file upload in the browser is limited to 8 MB per file.
- Vercel serverless storage is temporary; generated files should be downloaded immediately.
- Read-aloud uses H5P Audio Recorder for recording, not automatic speech scoring yet.

## Good Next Steps

1. Add a built-in H5P preview using an H5P player/runtime.
2. Add project save/load so editors can continue later.
3. Add speech scoring for `Read aloud`.
4. Add export validation against a real H5P player in CI.
