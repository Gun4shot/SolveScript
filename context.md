# SolveScript — Project Context

## Product

SolveScript is a study studio for Cambridge International AS & A Level past-paper practice. It has two distinct study flows:

- **MCQ papers**: CAIE Paper 1 practice with immediate-feedback or timed modes, PDF annotation, drafts, reports, and analytics.
- **Subjective papers**: full written-paper sessions with page annotation, cloud drafts, official marking-scheme comparison, self-marking, optional Gemini-assisted review, and paper-version tracking.

The product is intentionally a calm, paper-like study environment rather than a generic dashboard. The root landing page remains separate from the authenticated study studio.

## Design System And Current Navigation

- Product name: **SolveScript**.
- Fonts: Manrope for controls/UI, DM Serif Display for display headings, and DM Mono for metadata.
- Palette: off-white paper surfaces with restrained navy, blue, coral, mint, and yellow accents. Avoid introducing heavy gradients or generic glassmorphism.
- `/` is the landing page. Its header is fully transparent at every width (no backdrop blur, fill, or border), with the existing high-resolution SolveScript character mark, About/Developers anchors, account actions, and **Try as guest** when signed out. Signed-in navigation offers **My studio** instead of Start paper. Below 960px it uses an animated disclosure menu with Escape/outside-click dismissal.
- Landing buttons use navy pill shapes and coral arrow accents, with reduced-motion support. The top gradient strip and “See how it works” link are removed. About explains the two practice flows; Developers credits **Sidant Chaturbedi** as the solo developer. Keep these sections linked from the navbar.
- `AboutStory` is a separate four-chapter scroll story: organised past papers, annotated practice and saved work, optional Gemini review with a student-provided key, and open-source/always-free access. It uses CSS 3D paper/folder layers and generated paper, key, and bird artwork under `public/media/about-*-v1.png`, with a static illustrated layout for reduced motion. Artwork prompts are saved in `public/media/about-artwork-prompts.md`. Preserve the first `Hero3D` sequence's choreography and assets; keep them separate from About.
- Both landing scenes use `src/components/scrollScene.js` to coalesce scroll updates, cache geometry, skip unchanged style values, and pause outside the viewport or in hidden tabs. Animation variables belong on each visual layer rather than the whole section. Hero WebGL rendering stops offscreen and retains its idle pose on return; contact shadows use 256px resolution and one blur pair. About isolates its painted scene and keeps image shadow filters separate from animated transforms. A local draw-counter check dropped offscreen hero draw calls from approximately 3,480 to zero per two seconds; this is a workload measurement, not a guarantee of frame rate on every device.
- Every non-home, non-auth route is wrapped by `StudioShell`. Its sidebar contains the brand link back to `/`, then My desk, MCQ papers, Subjective papers, Paper collections, My progress, and Upload papers.
- The sidebar collapse/expand button lives inside the sidebar and its state is saved per account/device. On small screens the sidebar becomes an overlay menu.
- Solver and written-exam routes use a focused full-width layout rather than showing the standard sidebar.
- Route transitions reset scroll position. Do not reintroduce the removed breadcrumb/top-workspace bar.

## Stack

- **Frontend**: React 19, Vite, React Router, plain CSS, Framer Motion, lucide-react, React Three Fiber/Drei, React-PDF/pdf.js, Fabric.js, Axios, and react-dropzone.
- **Backend**: Express 4, MongoDB/Mongoose, JWT, cookie-parser, Helmet, CORS, express-rate-limit, Joi, Multer, bcryptjs, and pdf-parse.
- **Paper processing**: Python with Poppler (`pdftotext`, `pdftoppm`) and Pillow for MCQ question crops.
- **Runtime**: Node.js 18+ and MongoDB are required for account-backed features. Both public paper libraries have a local-file fallback when MongoDB is unavailable.

## Frontend Routes

