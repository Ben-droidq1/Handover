/* eslint-disable no-unused-vars */
/**
 * In-memory mock of the Handover API, enabled with VITE_MOCK=1.
 * It exists so the UI can be built and demoed before the Express backend is
 * running. Delete this file (and the switch in client.js) once the API is live.
 */

const now = Date.now()
const DAY = 86_400_000
const iso = (ms) => new Date(ms).toISOString()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ---------- fake screenshots (inline SVG, no binary assets) ---------- */

function fakeShot({ heading = 'Dashboard', url = 'localhost:3001/demo', tone = 'ok', note = '' }) {
  const ok = tone !== 'bad'
  const accent = ok ? '#0e9f6e' : '#d92d20'
  const soft = ok ? '#e7f8f0' : '#fef3f2'

  const cards = [0, 1, 2]
    .map((i) => {
      const x = 40 + i * 188
      return `
      <rect x="${x}" y="230" width="168" height="104" rx="10" fill="#ffffff" stroke="#e4e7ec"/>
      <rect x="${x + 16}" y="248" width="${86 - i * 10}" height="9" rx="4.5" fill="#d0d5dd"/>
      <rect x="${x + 16}" y="270" width="${128 - i * 14}" height="7" rx="3.5" fill="#eaecf0"/>
      <rect x="${x + 16}" y="284" width="${72 + i * 8}" height="7" rx="3.5" fill="#eaecf0"/>
      <rect x="${x + 16}" y="306" width="54" height="16" rx="8" fill="${soft}"/>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#ffffff"/>
    <rect width="640" height="38" fill="#f2f4f7"/>
    <circle cx="22" cy="19" r="5" fill="#f97066"/>
    <circle cx="40" cy="19" r="5" fill="#fdb022"/>
    <circle cx="58" cy="19" r="5" fill="#32d583"/>
    <rect x="80" y="10" width="320" height="18" rx="9" fill="#ffffff" stroke="#e4e7ec"/>
    <text x="94" y="23" font-family="Segoe UI, sans-serif" font-size="10" fill="#667085">${url}</text>
    <rect x="40" y="70" width="180" height="12" rx="6" fill="#101828" opacity=".82"/>
    <rect x="40" y="94" width="280" height="8" rx="4" fill="#d0d5dd"/>
    <rect x="40" y="112" width="220" height="8" rx="4" fill="#eaecf0"/>
    <rect x="470" y="66" width="130" height="30" rx="15" fill="${soft}"/>
    <circle cx="490" cy="81" r="5" fill="${accent}"/>
    <text x="502" y="85" font-family="Segoe UI, sans-serif" font-size="11" fill="${accent}">${ok ? 'Check passed' : 'Check failed'}</text>
    <rect x="40" y="150" width="560" height="56" rx="10" fill="#f9fafb" stroke="#eef0f3"/>
    <text x="60" y="174" font-family="Segoe UI, sans-serif" font-size="13" fill="#344054">${heading}</text>
    <text x="60" y="192" font-family="Segoe UI, sans-serif" font-size="10" fill="#667085">${note}</text>
    ${cards}
    <rect x="40" y="356" width="${ok ? 200 : 300}" height="10" rx="5" fill="${ok ? '#d1fadf' : '#fee4e2'}"/>
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ---------- seed data ---------- */

const projects = [
  {
    id: 'prj_northwind',
    name: 'Northwind Store',
    clientName: 'Northwind Ltd.',
    siteUrl: 'http://localhost:3001/demo',
    publicToken: 'nw_8f3c1d9a44b2e7',
    createdAt: iso(now - 12 * DAY),
    criteria: [
      {
        id: 'c1',
        position: 1,
        text: 'Go to the storefront and add a product to the cart, then verify the cart shows 1 item',
      },
      {
        id: 'c2',
        position: 2,
        text: 'Sign up with a new email address and confirm the welcome dashboard loads',
      },
      {
        id: 'c3',
        position: 3,
        text: 'Open the pricing page and verify all three plans are listed with prices',
      },
      {
        id: 'c4',
        position: 4,
        text: 'Open the billing page and download an invoice PDF, then verify the PDF opens',
      },
    ],
  },
  {
    id: 'prj_kestrel',
    name: 'Kestrel Studio portfolio',
    clientName: 'Kestrel Studio',
    siteUrl: 'https://kestrel.example.com',
    publicToken: 'ks_51be0c7d2a90f4',
    createdAt: iso(now - 30 * DAY),
    criteria: [
      { id: 'k1', position: 1, text: 'Open the homepage and verify the studio name and hero image load' },
      { id: 'k2', position: 2, text: 'Open the contact page, submit the form, then verify a thank-you message appears' },
    ],
  },
  {
    id: 'prj_halcyon',
    name: 'Halcyon docs refresh',
    clientName: 'Halcyon',
    siteUrl: 'https://halcyon.example.com',
    publicToken: 'hc_a71d39f0b5c846',
    createdAt: iso(now - 2 * DAY),
    criteria: [
      { id: 'h1', position: 1, text: 'Search the docs for "webhooks" and verify at least one result is listed' },
    ],
  },
]

/** @type {Array<{id:string, projectId:string, status:string, startedAt:string, finishedAt:string|null}>} */
const runs = []
/** @type {Array<object>} */
const results = []
/** @type {Array<{id:string, runId:string, approvedBy:string, note:string, createdAt:string}>} */
const signoffs = []

let counter = 0
const nextId = (prefix) => `${prefix}_${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`

function stepList(status) {
  const navigate = { n: 1, status: 'done', remark: 'navigate: opened the start URL' }
  const act = { n: 2, status: 'done', remark: 'click: followed the described path' }
  if (status === 'queued') return []
  if (status === 'running') return [navigate, { n: 2, status: 'running', remark: 'assert: checking the page…' }]
  if (status === 'passed') {
    return [navigate, act, { n: 3, status: 'done', remark: 'assert: the expected result is visible' }]
  }
  if (status === 'failed') {
    return [navigate, act, { n: 3, status: 'failed', remark: 'assert: the page never showed the expected result' }]
  }
  return [navigate, { n: 2, status: 'failed', remark: 'The browser closed before the check finished' }]
}

function resultPayload(criterion, status, options = {}) {
  const failed = status === 'failed' || status === 'error' || status === 'timeout'
  return {
    status,
    oneLiner:
      options.oneLiner ??
      (status === 'queued'
        ? 'Waiting for a browser slot'
        : status === 'running'
          ? 'Kane is checking this in a real browser…'
          : status === 'passed'
            ? 'The expected result was visible on screen'
            : 'The expected result was never shown'),
    summary:
      options.summary ??
      (status === 'passed'
        ? 'Kane opened the site, followed the criterion, and confirmed the final assertion.'
        : 'Kane followed the criterion but the final assertion failed, so the check did not pass.'),
    reason: options.reason ?? (status === 'passed' ? 'Objective completed' : failed ? 'Assertion not met' : null),
    durationS: options.durationS ?? (status === 'passed' ? 34 : failed ? 41 : null),
    steps: stepList(status),
    screenshotUrl: options.screenshotUrl ?? fakeShot({ tone: failed ? 'bad' : 'ok', note: criterion.text.slice(0, 70) }),
    errorMessage: options.errorMessage ?? null,
    testUrl:
      status === 'passed' || status === 'failed'
        ? 'https://test-manager.lambdatest.com/projects/1/test-cases/1'
        : null,
  }
}

function addResult(runId, criterion, status, options = {}) {
  const result = {
    id: nextId('res'),
    runId,
    criterionId: criterion.id,
    position: criterion.position,
    ...resultPayload(criterion, status, options),
  }
  results.push(result)
  return result
}

function seedRun(projectId, startedAtMs, statuses) {
  const project = projects.find((p) => p.id === projectId)
  const run = {
    id: nextId('run'),
    projectId,
    status: statuses.every((s) => s === 'passed') ? 'passed' : 'failed',
    startedAt: iso(startedAtMs),
    finishedAt: iso(startedAtMs + 96_000),
  }
  runs.push(run)
  project.criteria.forEach((criterion, i) => addResult(run.id, criterion, statuses[i]))
  return run
}

seedRun('prj_northwind', now - 2 * 3600_000, ['passed', 'passed', 'passed', 'failed'])
seedRun('prj_northwind', now - 1 * DAY, ['passed', 'passed', 'passed', 'passed'])
seedRun('prj_northwind', now - 4 * DAY, ['passed', 'failed', 'passed', 'failed'])

const kestrelRun = seedRun('prj_kestrel', now - 6 * DAY, ['passed', 'passed'])
signoffs.push({
  id: nextId('sig'),
  runId: kestrelRun.id,
  approvedBy: 'Maya Chen',
  note: 'Looks great, thanks for turning this around so quickly.',
  createdAt: iso(now - 5 * DAY),
})

/* ---------- shaping helpers ---------- */

function summary(runId) {
  const rows = results.filter((r) => r.runId === runId)
  const passed = rows.filter((r) => r.status === 'passed').length
  const failed = rows.filter((r) => r.status === 'failed' || r.status === 'error' || r.status === 'timeout').length
  return { passed, failed, total: rows.length }
}

function signoffFor(runId) {
  return signoffs.find((s) => s.runId === runId) ?? null
}

function projectSummary(project) {
  const own = runs
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
  const latest = own[0] ?? null
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    siteUrl: project.siteUrl,
    publicToken: project.publicToken,
    createdAt: project.createdAt,
    criteriaCount: project.criteria.length,
    lastRun: latest ? { id: latest.id, status: latest.status, startedAt: latest.startedAt, finishedAt: latest.finishedAt, ...summary(latest.id) } : null,
    signedOff: latest ? Boolean(signoffFor(latest.id)) : false,
  }
}

function projectDetail(project) {
  return {
    ...projectSummary(project),
    criteria: project.criteria.map((c) => ({ ...c })),
    runs: runs
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        ...summary(r.id),
        signoff: signoffFor(r.id)
          ? { approvedBy: signoffFor(r.id).approvedBy, createdAt: signoffFor(r.id).createdAt }
          : null,
      })),
  }
}

function runDetail(run) {
  const project = projects.find((p) => p.id === run.projectId)
  return {
    run: {
      id: run.id,
      projectId: run.projectId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        siteUrl: project.siteUrl,
        publicToken: project.publicToken,
      },
    },
    results: results
      .filter((r) => r.runId === run.id)
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        ...r,
        criterion: {
          id: r.criterionId,
          text: project.criteria.find((c) => c.id === r.criterionId)?.text ?? 'Criterion removed',
        },
      })),
  }
}

function finalStatus(text) {
  return /invoice|pdf/i.test(text) ? 'failed' : 'passed'
}

/* ---------- mock API ---------- */

export const mockApi = {
  async listProjects() {
    await wait(180)
    return {
      projects: [...projects]
        .sort((a, b) => {
          const aLatest = runs.filter((r) => r.projectId === a.id).sort((x, y) => new Date(y.startedAt) - new Date(x.startedAt))[0]
          const bLatest = runs.filter((r) => r.projectId === b.id).sort((x, y) => new Date(y.startedAt) - new Date(x.startedAt))[0]
          return new Date(bLatest?.startedAt ?? b.createdAt) - new Date(aLatest?.startedAt ?? a.createdAt)
        })
        .map(projectSummary),
    }
  },

  async getProject(id) {
    await wait(160)
    const project = projects.find((p) => p.id === id)
    if (!project) throw new Error('Project not found')
    return { project: projectDetail(project) }
  },

  async createProject(body) {
    await wait(320)
    const project = {
      id: nextId('prj'),
      name: body.name?.trim() || 'Untitled project',
      clientName: body.clientName?.trim() || '',
      siteUrl: body.siteUrl?.trim() || '',
      publicToken: `${nextId('tok')}${Math.random().toString(36).slice(2, 10)}`,
      createdAt: iso(Date.now()),
      criteria: (body.criteria ?? []).map((text, i) => ({ id: nextId('c'), position: i + 1, text })),
    }
    projects.push(project)
    return { project: projectDetail(project) }
  },

  async updateProject(id, patch) {
    await wait(220)
    const project = projects.find((p) => p.id === id)
    if (!project) throw new Error('Project not found')
    if (patch.name !== undefined) project.name = patch.name
    if (patch.clientName !== undefined) project.clientName = patch.clientName
    if (patch.siteUrl !== undefined) project.siteUrl = patch.siteUrl
    if (patch.criteria) {
      project.criteria = patch.criteria.map((text, i) => ({ id: nextId('c'), position: i + 1, text }))
    }
    return { project: projectDetail(project) }
  },

  async startRun(projectId) {
    await wait(200)
    const project = projects.find((p) => p.id === projectId)
    if (!project) throw new Error('Project not found')
    if (!project.criteria.length) throw new Error('Add at least one criterion before running')

    const run = {
      id: nextId('run'),
      projectId,
      status: 'running',
      startedAt: iso(Date.now()),
      finishedAt: null,
    }
    runs.push(run)
    project.criteria.forEach((criterion) => addResult(run.id, criterion, 'queued'))

    const rows = results.filter((r) => r.runId === run.id)
    rows.forEach((row, index) => {
      const criterion = project.criteria[index]
      setTimeout(() => {
        Object.assign(row, resultPayload(criterion, 'running'))
      }, 500 + index * 700)

      setTimeout(() => {
        Object.assign(row, resultPayload(criterion, finalStatus(criterion.text)))
        if (rows.every((r) => r.status === 'passed' || r.status === 'failed')) {
          run.status = rows.every((r) => r.status === 'passed') ? 'passed' : 'failed'
          run.finishedAt = iso(Date.now())
        }
      }, 2600 + index * 900)
    })

    return { run: { id: run.id, status: run.status } }
  },

  async getRun(runId) {
    const run = runs.find((r) => r.id === runId)
    if (!run) throw new Error('Run not found')
    return runDetail(run)
  },

  async getPublicReport(token) {
    await wait(140)
    const project = projects.find((p) => p.publicToken === token)
    if (!project) throw new Error('This report link is not valid')
    const own = runs
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    const latest = own[0] ?? null
    return {
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        siteUrl: project.siteUrl,
        publicToken: project.publicToken,
      },
      run: latest
        ? { id: latest.id, status: latest.status, startedAt: latest.startedAt, finishedAt: latest.finishedAt }
        : null,
      results: latest
        ? results
            .filter((r) => r.runId === latest.id)
            .sort((a, b) => a.position - b.position)
            .map((r) => ({ ...r, criterion: { id: r.criterionId, text: project.criteria.find((c) => c.id === r.criterionId)?.text ?? '' } }))
        : [],
      history: own.map((r) => ({
        runId: r.id,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        ...summary(r.id),
        signoff: signoffFor(r.id) ? { approvedBy: signoffFor(r.id).approvedBy, createdAt: signoffFor(r.id).createdAt } : null,
      })),
      signoff: latest ? signoffFor(latest.id) : null,
    }
  },

  async approve(token, body) {
    await wait(400)
    const project = projects.find((p) => p.publicToken === token)
    if (!project) throw new Error('This report link is not valid')
    const latest = runs
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0]
    if (!latest) throw new Error('There is no run to approve yet')
    if (signoffFor(latest.id)) return { signoff: signoffFor(latest.id) }
    const signoff = {
      id: nextId('sig'),
      runId: latest.id,
      approvedBy: body.name?.trim() || 'Client',
      note: body.note?.trim() || '',
      createdAt: iso(Date.now()),
    }
    signoffs.push(signoff)
    return { signoff }
  },
}
