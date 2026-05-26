# H5P Interactive Video Generator

Web app tao file `.h5p` tu YouTube video va cac interaction theo timeline.

Production demo:

- Frontend: https://frontend-eight-lemon-78.vercel.app
- Backend: https://h5p-backend-five.vercel.app
- Backend health check: https://h5p-backend-five.vercel.app/health

## What This Project Does

- Nhap YouTube URL va title.
- Preview video bang `react-player`.
- Them interaction tai tung moc thoi gian.
- Keo tha popup interaction tren video de doi vi tri.
- Ho tro cac loai interaction: Text, Multiple choice, Image, Link, Fill blank, Jump to time, Bookmark, Listen & choose, Read aloud.
- Upload/nhung audio cho bai nghe chon dap an dung.
- Tao file `.h5p` hoan chinh de upload len Lumi, Moodle, WordPress H5P plugin, hoac LMS co ho tro H5P.

Note: macOS Finder khong mo truc tiep file `.h5p`. File nay can upload vao nen tang H5P-compatible.

## Project Structure

```text
backend/              Express + TypeScript API tao file H5P
frontend/             Next.js + React editor UI
demo-assets/audio/    Audio mau nho de test Listen & choose
docs/                 Huong dan handoff, setup, testing
```

## Quick Start

Prerequisites:

- Node.js 20 LTS or newer
- npm

Install dependencies:

```bash
npm install
```

Run backend and frontend together:

```bash
npm run dev
```

Local URLs:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Backend health check: http://localhost:4000/health

Build/typecheck:

```bash
npm run typecheck
npm run build
```

## Environment Variables

Frontend:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Backend:

```bash
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
```

Examples are included in:

- `frontend/.env.example`
- `backend/.env.example`

## Demo Audio

Use these files when testing `Listen & choose`:

- `demo-assets/audio/prompt-audio-small.m4a`
- `demo-assets/audio/option-audio-a-small.m4a`
- `demo-assets/audio/option-audio-b-small.m4a`

They are intentionally tiny so the browser-side 8 MB audio validation passes quickly.

## Testing Flow

1. Open the frontend.
2. Keep the default YouTube URL or paste another YouTube URL.
3. Select `Listen & choose`, then click `Add Interaction`.
4. Upload the three demo audio files into Prompt audio, Option 1, and Option 2.
5. Drag the interaction marker on the video preview to change popup position.
6. Select `Read aloud`, then click `Add Interaction`.
7. Show the `Record` button to demonstrate microphone-based activity.
8. Click `Generate H5P`.
9. Download the generated `.h5p` file.
10. Upload that `.h5p` into Lumi/Moodle/WordPress H5P to inspect the final activity.

For a detailed handoff and demo script, see [docs/HANDOFF.md](docs/HANDOFF.md).

## API Summary

Generate H5P package:

```http
POST /api/generate-h5p
Content-Type: application/json
```

Request shape:

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Interactive Video",
  "interactions": []
}
```

Upload audio:

```http
POST /api/upload-audio
Content-Type: multipart/form-data
```

The deployed backend returns the `.h5p` file directly for generation requests.
