# H5P Interactive Video Generator

Monorepo for generating H5P interactive video packages from a YouTube URL and timed interactions.

## Structure

- `backend/`: Express + TypeScript API that creates `.h5p` zip packages.
- `frontend/`: Next.js + React editor using `react-player`.
- `temp/`: Backend working directory for generated packages and downloadable files.

## Commands

```bash
npm install
npm run dev
npm run build
```

Backend runs on `http://localhost:4000` by default. Frontend runs on `http://localhost:3000`.
