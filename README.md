# SolveScript

SolveScript is a study studio for Cambridge International AS & A Level paper practice. It supports Paper 1 multiple-choice sessions and full written-paper sessions with PDF annotation, timers, reports, and progress tracking.

## What students can do

- Browse the public Paper 1 library, filter by subject, year, session, and difficulty, and practise as a guest.
- Work in casual mode with immediate answer feedback or timed exam mode with feedback held until submission.
- Annotate PDFs with drawing, highlighting, shapes, text, undo/redo, and clear controls.
- Upload a question paper and marking scheme. Signed-in uploads are parsed and saved; guest uploads remain only for the current browser session.
- Take written papers when signed in, save drafts, compare annotated work with the official scheme, and record a self-mark.

## Local development

Requirements: Node.js 18+ and MongoDB (local or Atlas) for account-backed features. The public libraries have a local fallback for development.

```powershell
# Terminal 1: API
cd server
npm install
Copy-Item .env.example .env
npm run dev

# Terminal 2: client, from the repository root
npm install
npm run dev
```

The client runs at `http://127.0.0.1:5173` and the API at `http://127.0.0.1:5000` by default.

## Configuration and security

Copy [`server/.env.example`](server/.env.example) and supply your own values. Do not commit `.env` files, MongoDB URIs, OAuth secrets, API keys, or JWT secrets.

For production:

- Set distinct `JWT_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 random characters. The server refuses placeholder or short values in production.
- Rotate any credential that has ever been committed or shared outside the deployment secret store.
- Set `CLIENT_URL` to the exact HTTPS client origin and configure the matching Google OAuth callback URL if Google sign-in is enabled.
- Keep uploaded files on trusted storage and enforce HTTPS. Authentication tokens are HTTP-only cookies and are never included in API JSON responses.

## Verification

```powershell
npm run lint
npm run build
node --test server/tests/localPaperLibrary.test.cjs server/tests/ingestCaieWrittenPapers.test.cjs server/tests/writtenPaperSpecs.test.cjs src/pages/Solver/attemptReport.test.js
```

## Stack

React 19, Vite, React Router, Fabric.js, React-PDF, Express, MongoDB/Mongoose, JWT cookies, Multer, and pdf-parse.
