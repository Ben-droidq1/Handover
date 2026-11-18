# Handover — frontend

React + Vite UI for Handover: freelancers add a site URL and plain-English acceptance
criteria, Kane CLI verifies each one in a real browser, and the client gets a shareable
report they can approve.

No UI framework, no router package, no icon package — React and Vite only.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173, expects the API on :3001
```

Preview the UI with built-in demo data before the backend exists:

```bash
# PowerShell
$env:VITE_MOCK='1'; npm run dev
# bash
VITE_MOCK=1 npm run dev
```

Other scripts:

```bash
npm run build        # production bundle in dist/
npm run smoke        # renders pages in Node to catch import/render crashes
```

Environment (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_MOCK` | unset | `1` serves in-memory demo data from `src/api/mock.js` |
| `VITE_API_BASE` | `''` (same origin / Vite proxy) | API origin when not using the proxy |

The Vite dev server proxies `/api` and `/demo` to `http://localhost:3001`.

## Routes

| Path | Who | What |
| --- | --- | --- |
| `/` | owner | Project list with pass rate and last run |
| `/new` | owner | Create a project: name, client, URL, criteria |
| `/projects/:id` | owner | Edit criteria, run checks, history, client link |
| `/runs/:id` | owner | Live progress while running, then per-criterion evidence |
| `/r/:token` | client | Public report: screenshots, pass/fail, approve delivery |

Owner writes can be gated by an optional shared password sent as `X-Owner-Password`
(`OWNER_PASSWORD` in the backend env). It is empty by default, so the app works with no accounts
at all; if you set one, the UI asks for it the first time a write is rejected. Client report pages
never need it.

## API contract

The backend in `../backend` is expected to serve these. Every payload is JSON.

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/api/projects` | `{ projects: ProjectSummary[] }` |
| `POST` | `/api/projects` | `{ name, clientName, siteUrl, criteria: string[] }` → `{ project }` **owner** |
| `GET` | `/api/projects/:id` | `{ project }` with `criteria[]` and `runs[]` |
| `PATCH` | `/api/projects/:id` | `{ name?, clientName?, siteUrl?, criteria?: string[] }` **owner** |
| `POST` | `/api/projects/:id/runs` | starts a run → `{ run: { id, status } }` **owner** |
| `GET` | `/api/runs/:id` | `{ run, results[] }` — polled every 2s while running |
| `GET` | `/api/public/:token` | `{ project, run, results[], history[], signoff }` |
| `POST` | `/api/public/:token/approve` | `{ name, note }` → `{ signoff }` |
| `GET` | `/api/public/:token/results/:resultId/screenshot` | PNG streamed from the evidence pack |

### Shapes

```ts
type Status = 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'timeout'

type ProjectSummary = {
  id: string
  name: string
  clientName: string
  siteUrl: string
  publicToken: string
  criteriaCount: number
  createdAt: string
  signedOff: boolean
  lastRun: null | {
    id: string; status: Status; startedAt: string; finishedAt: string | null
    passed: number; failed: number; total: number
  }
}

type Result = {
  id: string
  criterionId: string
  criterion: { id: string; text: string }
  position: number
  status: Status
  oneLiner: string | null      // run_end.one_liner
  summary: string | null       // run_end.summary
  reason: string | null        // run_end.reason, or the error label
  durationS: number | null
  steps: { n: number; status: 'done' | 'failed' | 'running'; remark: string }[]
  screenshotUrl: string | null // absolute or API-relative
  errorMessage: string | null  // exit 2 / 3 / crash explanation
  testUrl: string | null       // Kane Test Manager link
}
```

`error` means Kane could not run the check (missing Chrome, not logged in, timeout); it is
shown differently from a real `failed` assertion so the freelancer knows whether to fix the
site or their environment.

## Layout

```
src/
  api/client.js       fetch wrapper, owner header, URL qualification
  api/auth.js         owner password store (localStorage)
  api/mock.js         in-memory demo API — delete once the backend is live
  components/         Header, CriterionEditor, ResultCard, ApproveBox, Screenshot, OwnerDialog, ui primitives
  lib/                formatting, criterion linting helpers, useAsync (fetch + polling)
  pages/              Dashboard, NewProject, ProjectDetail, RunDetail, PublicReport, NotFound
  router.jsx          history-API router, no dependency
  styles.css          design tokens + all styles
scripts/
  smoke-render.mjs    Node-only render check used by `npm run smoke`
```

## Design notes

- Light, document-like UI: the client report is the product, so it is calm, high-contrast, and printable.
- Colour carries meaning only for status: green `passed`, red `failed`, amber `couldn't run`, indigo `running`.
- Every screenshot is clickable and opens full size; the failing step is what sells the report.
- The criteria editor warns about vague wording ("then verify …") because vague objectives are the
  main reason an AI browser run drifts.
- Empty, loading, and error states exist for every fetch; no page crashes on a backend failure.