| Route | Purpose | Authentication |
| --- | --- | --- |
| `/` | Landing page | No |
| `/login`, `/register` | Password and Google account access; Google first-time users choose a display name | No |
| `/dashboard` | Main desk: streaks, subject entry points, ongoing sessions, focus timer, goal, and companion | Optional, works with guest-local data |
| `/library` | Public MCQ Paper 1 library | No |
| `/solve/library/:paperId` | Seeded/local-library MCQ solver | Guest or account |
| `/solve/:paperId` | Signed-in user-uploaded MCQ solver | Account-backed paper required |
| `/results/:attemptId` | MCQ report; `local-*` IDs are guest-local reports | Account except local IDs |
| `/history` | Saved MCQ attempt history | Yes |
| `/written-library` | Public subjective-paper library | No |
| `/written-library/:paperId` | Subjective-paper setup and mode selection | No; sign-in is required to start |
| `/written/attempt/:attemptId` | Subjective-paper annotation and exam workspace | Yes |
| `/written/results/:attemptId` | Annotated-paper, marking-scheme, self-mark, and AI-review workspace | Yes |
| `/written-progress` | Paper collections, paper versions, and selected final-grade versions | Yes |
| `/analytics` | Progress and subject trends | Optional, based on available study data |
| `/settings` | Companion, daily goal, motion, and tour preferences | Optional/local |
| `/upload` | Upload a question paper and marking scheme | Account for persistence; guest upload is session-only |

## Authentication, Security, And Sessions

- Accounts support password login and Google OAuth authorization-code flow. A new Google user is prompted for a display name before entering the studio.
- Authentication is cookie based. Access and refresh JWTs are **HTTP-only** and never returned in API JSON or exposed to browser JavaScript.
- The default access-token lifetime is **30 minutes** (`JWT_EXPIRE`); the renewable refresh-session lifetime is **30 days** (`JWT_REFRESH_EXPIRE`). Cookie expiration is calculated from each signed JWT rather than hard-coded separately.
- Axios retries one interrupted request through `POST /api/auth/refresh` when a protected endpoint reports an expired or refreshable access session. If a browser has already removed an expired access cookie but the refresh cookie remains, the backend identifies it as refreshable instead of treating it as a logout.
- The client’s initial account check waits up to eight seconds and only clears the current user on a confirmed `401`; short server/network failures should not look like a logout.
- The server uses Helmet, credentialed CORS restricted to configured/local client origins, auth rate limiting, Joi validation, protected account-mutation routes, and production validation for distinct non-placeholder JWT secrets.
- `server/.env` is ignored. Never add secrets, database URIs, OAuth credentials, JWT values, or student Gemini keys to this file, Git, shared docs, logs, or chat. Rotate any credential that was shared outside the intended secret store.
- Changing session configuration requires a backend restart. Users should sign in once after a session-policy change to receive an updated refresh cookie.

## MCQ Library And Solver

- The Paper 1 library covers CAIE Physics 9702, Chemistry 9701, Biology 9700, and Economics 9708, grouped by subject, year, and exam session (March, May/June, October/November). Maths and Business are intentionally not part of this catalog.
- Library papers expose verified answers, discounted questions, component-grade thresholds, and a derived difficulty (`hard`, `balanced`, `accessible`, or `unknown`).
- The MCQ library supports free-text search plus subject, year, session, and difficulty filtering. The selected filters and expanded subject/year folder state persist under an account-scoped local-storage key, so leaving and returning to the library restores the same view.
- Browse structure is subject → year → session → paper. A variant is paper metadata, not a folder level.
- The solver supports **Casual practice** (instant feedback) and **Timed exam** (feedback held until completion). It also supports a custom timed duration where offered.
- PDF workspaces provide cropped-question and full-paper modes, annotation tools, flags, answer selection, review filters, undo/redo, and a resizable answer panel on desktop.
- Paper navigation follows document-viewer behavior: scroll pans, pinch or Ctrl/Meta + wheel zooms the transformed paper surface, and PDF page rendering stays at stable scale. Do not reintroduce per-wheel PDF re-render zoom.
- Guest progress, drafts, and finished guest reports remain on that browser/device. Signed-in MCQ drafts and completed attempts are stored through the API; local data is account-scoped where possible.
- A submitted MCQ report includes score, component thresholds/grade, time, accuracy, skipped/wrong question breakdown, and reviewable question details.

## Subjective-Paper Library, Exam, And Collections

