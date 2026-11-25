# Handover

[![docker](https://github.com/Ben-droidq1/Handover/actions/workflows/docker.yml/badge.svg)](https://github.com/Ben-droidq1/Handover/actions/workflows/docker.yml)

**Proof of delivery for freelance work.** A freelancer pastes the site URL and the acceptance
criteria in plain English. [Kane CLI](https://kanecli.com) opens a real Chrome browser and
performs each criterion like a user would. The client gets a link to a quiet, readable report
with a screenshot of the failing step and an **Approve delivery** button.

Nothing is simulated: the only verification layer is Kane CLI driving Chrome. A criterion is
"passed" when Kane finishes that test successfully, and the evidence pack is sealed next to the
run.

```
freelancer ── criteria ──▶ Handover ── Kane CLI ──▶ Chrome ──▶ site
                              │
                              └── report + evidence ──▶ client link ──▶ approve
```

## What is in the box

- **Owner view** — projects, criteria editor, run history, live progress, re-run. **No accounts, no sign-up:
  open the URL and start.** An optional shared `OWNER_PASSWORD` can lock writes on a public deployment.
- **Client report** — per-criterion verdicts, step-by-step log, last-step screenshot, run history,
  sign-off with name and note. No account required, the URL token is the only key.
- **Runner** — up to 3 Chrome sessions in parallel, per-check timeouts, graceful handling of
  "Kane crashed / is not logged in / Chrome is missing" so the API never dies mid-run.
- **Evidence** — each run's `.evidence` zip is copied into `backend/data/evidence` and the final
  screenshot is extracted and served by the API.
- **Demo store** — a small storefront at `/demo/` with one deliberately broken button, so the
  demo has a genuine failure to show.

## Requirements

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20.12+ (22 or 26 recommended) | backend uses `node --test`, `--env-file-if-exists` and ESM |
| Kane CLI | 0.10.x | the verification layer |
| Google Chrome | current stable | Kane drives a real Chrome, not a bundled browser |
| A Kane account | — | runs consume credits |

No Playwright, Puppeteer or Selenium anywhere — see `backend/src/kane.js`.

## Setup

```bash
# 1. Kane CLI + login (once)
npm install -g @testmuai/kane-cli
kane-cli login --oauth          # or: kane-cli login --username <user> --access-key <key>
kane-cli whoami                 # should show your identity, not "Not logged in"

# 2. Install Chrome if you do not have it
#    macOS/Windows: https://www.google.com/chrome/
#    No admin rights? Chrome for Testing works too: Kane also looks at
#    %LOCALAPPDATA%\kane-chrome\chrome.exe (Windows) or ~/chrome-for-testing,
#    and KANE_CLI_CHROME_PATH can point at any Chromium binary.
```

```bash
# 3. Backend
cd backend
cp .env.example .env            # optional; defaults work for local dev
npm install
npm run dev                     # http://localhost:3001

# 4. Frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api and /demo
```

Open <http://localhost:5173>. `GET /api/health` on the backend reports whether Kane is
installed, logged in, and whether Chrome was found — check it first if runs fail instantly.

Build the UI for production and let Express serve it:

```bash
cd frontend && npm run build
cd ../backend && npm start       # http://localhost:3001 serves the app and /demo
```

### Demo walkthrough (2 minutes)

1. Visit <http://localhost:3001/demo/> to see the storefront.
2. In Handover, create a project with:
   - **Name** `Northwind Supply`, **Client** `Alex Rivera`
   - **URL** `http://localhost:3001/demo/`
   - **Criteria**:
     - `Add the Field Tool Roll to the cart and confirm the cart badge shows 1.`
     - `Create an account with the email test@example.com and the password Secret123! and confirm the dashboard greets that email.`
     - `Open the Billing page, click "Download invoice", and confirm a PDF file is downloaded.`
3. **Run checks**. Three Chrome sessions start; the run page polls live.
4. Two criteria pass, the invoice one fails — the button is intentionally broken, and the
   screenshot shows the stalled page. Open **Client view**, then approve as the client.

## Configuration

`backend/.env` is loaded by `npm run dev` and `npm start` (`node --env-file-if-exists`);
real environment variables take precedence. Defaults live in `backend/.env.example`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `OWNER_PASSWORD` | empty | when set, writes require `X-Owner-Password`; the UI prompts once |
| `DATA_DIR` | `data` | SQLite DB, evidence packs, screenshots, Kane logs |
| `KANE_BIN` | auto-detected | explicit path to `kane-cli.cjs` (or the binary) |
| `KANE_TIMEOUT_SEC` | `180` | per-criterion timeout passed to Kane |
| `KANE_MAX_STEPS` | `20` | per-criterion step budget |
| `MAX_CONCURRENCY` | `3` | simultaneous browsers |
| `MAX_CRITERIA` | `8` | hard cap per project |

Frontend: `VITE_MOCK=1` runs the UI against in-memory demo data (useful for screenshots or while
the backend is down). `VITE_API_BASE` points the UI at another API origin. See
`frontend/README.md` for the full API contract.

## How a run works

1. `POST /api/projects/:id/runs` inserts a run plus one queued result per criterion and returns
   immediately; one run per project at a time (`409` otherwise).
2. `backend/src/queue.js` runs results through a 3-slot limiter. Each result spawns:

   ```
   node <kane-cli.cjs> run "<criterion>" --url <site> --agent --headless \
        --timeout 180 --max-steps 20
   ```

   Kane emits NDJSON on stdout. Step lines have no `type` field; the last line of a started run
   is `run_end` with `status`, `summary`, `one_liner`, `reason`, `duration`, `test_url` and
   `session_dir`. Step events are persisted as they arrive, so the UI shows live progress.
3. Exit codes are mapped deliberately: `0` passed, `1` failed, `2` never started (Chrome missing
   or not logged in → `error` with an actionable message), `3` timeout. A spawn failure or a
   crashed run becomes an `error` result; the server keeps running and the run can be retried.
4. `backend/src/evidence.js` opens the sealed `.evidence` zip with a ~60-line zip reader built on
   `node:zlib` (no dependency), keeps the pack, and extracts the final step's `screenshot.png`.
5. Run status is recomputed from its results (`passed` only when every criterion passed).
6. The public report at `/r/:token` uses a 24-character random token, serves screenshots through
   `/api/public/:token/results/:id/screenshot`, and records one sign-off per run.

A failed criterion and a criterion that *could not run* are styled and counted separately: the
first means the site is broken, the second means the environment is.

## Tests

```bash
cd backend && npm test          # 35 tests: exit-code mapping, zip reader, validation, env login
cd frontend && npm run smoke    # renders every page in Node to catch crashes
```

The backend tests never launch a browser, so they run on CI without Chrome or Kane credentials.

### Live check

`scripts/live-check.mjs` exercises a running instance the way the demo does:

```bash
# read-only: health, app shell, /r/<token>, demo pages
node scripts/live-check.mjs --base http://localhost:3001

# the whole client journey: create a project, run 3 criteria, download a
# screenshot, and sign the public report off
node scripts/live-check.mjs --base http://localhost:3001 --full
```

It exits non-zero on the first failed expectation, so it can gate a deploy. Add `--password` when
`OWNER_PASSWORD` is set. A full run costs Kane credits and takes several minutes; the script prints
each criterion's status while it polls.

## Docker

```bash
docker build -t handover .
docker run --rm -p 3001:3001 -v handover-data:/data -v handover-home:/home/node handover
```

The image contains Kane CLI and Chromium (Debian's package, picked up through
`KANE_CLI_CHROME_PATH=/usr/bin/chromium`), and CI builds it on every push plus a smoke test that
checks the SPA, the deep links, the demo site, and that Kane and the browser are present
(`.github/workflows/docker.yml`). Chromium comes from the same apt mirror as the rest of the base
image, so the build does not depend on downloading Google's `.deb` at build time.

Real runs still need a logged-in Kane profile: mount a volume at `$HOME` (or copy
`~/.testmuai/kaneai` in) after running `kane-cli login` on the host. Chrome inside containers may
need `--shm-size=1g`; Kane already passes `--no-sandbox` on Linux. If you would rather not install
Docker Desktop locally, run the app on the host, which is the supported path for the demo.

The container starts as root only to take ownership of a root-owned disk mount, then drops to the
unprivileged `node` user before starting the server (`docker-entrypoint.sh`).

## Render

`render.yaml` deploys the Docker image as a web service with a 1 GB disk at `/data`. Use the
Blueprint flow (New → Blueprint → pick this repo); a native Node service will not work, because the
app needs Kane CLI and Chromium, and the frontend is compiled inside the image.

| Variable | Value | Why |
| --- | --- | --- |
| `DATA_DIR` | `/data` | SQLite, screenshots, evidence and logs live on the disk |
| `HOME` | `/data/home` | Keeps Kane's `~/.testmuai` profile across deploys |
| `KANE_CLI_CHROME_PATH` | `/usr/bin/chromium` | Browser baked into the image |
| `KANE_TIMEOUT_SEC` | `420` | Kane spends 1–2 minutes planning before it acts |
| `MAX_CONCURRENCY` | `2` | Three headless browsers need more RAM than small instances have |
| `KANE_USERNAME` | your Kane email | Optional: lets the container log Kane in by itself |
| `KANE_ACCESS_KEY` | your access key | Optional: paired with `KANE_USERNAME` |
| `OWNER_PASSWORD` | optional | Locks project create/edit/run behind a password |

`PORT` is injected by Render — never set it. Disks require a paid instance; on the free tier remove
`disk:` and point `DATA_DIR` inside the container instead, accepting that data is lost on redeploy.

OAuth cannot run in a headless container. Set `KANE_USERNAME` + `KANE_ACCESS_KEY` in the dashboard and
the server logs in on boot (`/api/health` shows `limits.loginFromEnv: true`); no shell needed. If you
prefer not to store the key, run this once in the Render Shell instead:

```bash
kane-cli login --username <email> --access-key <key>
```

With `HOME=/data/home` the profile is written to the disk, and `/api/health` then reports
`loggedIn: true`. Remember that the demo project's site URL must be the public
`https://<service>.onrender.com/demo/`, not `localhost`.


## Layout

```
Handover/
  backend/
    src/            config, db, store, kane runner, queue, evidence reader, routes
    demo-site/      the deliberately imperfect storefront at /demo/
    test/           node:test suites (no browser required)
  frontend/
    src/pages/      Dashboard, NewProject, ProjectDetail, RunDetail, PublicReport
    src/components/ Header, CriterionEditor, ResultCard, ApproveBox, …
```

## Scope and known limits

Built for a short build, deliberately small:

- No accounts. There is one optional shared password (`OWNER_PASSWORD`) to protect writes if you host it
  publicly; leave it empty and anyone with the URL can create projects, which is the intended demo mode.
- The client link is shareable; anyone with it can approve, which matches how a handover email
  works. Sign-offs are idempotent per run.
- Screenshots come from the last step of a criterion; the full pack is archived but not browsable.
- The zip reader rejects ZIP64 packs; if Kane changes its pack format, older evidence stays on
  disk and the backend degrades to "no screenshot" rather than failing a run.
- Criterion quality still matters: vague objectives make browser agents drift. The editor warns
  about them.
