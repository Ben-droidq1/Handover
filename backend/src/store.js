import { db, newId, newToken, nowIso } from './db.js'
import { conflict, notFound } from './errors.js'

function safeJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

/* ---------- shaping ---------- */

function mapSummary(row) {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    siteUrl: row.site_url,
    publicToken: row.public_token,
    createdAt: row.created_at,
    criteriaCount: row.criteria_count,
    signedOff: Boolean(row.signoff_id),
    lastRun: row.run_id
      ? {
          id: row.run_id,
          status: row.run_status,
          startedAt: row.run_started_at,
          finishedAt: row.run_finished_at,
          passed: row.passed,
          failed: row.failed,
          total: row.total,
        }
      : null,
  }
}

function mapResult(row, publicToken) {
  const id = row.id
  return {
    id,
    criterionId: row.criterion_id,
    position: row.position,
    criterion: { id: row.criterion_id, text: row.criterion_text },
    status: row.status,
    oneLiner: row.one_liner,
    summary: row.summary,
    reason: row.reason,
    durationS: row.duration_s,
    steps: safeJson(row.steps_json),
    screenshotUrl: row.screenshot_path
      ? publicToken
        ? `/api/public/${publicToken}/results/${id}/screenshot`
        : `/api/results/${id}/screenshot`
      : null,
    errorMessage: row.error_message,
    testUrl: row.test_url,
  }
}

const SUMMARY_SQL = `
  SELECT p.id, p.name, p.client_name, p.site_url, p.public_token, p.created_at,
    (SELECT COUNT(*) FROM criteria c WHERE c.project_id = p.id) AS criteria_count,
    r.id AS run_id, r.status AS run_status, r.started_at AS run_started_at, r.finished_at AS run_finished_at,
    (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id AND x.status = 'passed') AS passed,
    (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id AND x.status IN ('failed','error','timeout')) AS failed,
    (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id) AS total,
    s.id AS signoff_id
  FROM projects p
  LEFT JOIN runs r ON r.id = (SELECT id FROM runs WHERE project_id = p.id ORDER BY started_at DESC LIMIT 1)
  LEFT JOIN signoffs s ON s.run_id = r.id
`

/* ---------- projects ---------- */

export function listProjects() {
  return db
    .prepare(`${SUMMARY_SQL} ORDER BY COALESCE(r.started_at, p.created_at) DESC`)
    .all()
    .map(mapSummary)
}

export function getProjectSummary(id) {
  const row = db.prepare(`${SUMMARY_SQL} WHERE p.id = ?`).get(id)
  if (!row) throw notFound('Project not found.')
  return mapSummary(row)
}

export function getProjectDetail(id) {
  const summary = getProjectSummary(id)

  const criteria = db
    .prepare('SELECT id, position, text FROM criteria WHERE project_id = ? ORDER BY position')
    .all(id)

  const runs = db
    .prepare(
      `SELECT r.id, r.status, r.started_at, r.finished_at,
        (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id AND x.status = 'passed') AS passed,
        (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id AND x.status IN ('failed','error','timeout')) AS failed,
        (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id) AS total,
        s.approved_by, s.created_at AS signoff_at
      FROM runs r
      LEFT JOIN signoffs s ON s.run_id = r.id
      WHERE r.project_id = ?
      ORDER BY r.started_at DESC
      LIMIT 50`,
    )
    .all(id)
    .map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      passed: run.passed,
      failed: run.failed,
      total: run.total,
      signoff: run.approved_by ? { approvedBy: run.approved_by, createdAt: run.signoff_at } : null,
    }))

  return { project: { ...summary, criteria, runs } }
}

export function createProject({ name, clientName, siteUrl, criteria }) {
  const id = newId('prj')
  const token = newToken()
  const at = nowIso()

  const insertProject = db.prepare(
    'INSERT INTO projects (id, name, client_name, site_url, public_token, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const insertCriterion = db.prepare(
    'INSERT INTO criteria (id, project_id, position, text) VALUES (?, ?, ?, ?)',
  )

  db.transaction(() => {
    insertProject.run(id, name, clientName, siteUrl, token, at)
    criteria.forEach((text, index) => insertCriterion.run(newId('crit'), id, index + 1, text))
  })()

  return getProjectDetail(id)
}

export function updateProject(id, patch) {
  getProjectSummary(id)

  const fields = []
  const values = []
  for (const [column, value] of [
    ['name', patch.name],
    ['client_name', patch.clientName],
    ['site_url', patch.siteUrl],
  ]) {
    if (value !== undefined) {
      fields.push(`${column} = ?`)
      values.push(value)
    }
  }

  db.transaction(() => {
    if (fields.length) {
      db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
    }
    if (patch.criteria) {
      db.prepare('DELETE FROM criteria WHERE project_id = ?').run(id)
      const insert = db.prepare('INSERT INTO criteria (id, project_id, position, text) VALUES (?, ?, ?, ?)')
      patch.criteria.forEach((text, index) => insert.run(newId('crit'), id, index + 1, text))
    }
  })()

  return getProjectDetail(id)
}

