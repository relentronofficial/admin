# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Contains

Three distinct things live here:

1. **`build_spec.js`** — a Node.js script that generates a `.docx` specification document for the platform (the spec *generator*, not the platform itself).
2. **`app/`** — the actual Psychometric Assessment Platform implementation: Express backend + vanilla HTML/JS frontend for the user-facing app.
3. **`app/admin-web/`** — the **single, centralized admin application** — a Next.js frontend (React/TypeScript, Tailwind v4). The legacy vanilla admin UI (`app/frontend/admin/`) has been retired; do not recreate it. admin-web talks to the same Express API over CORS (see `ADMIN_WEB_URL` below) rather than being served statically by Express. It has its own `CLAUDE.md`/`AGENTS.md` — **read `app/admin-web/AGENTS.md` before editing code there**: it's on a bleeding-edge Next.js canary with breaking API changes vs. training data, and that file points to `node_modules/next/dist/docs/` for the current APIs.

---

## Spec Generator (`build_spec.js`)

```bash
npm install docx          # root-level dependency
node build_spec.js        # writes Psychometric_Assessment_Platform_Spec_v2.docx
```

The output path is hardcoded near the bottom of the file (the `build()` function). When running locally, update it to a writable path.

### Architecture of `build_spec.js`

Three layers:

**Primitive helpers (top ~330 lines):** `p()`, `txt()`, `h1()`–`h4()`, `body()`, `note()`, `warn()`, `critical()`, `bullets()`, `numbered()` wrap `docx` library primitives.

**Table helpers:** each returns a styled `Table` — `kv()`, `apiTable()`, `fieldTable()`, `dbTable()`, `btnTable()`, `genTable()`.

**Part functions (`part1()`–`part15()`):** each returns an array of `docx` block elements for one spec section. `build()` at the bottom assembles all parts into a single document.

**Key constraints:**
- Column widths are in DXA (1 inch = 1440 DXA; A4 with 1080 DXA margins = 9360 DXA total).
- `note()` / `warn()` / `critical()` are single-cell tables — they cannot contain nested block elements.
- Table cell `children` must be arrays of `Paragraph` or `Table`, never raw strings.
- The three list styles (`bullets`, `subbullets`, `numbers`) are defined once in the `numbering` config inside `build()`; all list items reference them by name.

---

## App (`app/`)

### Setup

```bash
cd app
npm install
cp .env.example .env      # fill in MONGO_URI, JWT_SECRET, GMAIL_USER, GMAIL_PASS
npm run seed              # seeds admin account, question types, 40 questions, answer options
npm run seed:dummy        # additionally seeds dummy users/results, for local dashboard testing
npm run seed:matrix       # seeds dummy BusinessMatrixCell rows, for local matrix-admin testing
npm run dev               # development with nodemon (port 5000)
npm start                 # production
npm test                  # jest --runInBand, against a real MongoDB (see Testing below)
```

To run a single test file: `npx jest tests/adminAuth.test.js --runInBand`.

### Testing

