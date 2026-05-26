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

The frontend editor calls the Express backend for H5P package generation. Set
`NEXT_PUBLIC_API_BASE_URL` when you want the frontend to use a different backend; otherwise it uses
`http://localhost:4000` in development and the production backend on Vercel.