- The subjective library serves verified CAIE written-paper assets and metadata. It falls back to local assets if MongoDB is unavailable.
- Its browsing model is subject/syllabus → year → session → paper. Search and filters include session, variant, and difficulty; variant is deliberately a filter, not a folder.
- Subjective-library filters, selected folders, expanded subject/year state, and filter-panel state persist per account/device. This prevents the library from resetting after a user visits another page.
- A signed-in student chooses a casual, official timed, or custom-length session before starting. Draft `WrittenAttempt` records are created immediately, so work exists even before any mark is entered.
- The written exam uses React-PDF and a Fabric annotation canvas per page. Draft annotations save to IndexedDB as a local safety layer and to `WrittenAttemptPage` records with revision checks for conflict detection. The page, elapsed time, flags, and other session state are saved through the API.
- A student can use **Save & exit**, return to an ongoing session, or delete an unwanted ongoing session from **On your desk**. Deletion asks for confirmation and removes the corresponding server draft/local marker.
- Submitting a written paper preserves the annotated paper even when no self-mark is entered. The result page allows a later “Save review” with notes only, then a mark can be added whenever the student is ready.
- The review desk displays the annotated question paper and official marking scheme side by side on desktop, with independent previous/next controls at the top of each document. Mobile uses a document switcher.
- Each repeat of the same written paper is a separate attempt/version. Paper collections show version history, allow deletion of past attempts, and let the student choose which marked version counts toward progress.
- If a paper component has exactly one marked version, it is selected automatically for final-grade aggregation. If multiple marked versions exist, only the explicitly selected one counts. A version must have a self-mark or AI score before it can be selected.
- Optional Gemini review is explicitly consented to. The student enters a Gemini API key for a single request; the key is not stored. The feature sends prepared annotated-page images and the marking scheme for an estimate only, is rate limited to five requests per hour, and must never be presented as an official grade.

## Dashboard, Analytics, And Local Study State

- The dashboard includes a Three.js desk scene, companion characters, a first-visit tour, a monthly streak/calendar, subject folders, daily goal, resumable work, and a 25-minute focus timer.
- Studio preferences, selected companion, motion preference, goal, tour completion, sidebar state, focus timer, and some guest/offline study data are local-storage values scoped with `accountKey(user)`.
- Finished MCQ data from local and account-backed attempts is combined for dashboard and analytics displays. It is not a full cloud sync of guest data.
- “On your desk” merges written drafts, cloud MCQ drafts, and compatible local MCQ drafts. A completed/submitted attempt no longer belongs in this ongoing list.
- Respect `prefers-reduced-motion`; it overrides decorative motion preference.

## Backend API