Tests live in `app/tests/` and run against a **real MongoDB**, not mocks — `globalSetup.js`/`globalTeardown.js` spin up a connection and `dbConnect.js` provides it to specs; `tests/setupEnv.js` loads `.env.test` first. The only thing mocked is outbound email (`tests/mocks/emailSender.js`, aliased over the real `utils/emailSender` via `jest.config.js`'s `moduleNameMapper`) so tests don't send real OTP mail. CI (`.github/workflows/ci-cd.yml`, `test-backend` job) runs `npm test` in `app/` against a `mongo:7` service container on every push/PR to `main` — see "CI/CD" under Deployment below for the full pipeline.

### Architecture

**Single-server design:** Express serves both the REST API (`/api/v1/...`) and the user-facing frontend as static files from `frontend/`. The frontend is plain HTML + vanilla JS — no framework, no bundler. There is one lightweight, optional build step (`cd app/frontend && npm run build`): it compiles Tailwind (`src/tailwind.css` → `assets/css/tailwind.css --minify`) and runs `build-env.js` to write `assets/js/env.js` from the `TBT_API_BASE` env var. Both outputs are committed, so the app runs without ever building; you only rebuild after editing Tailwind sources or when pointing a standalone deploy at a cross-origin API. The admin app (`app/admin-web/`) is a separate Next.js app, not served by this Express process — see below. Old links to the retired vanilla admin (`/admin/*`) 302-redirect to `ADMIN_WEB_URL`.

**Backend structure:**

```
backend/
  server.js               # thin entry point — connectDB() then app.listen()
  app.js                  # the real Express app — middleware, CORS, rate limiters,
                          #   lazy serverless DB connect, routes, static serving of frontend/
  config/db.js            # Mongoose connection
  routes/                 # 9 route files
    adminAuth.js          # POST /api/v1/admin/login, /logout, /change-password; GET /profile
    adminCRUD.js          # CRUD for shared-ids, question-types, questions, answer-options
    adminDashboard.js     # GET stats, results list, export (PDF/CSV), email; retest-request queue
                          #   (list/get/approve/reject)
    adminBusinessMatrix.js # CRUD for BusinessMatrixCell (rowTypeId x colTypeId -> business + rating)
    adminQuestionSets.js  # CRUD for QuestionSet (a set's questionIds array order IS its question order)
    adminTts.js           # neural-voice admin: GET/PUT /admin/tts/settings, GET /tts/status,
                          #   POST /tts/questions/:id/generate, GET .../:id/preview, DELETE .../:id
                          #   — plus a parallel set for the spoken EXPLANATION audio
                          #   (generate-explanation / preview-explanation / :id/explanation)
    adminNotifications.js # GET /notifications, GET /notifications/unread-count,
                          #   POST /notifications/:id/read, POST /notifications/read-all
    userAuth.js           # POST /api/v1/user/register, /verify-otp, /login, etc.
    assessment.js         # GET /questions, POST /start, /submit, GET /result,
                          #   POST /retest/request, GET /retest/my-request
  controllers/            # one controller per route file
  models/                 # Mongoose schemas: Admin, User, SharedUserID, QuestionType,
                          #   Question, AnswerOption, AssessmentSession, UserAnswer, Result,
                          #   BusinessMatrixCell, Setting, QuestionSet, QuestionAudio,
                          #   ExplanationAudio, Notification, RetestRequest
                          #   (OTPs are stored as fields directly on Admin/User, not a separate model)
  middleware/
    adminAuth.js          # JWT verification for admin routes
    userAuth.js           # JWT verification for user routes
    validate.js           # express-validator result checker
    errorHandler.js       # global error handler
  utils/
    otpGenerator.js       # generates 6-digit OTP
    emailSender.js        # Nodemailer (Gmail)
    evaluationEngine.js   # per-questionType answer scoring — the ONLY place scoring rules live
    scoreCalculator.js    # aggregates evaluationEngine output into category + dimension results
    businessRecommendationEngine.js # rule-based business suggestions, driven by dimension percentages
    exportHelper.js       # PDF (pdfkit) and CSV (json2csv) export
    businessMatrixSample.js # sample BusinessMatrixCell rows for the "Load sample data" admin button
    ttsSettings.js        # reads/normalizes the `tts_config` Setting (voice/speed/on-off)
    edgeTts.js            # Microsoft Edge neural-TTS client (msedge-tts) — used offline by generateQuestionAudio.js and the admin TTS endpoint
    tanglish.js            # rule-based Tanglish (romanized Tamil) -> Tamil-script transliterator,
                          #   used server-side before generating neural explanation audio so a Tamil
                          #   voice reads it correctly. Kept byte-for-byte in sync with a copy in
                          #   frontend/user/assessment.html (no module system to share it in-browser)
    notifier.js            # best-effort `notify()` — creates a Notification, swallows all errors
                          #   (a failed notification must never break submit/retest-request)
    escapeRegExp.js         # escapes regex metachars before interpolating user input into `new RegExp()`
  scripts/
    seed.js                # main seeder — admin account, question types, questions, answer options
    seedData.js            # static seed data referenced by seed.js
    seedDummyData.js       # optional extra dummy users/results for local dashboard testing
    seedBusinessMatrixDummy.js # optional dummy BusinessMatrixCell rows for local matrix-admin testing
    seedEmotionalVerbal.js # additive seed: real graded questions for the Emotional Intelligence and
                          #   Verbal Ability dimensions (previously EI rode on one SITUATIONAL option,
                          #   Verbal Ability had none)
    migratePhase1QuestionTypes.js # one-time backfill: sets dimension/questionType/marks on pre-existing
                          #   Questions (maps each legacy QuestionType.name to its canonical dimension)
    migrateQuestionSets.js # one-time: bundles all active questions into a "Default Set", assigns it to
                          #   every access code, backfills in-progress sessions (idempotent). Run:
                          #   `node backend/scripts/migrateQuestionSets.js`
    migrateQuestionLanguage.js # one-time, idempotent: backfills Question.language ('en'|'ta') for
                          #   pre-existing questions without touching text/answers/marks/audio
    migrateZeroScoreTopCategory.js # one-time backfill for legacy zero-score Results whose
                          #   `highestCategory` wrongly listed every tied category; dry-run by
                          #   default, pass `--apply` to write
    generateQuestionAudio.js # generates free neural-TTS mp3 per active question (Microsoft Edge
                          #   voices via utils/edgeTts.js) and caches it in QuestionAudio. Idempotent
                          #   (skips unchanged text; --force re-does all). Run with the target DB's
                          #   MONGO_URI — offline only; the deployed server never calls the TTS endpoint.
```

**Frontend structure:**

```
frontend/
  index.html  # the LOGIN page itself (not a redirect stub) — this is what `/` serves; there is no
              #   separate login.html. An already-authenticated visitor is bounced past it only
              #   after its token is confirmed valid server-side (trust-but-verify), never on
              #   stored-token presence alone.
  user/       # 6 HTML pages: index (access-code screen), register, otp-register, welcome,
              #   assessment, result
  src/tailwind.css  # Tailwind source — compiled to assets/css/tailwind.css by `npm run build`
  build-env.js      # writes assets/js/env.js (window.TBT_API_BASE) from the TBT_API_BASE env var
  assets/js/  # env.js (build output), api.js (fetch wrapper — reads `window.TBT_API_BASE` for the API origin, see Deployment), timer.js, charts.js (Chart.js), validator.js
  assets/css/ # Tailwind build output (tailwind.css)
              # (there is no admin/ subfolder — the admin UI lives entirely in app/admin-web/)
  vercel.json # pretty-URL rewrites for the standalone user-web static deploy (see below) — the
              #   only place these paths are mapped to real files
```

**Pretty URLs:** the app navigates with clean paths (`/`, `/register`, `/verify-otp`, `/assessment-code`, `/instructions`, `/assessment`, `/result`) rather than `/user/*.html` — both `frontend/index.html`'s own script and `assets/js/api.js` do `location.replace('/assessment-code')` etc. directly. These are resolved by **`frontend/vercel.json`**'s `rewrites` (e.g. `/assessment-code` → `/user/index.html`, `/instructions` → `/user/welcome.html`, `/result` → `/user/result.html`), which only takes effect on the standalone **user-web** Vercel static deploy. The Express backend (`backend/app.js`) has no equivalent rewrite logic — its own static serving + catch-all just falls back to `frontend/user/index.html` for any unmatched path — so exercising the full pretty-URL candidate flow locally means running `frontend/` through a server that honors its `vercel.json` (e.g. `vercel dev` from `app/frontend`), not just `npm run dev` in `app/`.

### Authentication Flow

Admin and user auth are **not** symmetric:

- **Admin** (`routes/adminAuth.js` / `controllers/adminAuthController.js`): direct `email + password` → JWT. No OTP step. The admin document tracks a single `activeToken`, which is cleared on logout or password change (effectively single-session).
- **User** (`routes/userAuth.js` / `controllers/userAuthController.js`): OTP-over-email — POST registration → server emails a 6-digit OTP → client POSTs OTP to `/verify-otp` → JWT issued. `/resend-otp` is rate-limited to one request per 60 seconds server-side.
- **Candidate flow — Login → Access Code → Question Set**: the entry point is `frontend/index.html` itself (served at `/`, pretty-URL-mapped — see Pretty URLs above), which **is** the login page. After a successful login the candidate lands on `/assessment-code` (`user/index.html`), which is the **post-login access-code screen** — it is `requireAuth`-guarded. Entering a code hits the **authenticated** `POST /user/select-code`, which validates the code AND **(re)binds `user.sharedUserID`/`sharedCode` to that cohort**, so the code entered *after login* — not the registration code — determines which QuestionSet the attempt draws from (`resolveUserSet`). The access-code step is **un-skippable**: `login`/`verify-otp` reset a per-login `User.codeSelected` flag to `false`, and `assessmentController.getQuestions`/`startSession` return `403 {code:'CODE_REQUIRED'}` until `select-code` sets it `true` (client mirrors this with the `tbt_code_selected` localStorage flag + `api.requireCode()` guard on `welcome.html`). A candidate who has **already completed** the assessment is bounced straight to `/result` from the access-code screen too — *unless* an admin has approved their retest request, in which case they're let through to re-enter a code and start the granted attempt (see Retest Requests below). New users register via a **Register link on the login page** (`/register`); `register.html` now **self-collects the access code** (validates it via the public `POST /user/validate-code`, then registers) rather than depending on the access-code page being visited first, and `verify-otp` (`/verify-otp`) routes the new user through the same access-code screen (Register → Verify → Access Code → Question Set). Logout / session-expiry (`api.clearSession()`, plus a central 401 handler in `api.js` that bounces authenticated 401s to login) clears the token, cached user, access-code state, and in-progress session.
- Both `/api/v1/admin/login`, `/api/v1/user/login`, and `/api/v1/user/verify-otp` additionally sit behind a shared 10-requests/minute rate limiter (`backend/app.js`).
- Admin and user JWTs are verified by separate middleware (`middleware/adminAuth.js` / `middleware/userAuth.js`) and carry a `role` claim.
- CORS is allowlist-based (`backend/app.js`): origins from `USER_APP_URL`, `ADMIN_APP_URL`, and `ADMIN_WEB_URL` env vars (the last one is for the standalone `admin-web` Next.js frontend calling the API cross-origin instead of being served statically) are always allowed, and `http://localhost:*` / any `*.vercel.app` origin is allowed unconditionally on top of that allowlist (so preview deploys work without an env var update).

### Key Domain Concepts

- **SharedUserID** — an alphanumeric access code given to users; scoped to a particular assessment cohort. Carries a `questionSetId` — the **QuestionSet that cohort's users are assessed on** (nullable; selecting an unassigned code is rejected at `POST /user/select-code` with 409, and `/start` stays blocked because the access-code gate was never passed).
- **QuestionSet** — a named, admin-managed group of questions with its own `durationMinutes` (per-set timer). `questionIds` is an **ordered array of Question refs where array position IS the per-set order** (decoupled from the globally-unique `Question.order` — the same question can sit at different positions in different sets). Questions are **shared**: a question can belong to many sets, and deleting a set never deletes its questions (deletion is blocked, 409, while any access code still references the set). Managed via `adminQuestionSets.js`; reordering is just a PUT with the array in a new sequence (no separate reorder endpoint).
- **QuestionType** — the category grouping shown to admins/users (e.g., verbal, numerical). Each has a unique `order`. Distinct from `Question.questionType` below — the naming collision is real, don't conflate them.
- **Question** — belongs to a `QuestionType` category (`typeId`) and additionally carries a `questionType` enum describing its *answer shape*: `LIKERT_SCALE`, `SITUATIONAL`, `NUMERICAL_ABILITY`, `PERCENTAGE_TYPE`, `PUZZLE_TYPE`, `LOGICAL_ABILITY`, `VERBAL_ABILITY`, `IMAGE_BASED`, `MULTI_SELECT`, `RANKING` (see `models/Question.js`'s `QUESTION_TYPES`). Each question also has a `dimension` (one of 12 psychometric traits in `Question.DIMENSIONS` — Communication, Leadership, Problem Solving, etc.) that its score rolls up into for the report's dimension breakdown, independent of its `QuestionType` category. A `language` field (`'en'|'ta'`, default `'en'`) is the single source of truth for how the question is spoken — not inferred from the text. Type-specific fields (`correctOptionId`, `correctOptionIds`, `idealOrder`, `scoringMode`) are all on one schema rather than split across models.
- **Question audio** — when `hasAudio` is set, the admin uploads an audio clip that's stored **inline as a base64 data URI in `audioUrl`** (no external file storage — chosen for portability across the Vercel deploys). Uploads are capped at 3 MB client-side (`admin-web` questions form) and `audioUrl.length` is bounded server-side (`routes/adminCRUD.js`); `backend/app.js` raises the `express.json` body limit to 8 MB to fit the payload. `adminCRUDController.listQuestions` excludes `audioUrl` from the questions list (only `getQuestion` and the candidate `getQuestions` return it) so the base64 blobs don't bloat list responses. **Every** candidate question shows a custom Play/Pause/Resume/Replay/Stop control (`frontend/user/assessment.html` `renderAudio` + `startPlayback`), with a **3-tier audio priority**: (1) admin-uploaded `audioUrl`; else (2) cached **neural TTS** — an mp3 pre-generated by `scripts/generateQuestionAudio.js`, stored in `QuestionAudio`, flagged per-question by `getQuestions` as `neuralAudio` and fetched lazily from `GET /api/v1/assessment/questions/:id/audio`; else (3) the browser Web Speech API reading `question.text` (language auto-detected — Tamil `U+0B80–U+0BFF` → `ta-IN`, else `en-US`). Only one clip/utterance ever plays (`stopAllPlayback`); navigation/submit/exit stop it. The neural voice is **admin-managed** (admin-web `/voice` page → `routes/adminTts.js`): pick the English/Tamil voice + speed/pitch, toggle it on/off, and **Generate/Regenerate** audio per question or in bulk (each question is one fast `edge-tts` call — works on serverless). Voice/speed config lives in `Setting` key `tts_config` (read by `utils/ttsSettings.js`, which the candidate `getQuestions` also reads to honour the on/off toggle); generation happens via the admin endpoint OR `scripts/generateQuestionAudio.js`, both using the same config.
- **Explanation audio** — separate from question audio: `Question.explanationAudioText` is an admin-authored spoken explanation (reports-only `explanation` is a different field), optionally flagged `explanationIsTanglish` (Tamil written in English letters) so it's run through `utils/tanglish.js` before being sent to a Tamil neural voice. Cached per-question in `ExplanationAudio` (one record; `textHash` invalidates it when the text or the Tanglish flag changes, falling back to browser speech until regenerated), served via `GET /api/v1/assessment/questions/:id/explanation-audio`, and managed by the same admin-web `/voice` page through the parallel `generate-explanation`/`preview-explanation`/`explanation` endpoints in `routes/adminTts.js`.
- **AnswerOption** — options carry a `score` (not a fixed `marks` value); `SITUATIONAL` options additionally carry `dimensionScores` (one option maps to multiple dimensions at once, e.g. `{Communication: 5, Teamwork: 4}`).
- **evaluationEngine.js** — one evaluator function per `questionType`, dispatched by `evaluateAnswer(question, options, userAnswer)`. This is the only place scoring rules live; controllers must never inline per-type logic. `NUMERICAL_ABILITY`/`PERCENTAGE_TYPE`/`PUZZLE_TYPE`/`LOGICAL_ABILITY`/`VERBAL_ABILITY`/`IMAGE_BASED` all share `evaluateSingleCorrect` (correct option → full marks, else 0).
- **UserAnswer** — exactly one of `answerOptionId` (single-select types), `selectedOptionIds` (`MULTI_SELECT`), or `rankingOrder` (`RANKING`) is populated, depending on the question's `questionType`.
- **AssessmentSession** — tracks in-progress / submitted / expired state with a timer (`expiresAt`). At `startSession` it **snapshots the resolved set** onto the session: `questionSetId`, an ordered `questionIds` (the frozen list this attempt is scored against), and `durationMinutes`. `getQuestions` and `submitAssessment` read this snapshot — **not** the live set — so mid-attempt admin edits (reorder, membership, timer, cohort reassignment, deactivating a reused question) can't corrupt an in-flight attempt. Safe because question delete is a soft-delete, so a snapshotted id always resolves. Question *content/marks/options* are still live-read at submit (scoring stays server-authoritative). `assessmentController.resolveUserSet(user)` maps a user → their code's set → active-filtered, order-preserved question ids.
- **scoreCalculator.calculateResult** — aggregates `UserAnswer` scores two ways: per `QuestionType` category and per `dimension` (summed across whatever dimensions each answer's `dimensionScores` touches — most types touch one, `SITUATIONAL` touches several). Maxes come from `computeQuestionMaxes` over the **session's snapshot question set** (not all active questions), so **percentages are relative to the set the candidate actually took**. The function is parameterized on the question array, so no change was needed for set-scoping. Also derives `aptitudeScore`/`personalityScore`/`businessMindsetScore`/`financialAwarenessScore` as averages over fixed dimension groupings, and calls `businessRecommendationEngine` for recommendations.
- **businessRecommendationEngine.getRecommendations(dimensionPercentages)** — ordered rule list matched against dimension percentages (e.g. high Communication + Leadership + Risk Taking → sales/marketing businesses), deduped and capped at 5, with a fallback set if nothing matches. Replaces the old static `BUSINESS_MAP` (still present in `scoreCalculator.js` but superseded for new results).
- **Result** — one per submitted session. Original fields (total/percentage/level, per-category scores, `recommendedBusiness`, `improvementAreas`) plus additive fields for dimension scoring (`dimensionScores`, `dimensionPercentages`, `strongDimensions`/`weakDimensions`, the four composite scores, `recommendations`) — the additive fields are absent on Result documents created before this was introduced, so treat them as optional when reading.
- **BusinessMatrixCell** — admin-editable `rowTypeId` × `colTypeId` (both `QuestionType` refs) → recommended `businessName` + `rating` (1–5), unique per pair; managed via `adminBusinessMatrix.js`, separate from both `BUSINESS_MAP` and `businessRecommendationEngine`.
- **Setting** — a generic `key`/`value` (Mixed) store for admin-configurable platform settings. Holds `assessment_duration_minutes` (default 30 when unset). Since per-QuestionSet timers were introduced this is **no longer the live assessment timer** — each attempt's duration comes from its snapshot set's `durationMinutes`. It now serves as a **fallback** (the migration seeds the Default Set's timer from it; `getSettings` falls back to it only when a cohort has no usable set) and as the admin-editable default used to pre-fill a new set's timer. Still exposed at `GET /api/v1/assessment/settings` (now reflects the caller's own set duration) and `GET`/`POST /api/v1/admin/settings`. `AssessmentTimer` (`frontend/assets/js/timer.js`) accepts either a duration-in-seconds number or an absolute `expiresAt` date.
- **RetestRequest** — a candidate who has already completed the assessment can ask to retake it (`POST /api/v1/assessment/retest/request`); one approved request unlocks exactly one additional attempt. Lifecycle `pending → approved → used`, or `pending → rejected` (candidate may re-request); snapshots the candidate's current result (score/level/attempt number) so the admin queue (`adminDashboard.js`'s `retest-requests` endpoints) needs no joins. On approval the candidate is let back through the access-code screen (see Candidate flow above) to start the granted attempt.
- **Notification** — admin-facing feed (`adminNotifications.js`) for two real workflow events: `ASSESSMENT_SUBMITTED` and `RETEST_REQUEST_CREATED`. Created by `utils/notifier.js`'s best-effort `notify()` (errors are swallowed — a notification failure must never break submit/retest-request), stores only small display metadata plus a reference (`entityType`/`entityId`) to the source Result/RetestRequest, and is idempotent via a unique `(type, entityId)` index so retries can't double-notify.

---

## Admin Web (`app/admin-web/`) — the single admin application

```bash
cd app/admin-web
npm install
npm run dev      # Next.js dev server, port 3000
npm run build
npm run lint
```

Standalone Next.js (App Router, TypeScript, Tailwind v4) app, not served by the Express `app/backend`. It calls the same backend REST API cross-origin — point it at the running `app/backend` server and make sure that server's `ADMIN_WEB_URL` env var matches this app's origin, or CORS will reject the requests. Uses Chart.js for dashboard charts and Playwright (devDependency) for e2e tests. **See `app/admin-web/AGENTS.md` for required reading before writing Next.js code here** — it's on a canary release with API surface that differs from stable Next.js.

There is no other admin frontend — do not add HTML pages under `app/frontend/` for admin features; extend admin-web instead.

---

## Deployment

Production runs entirely on **Vercel** (three projects: `backend`, `user-web`, `admin-web`), all deployed by CI/CD on push to `main`. Render has been retired (its `render.yaml` blueprint was removed); disable any remaining Render service's auto-deploy in the dashboard.

- **Vercel — backend** (`app/`, serverless): `app/api/index.js` re-exports `backend/app.js` as the serverless entrypoint; `app/vercel.json` rewrites all requests to it. Since there's no boot-time hook on a serverless platform, `backend/app.js` connects to MongoDB lazily on first request and caches the connection on `global.__tbtMongoConnect` for warm invocations (`backend/server.js`'s `connectDB()` call is a no-op in this mode). This project also serves `frontend/` statically, but production candidate traffic goes to the standalone `user-web` project below.
- **Vercel — user-web** (`app/frontend`, static): the standalone candidate frontend. It reads its API origin from `window.TBT_API_BASE` (`frontend/assets/js/api.js`), baked into `assets/js/env.js` at build time by `build-env.js` from the `TBT_API_BASE` env var set in the CI deploy job (currently the backend's Vercel URL; slated to become `api.tamilbusinesstribe.com`). Because it's cross-origin from the API, that origin must be in the backend CORS allowlist.
- **Vercel — admin-web** (`app/admin-web`): the Next.js admin app, calling the API cross-origin; see its `ADMIN_WEB_URL` CORS requirement above.

### CI/CD (`.github/workflows/ci-cd.yml`)

> Note: this checkout has no `.git`/`.github` directory (not a git clone), so this workflow file couldn't be verified against the current repo — treat the description below as informational until confirmed against the actual GitHub repo.

A single GitHub Actions workflow covers both halves of the repo and runs on every push/PR to `main`:
- `test-backend` — `app/`'s Jest suite against a `mongo:7` service container (same as the old `ci.yml`).
- `build-admin-web` — installs, **lints (blocking — the ESLint config keeps `no-explicit-any` an error while pre-existing non-correctness rules like `set-state-in-effect` are warnings)**, and runs `next build` for `app/admin-web/`.
- `deploy-backend` / `deploy-user-web` / `deploy-admin-web` — on a push to `main` only, and gated on the corresponding test/build job passing, deploy each app to its own Vercel project via the Vercel CLI (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`). Requires a `VERCEL_TOKEN` repo secret; production env vars live in each Vercel project's dashboard, not in the workflow (except `user-web`'s `TBT_API_BASE`, set in the workflow). See `DEPLOYMENT.md` §6 for full setup.

Render is no longer part of the deploy path (blueprint removed) — Vercel is the sole production topology.