/* ---------- runs ---------- */

export function createRun(projectId) {
  getProjectSummary(projectId)

  const active = db
    .prepare("SELECT id FROM runs WHERE project_id = ? AND status IN ('queued','running') LIMIT 1")
    .get(projectId)
  if (active) throw conflict('A run is already in progress for this project.')

  const criteria = db
    .prepare('SELECT id, text, position FROM criteria WHERE project_id = ? ORDER BY position')
    .all(projectId)
  if (!criteria.length) throw conflict('Add at least one criterion before running.')

  const id = newId('run')
  const at = nowIso()

  const insertRun = db.prepare('INSERT INTO runs (id, project_id, status, started_at) VALUES (?, ?, ?, ?)')
  const insertResult = db.prepare(
    `INSERT INTO results (id, run_id, criterion_id, criterion_text, position, status, steps_json, created_at)
     VALUES (?, ?, ?, ?, ?, 'queued', '[]', ?)`,
  )

  db.transaction(() => {
    insertRun.run(id, projectId, 'queued', at)
    criteria.forEach((criterion) =>
      insertResult.run(newId('res'), id, criterion.id, criterion.text, criterion.position, at),
    )
  })()

  return { run: { id, status: 'queued' } }
}

export function getRunDetail(runId, { publicToken } = {}) {
  const run = db
    .prepare(
      `SELECT r.id, r.project_id, r.status, r.started_at, r.finished_at,
        p.name, p.client_name, p.site_url, p.public_token
       FROM runs r JOIN projects p ON p.id = r.project_id
       WHERE r.id = ?`,
    )
    .get(runId)
  if (!run) throw notFound('Run not found.')

  const results = db
    .prepare('SELECT * FROM results WHERE run_id = ? ORDER BY position')
    .all(runId)
    .map((row) => mapResult(row, publicToken ?? null))

  return {
    run: {
      id: run.id,
      projectId: run.project_id,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      project: {
        id: run.project_id,
        name: run.name,
        clientName: run.client_name,
        siteUrl: run.site_url,
        publicToken: run.public_token,
      },
    },
    results,
  }
}

/* ---------- queue-facing helpers ---------- */

export function getRunnableResults(runId) {
  return db
    .prepare('SELECT id, criterion_text, position FROM results WHERE run_id = ? ORDER BY position')
    .all(runId)
}

export function getRunContext(runId) {
  const row = db
    .prepare(
      `SELECT r.id, r.status, r.project_id, p.site_url
       FROM runs r JOIN projects p ON p.id = r.project_id WHERE r.id = ?`,
    )
    .get(runId)
  if (!row) throw notFound('Run not found.')
  return row
}

export function markRunRunning(runId) {
  db.prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(runId)
}

export function markResultRunning(resultId) {
  db.prepare("UPDATE results SET status = 'running' WHERE id = ?").run(resultId)
}

export function updateResultSteps(resultId, steps) {
  db.prepare('UPDATE results SET steps_json = ? WHERE id = ?').run(JSON.stringify(steps), resultId)
}

export function finishResult(resultId, outcome) {
  db.prepare(
    `UPDATE results SET
      status = ?, one_liner = ?, summary = ?, reason = ?, duration_s = ?, steps_json = ?,
      screenshot_path = ?, evidence_path = ?, log_path = ?, test_url = ?, error_message = ?,
      kane_exit_code = ?, credits = ?, finished_at = ?
     WHERE id = ?`,
  ).run(
    outcome.status,
    outcome.oneLiner ?? null,
    outcome.summary ?? null,
    outcome.reason ?? null,
    outcome.durationS ?? null,
    JSON.stringify(outcome.steps ?? []),
    outcome.screenshotPath ?? null,
    outcome.evidencePath ?? null,
    outcome.logPath ?? null,
    outcome.testUrl ?? null,
    outcome.errorMessage ?? null,
    outcome.exitCode ?? null,
    outcome.credits ?? null,
    nowIso(),
    resultId,
  )
}

export function failResult(resultId, message) {
  db.prepare(
    "UPDATE results SET status = 'error', error_message = ?, finished_at = ? WHERE id = ?",
  ).run(message, nowIso(), resultId)
}

export function failRun(runId, message) {
  const at = nowIso()
  db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run(
    message,
    at,
    runId,
  )
  db.prepare(
    "UPDATE results SET status = 'error', error_message = ?, finished_at = ? WHERE run_id = ? AND status IN ('queued','running')",
  ).run(message, at, runId)
}