All paths are prefixed with `/api`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/profile`, `POST /auth/refresh` |
| User MCQ papers | `POST /papers/upload`, `GET /papers`, `GET /papers/:id`, `PUT /papers/:id/answers`, `GET /papers/:id/pdf/:type`, `GET /papers/:id/crops`, `GET /papers/:id/crops/:question/image`, `DELETE /papers/:id` |
| MCQ attempts | `POST /attempts`, `GET /attempts`, `GET /attempts/:id`, `GET /attempts/stats`, `GET /attempts/drafts`, `GET /attempts/drafts/all`, `PUT /attempts/drafts`, `DELETE /attempts/drafts/:id`, `PUT /attempts/:id/annotations` |
| Public MCQ library | `GET /library`, `GET /library/:id`, `GET /library/:id/pdf/:type`, `GET /library/:id/crops`, `GET /library/:id/crops/:question/image` |
| Public written library | `GET /written-library`, `GET /written-library/folders`, `GET /written-library/:id`, `GET /written-library/:id/pdf/:type` |
| Written attempts | `POST /written-attempts`, `GET /written-attempts`, `GET /written-attempts/progress`, `GET /written-attempts/:id`, `PATCH /written-attempts/:id`, `DELETE /written-attempts/:id`, `PUT /written-attempts/:id/pages/:pageNumber`, `POST /written-attempts/:id/ai-review` |

Public library endpoints do not require a user. User uploads, attempts, drafts, written attempts, and AI review require an authenticated account.

## Data Models And Asset Storage

- `User`: password or Google identity, name, settings, and profile-completion state.
- `Paper`: signed-in user-uploaded MCQ paper and parsed answer key.
- `PaperLibrary`: seeded CAIE MCQ metadata, assets, answer key, crop/threshold metadata, and readiness status.
- `Attempt`: account-backed MCQ completed attempts and drafts, including answers, annotations, timing, and report figures.
- `WrittenPaperLibrary`: structured-paper metadata and asset references (question, mark scheme, optional insert/formula booklet).
- `WrittenAttempt`: an immutable paper snapshot plus session state, self-mark, optional AI review, completion status, and `countsTowardProgress`.
- `WrittenAttemptPage`: one versioned annotation payload per written-attempt page.
- Local assets and caches are under `server/storage/`, which is gitignored. MCQ source PDFs are under `server/storage/papers/caie/...`; crop caches are under `server/storage/question-crops/...`; grade-threshold PDFs sit beside their matching local papers.
- Written-paper assets can be served from local storage or redirected from the configured public remote archive.

## Ingestion, Parsing, And Tests

- `server/scripts/ingestCaieMcqPapers.js` ingests CAIE Paper 1 catalog data.
- `server/scripts/ingestCaieWrittenPapers.js` ingests written papers. `server/config/writtenPaperSpecs.js` defines expected components/timings/marks.
- `server/scripts/ingestCaieGradeThresholds.js` downloads and parses CAIE grade thresholds; use `--update-db` to backfill database records when connected.
- `server/scripts/backfillPaperOneThresholds.js` and `server/scripts/backfillWrittenPaperDifficulty.js` update existing catalog metadata.
- `server/scripts/experiment_crop_questions.py` lazily creates MCQ crops. It sanitizes invalid XML control characters from `pdftotext -bbox` before parsing.
- Existing automated checks: `server/tests/localPaperLibrary.test.cjs`, `server/tests/ingestCaieWrittenPapers.test.cjs`, `server/tests/writtenPaperSpecs.test.cjs`, and `src/pages/Solver/attemptReport.test.js`.

## Environment Configuration

- Root `.env` contains browser-exposed Vite configuration such as `VITE_API_URL` only. Never put secrets there.
- `server/.env` contains private server configuration: `PORT`, `NODE_ENV`, `CLIENT_URL`, `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`, optional Google OAuth values, and optional archive configuration.
- `server/server.js` loads root `.env` first, then `server/.env` with override. This order is intentional.
- In production, use HTTPS, a precise `CLIENT_URL`, matching Google callback URL, and distinct random JWT secrets of at least 32 characters.

## Deployment preparation (12 October 2026)

- Live frontend: `https://solvescript.onrender.com` (`srv-db6acjg473hc73doogo0`); live free Docker API in Singapore: `https://solvescript-api.onrender.com` (`srv-db6acq7avr4c73ao5rfg`). The user confirmed Render workspace `My Workspace` (`tea-d1i9h2ali9vc73flu3l0`). Services were created directly, so `render.yaml` is a configuration reference, not an attached Blueprint. Dashboard rewrites proxy `/api/*` before the SPA fallback. `DEPLOYMENT.md` records remaining setup and checks.
- `Dockerfile` includes Node 22, Python, Pillow and Poppler. Local secrets, uploads, and storage are excluded from the Docker build. The real Render Linux build succeeded, and production generated all 40 crops for a sample MCQ paper at 150 DPI.
- The frontend defaults to same-origin `/api`; the static host must proxy that path before its SPA fallback. The homepage renders during the initial authentication check so backend sleep does not block it.
- `npm run build` also runs `scripts/seo.mjs`. Set `SITE_URL` to the production HTTPS origin (or use Render's `RENDER_EXTERNAL_URL`) for canonical tags, website schema and sitemap generation. Private studio routes set `noindex`; API responses are private/no-store/noindex.
- The public HF archive now includes 731 MCQ PDF assets under `mcq/caie`. `paperFileStore` restores missing MCQ files on demand using `HF_DATASET_REPO` and `MCQ_HF_PREFIX`, with original-source fallback. No bulk PDF download happens during folder browsing.
- Set `UPLOAD_STORAGE=gridfs` on ephemeral hosts to store new private uploads in MongoDB. The existing owner checks remain required before retrieving files. Private files must never be added to the public HF archive. There were zero existing user-uploaded paper records at deployment audit, so no upload migration was needed.
- The free deployment config caps each uploaded PDF at 10 MB; match `MAX_UPLOAD_MB` and frontend `VITE_MAX_UPLOAD_MB`. Atlas's total free storage budget includes these files and annotations. Crop generation is deduplicated and serialized, with deployment DPI 150.
- `/api/live` checks the process; `/api/health` checks database readiness. Set `TRUST_PROXY_HOPS` only for the actual reverse-proxy topology. Render generates distinct JWT secrets; Google OAuth needs the final frontend proxy callback URL in both Render and Google configuration.
- Storage verification: `node server/scripts/checkDeploymentStorage.cjs` tests recovery of one disposable GridFS PDF after its disk copies are removed, then cleans up that fixture.
- Search Console (13 October 2026): verified URL-prefix property for the live frontend, sitemap status Success with one discovered page, and homepage URL Inspection confirms "URL is on Google / Page is indexed". Public verification meta tag remains in `index.html`.
- Production registration, secure cookie login, owner-only private GridFS upload/download/deletion, MCQ download, and a 40-question crop job passed. Test accounts and uploads were cleaned up. Frontend deployment is `ab9b029`; backend deployment is `4d8b4bf`; automatic deploys remain off.
- UptimeRobot monitor `804253716` was created by the user for `https://solvescript-api.onrender.com/api/health`; dashboard confirmed Up and a 5-minute interval on 13 October 2026. No alert contacts are attached. The user registered `https://solvescript.onrender.com/api/auth/google/callback` in Google Cloud, and live Google login now reaches the account chooser without the old redirect mismatch. Full account consent/sign-in was not completed by the agent. See `DEPLOYMENT.md` for status and limits.

## Run Locally

Requirements: Node.js 18+ and, for account-backed work, local MongoDB or MongoDB Atlas access.

```powershell
# Terminal 1 — backend
cd server
npm install
Copy-Item .env.example .env   # only if server/.env does not already exist
npm run dev

# Terminal 2 — frontend, from the repository root
npm install
npm run dev
```

- Frontend default: `http://127.0.0.1:5173`
- Backend default: `http://127.0.0.1:5000`
- The existing Vite proxy supports `VITE_API_URL=/api` during local development.

## Verification Commands

```powershell
# Frontend lint and production bundle
npm run lint
npm run build

# Landing scene lifecycle and scroll scheduling
node --test src/components/scrollScene.test.js

# Focused data/report tests
node --test server/tests/localPaperLibrary.test.cjs server/tests/ingestCaieWrittenPapers.test.cjs server/tests/writtenPaperSpecs.test.cjs src/pages/Solver/attemptReport.test.js
```

On Windows, stop a running build/preview process before rebuilding into the default `dist/` directory; it can otherwise lock `dist/assets`.

## Important Files

- `src/App.jsx` — route map, auth gating, shell selection.
- `src/components/Header.jsx` and `src/components/Header.css` — landing-page header; preserve the current correct brand mark and guest action.
- `src/components/studio/StudioShell.jsx` and `src/components/studio/studyData.js` — studio navigation, preferences, persistence keys, and tour.
- `src/pages/Library/LibraryPage.jsx` — MCQ folder browser and retained view state.
- `src/pages/Solver/SolverPage.jsx` and `src/pages/Solver/attemptReport.js` — MCQ workflow and report calculation.
- `src/pages/WrittenLibrary/` — subjective library and setup flow.
- `src/pages/WrittenExam/WrittenExamPage.jsx` — annotation, autosave, timer, and written-session state.
- `src/pages/WrittenResults/WrittenResultsPage.jsx` — self-mark, version selection, PDF comparison, and optional AI review.
- `src/pages/WrittenProgress/WrittenProgressPage.jsx` — grouped collections and version management.
- `src/context/AuthContext.jsx` and `src/services/api.js` — session restoration and refresh-retry behavior.
- `server/controllers/authController.js` and `server/middleware/auth.js` — cookie policy, OAuth, token refresh, and protected-route handling.
- `server/controllers/writtenAttemptController.js` — subjective attempt lifecycle, progress selection, page concurrency, and AI-review guardrails.
- `server/services/localPaperLibrary.js` and `server/services/localWrittenPaperLibrary.js` — library fallbacks.

## Regression Guards

- Do not remove the original landing header or the signed-out **Try as guest** action without an explicit product decision.
- Do not return JWTs in JSON or move them into localStorage/sessionStorage.
- Do not shorten cookie lifetime independently of its signed token, or omit the refreshable-expiry signal for a missing access cookie with a valid refresh cookie.
- Do not make subjective drafts depend on entering a mark; work must remain recoverable before marking.
- Do not replace the subject → year → session folder hierarchy with a variant folder hierarchy.
- Do not reset library folder/filter state merely because the user navigates to another studio route.
- Do not move written-result pagination back below the document; page navigation belongs at the top of the comparison panels.
- Do not store Gemini keys or represent AI feedback as an official grade.