export function recomputeRun(runId) {  const rows = db.prepare('SELECT status FROM results WHERE run_id = ?').all(runId)
  const settled = rows.every((row) => row.status !== 'queued' && row.status !== 'running')
  const passed = rows.filter((row) => row.status === 'passed').length
  const status = !settled ? 'running' : passed === rows.length ? 'passed' : 'failed'

  db.prepare('UPDATE runs SET status = ?, finished_at = ? WHERE id = ?').run(
    status,
    settled ? nowIso() : null,
    runId,
  )
  return { status, passed, total: rows.length }
}

export function recoverInterruptedRuns() {
  const at = nowIso()
  const results = db
    .prepare(
      "UPDATE results SET status = 'error', error_message = ?, finished_at = ? WHERE status IN ('queued','running')",
    )
    .run('The server restarted before this check finished. Run the checks again.', at)
  const runs = db
    .prepare(
      "UPDATE runs SET status = 'failed', error = 'Server restarted during the run', finished_at = ? WHERE status IN ('queued','running')",
    )
    .run(at)
  return { results: results.changes, runs: runs.changes }
}

/* ---------- public report ---------- */

function getProjectByToken(token) {
  const project = db.prepare('SELECT * FROM projects WHERE public_token = ?').get(token)
  if (!project) throw notFound('This report link is not valid.')
  return project
}

export function getPublicReport(token) {
  const project = getProjectByToken(token)

  const latest = db
    .prepare('SELECT * FROM runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(project.id)

  const history = db
    .prepare(
      `SELECT r.id, r.status, r.started_at, r.finished_at,
        (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id AND x.status = 'passed') AS passed,
        (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id AND x.status IN ('failed','error','timeout')) AS failed,
        (SELECT COUNT(*) FROM results x WHERE x.run_id = r.id) AS total,
        s.approved_by, s.created_at AS signoff_at
       FROM runs r
       LEFT JOIN signoffs s ON s.run_id = r.id
       WHERE r.project_id = ?
       ORDER BY r.started_at DESC
       LIMIT 20`,
    )
    .all(project.id)
    .map((run) => ({
      runId: run.id,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      passed: run.passed,
      failed: run.failed,
      total: run.total,
      signoff: run.approved_by ? { approvedBy: run.approved_by, createdAt: run.signoff_at } : null,
    }))

  const results = latest
    ? db
        .prepare('SELECT * FROM results WHERE run_id = ? ORDER BY position')
        .all(latest.id)
        .map((row) => mapResult(row, project.public_token))
    : []

  const signoffRow = latest
    ? db.prepare('SELECT * FROM signoffs WHERE run_id = ?').get(latest.id)
    : null

  return {
    project: {
      id: project.id,
      name: project.name,
      clientName: project.client_name,
      siteUrl: project.site_url,
      publicToken: project.public_token,
    },
    run: latest
      ? {
          id: latest.id,
          status: latest.status,
          startedAt: latest.started_at,
          finishedAt: latest.finished_at,
        }
      : null,
    results,
    history,
    signoff: signoffRow
      ? {
          id: signoffRow.id,
          approvedBy: signoffRow.approved_by,
          note: signoffRow.note,
          createdAt: signoffRow.created_at,
        }
      : null,
  }
}

export function approveDelivery(token, { name, note }) {
  const project = getProjectByToken(token)
  const latest = db
    .prepare('SELECT id FROM runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(project.id)
  if (!latest) throw conflict('There is no run to approve yet.')

  const existing = db.prepare('SELECT * FROM signoffs WHERE run_id = ?').get(latest.id)
  if (existing) {
    return {
      signoff: {
        id: existing.id,
        approvedBy: existing.approved_by,
        note: existing.note,
        createdAt: existing.created_at,
      },
    }
  }

  const signoff = {
    id: newId('sig'),
    approvedBy: name,
    note: note ?? '',
    createdAt: nowIso(),
  }
  db.prepare(
    'INSERT INTO signoffs (id, run_id, project_id, approved_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(signoff.id, latest.id, project.id, signoff.approvedBy, signoff.note, signoff.createdAt)

  return { signoff }
}

export function findResultWithToken(resultId) {
  return db
    .prepare(
      `SELECT res.id, res.screenshot_path, res.evidence_path, r.project_id, p.public_token
       FROM results res
       JOIN runs r ON r.id = res.run_id
       JOIN projects p ON p.id = r.project_id
       WHERE res.id = ?`,
    )
    .get(resultId)
}

export function findResult(resultId) {
  return db.prepare('SELECT * FROM results WHERE id = ?').get(resultId)
}
