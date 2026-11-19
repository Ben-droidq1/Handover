import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config, paths } from './config.js'

/**
 * Kane CLI runner.
 *
 *   kane-cli run "<criterion>" --url <site> --agent --headless --timeout N --max-steps N
 *
 * A `run` stream is NDJSON on stdout where *step lines have no `type` field*:
 *   {"step":2,"status":"running","remark":"..."}
 * and the last line of a started run is `run_end`. Exit codes:
 *   0 passed · 1 failed · 2 never started (no run_end, usually Chrome/auth) · 3 timeout.
 *
 * This module never rejects: every outcome becomes a result object so the
 * queue can store it and the server stays up.
 */

const MAX_EVENTS = 4000
const MAX_STEPS = 40

/** Live children, so a shutdown can stop the browsers instead of orphaning them. */
const activeChildren = new Set()

export function killActiveRuns() {
  for (const child of activeChildren) killTree(child)
  activeChildren.clear()
}

export function parseNdjsonLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const value = JSON.parse(trimmed)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

async function exists(candidate) {
  try {
    await fs.access(candidate)
    return true
  } catch {
    return false
  }
}

/**
 * Prefer running the package entry with the current Node binary. Spawning the
 * .cmd shim on Windows would need a shell, and a shell mangles objective text
 * that contains quotes or ampersands.
 */
export async function resolveKane() {
  if (config.kaneBin) {
    const isScript = /\.(c?js|mjs)$/i.test(config.kaneBin)
    return isScript
      ? { command: process.execPath, prefix: [config.kaneBin], mode: 'node' }
      : { command: config.kaneBin, prefix: [], mode: 'path' }
  }

  const candidates = []
  if (process.platform === 'win32') {
    if (process.env.APPDATA) {
      candidates.push(
        path.join(process.env.APPDATA, 'npm', 'node_modules', '@testmuai', 'kane-cli', 'bin', 'kane-cli.cjs'),
      )
    }
    if (process.env.ProgramFiles) {
      candidates.push(
        path.join(process.env.ProgramFiles, 'nodejs', 'node_modules', '@testmuai', 'kane-cli', 'bin', 'kane-cli.cjs'),
      )
    }
  } else {
    const home = os.homedir()
    candidates.push(
      '/usr/local/lib/node_modules/@testmuai/kane-cli/bin/kane-cli.cjs',
      '/usr/lib/node_modules/@testmuai/kane-cli/bin/kane-cli.cjs',
      path.join(home, '.npm-global/lib/node_modules/@testmuai/kane-cli/bin/kane-cli.cjs'),
      path.join(home, '.local/lib/node_modules/@testmuai/kane-cli/bin/kane-cli.cjs'),
    )
  }
  candidates.push(path.resolve(backendCwd(), 'node_modules/@testmuai/kane-cli/bin/kane-cli.cjs'))

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return { command: process.execPath, prefix: [candidate], mode: 'node' }
    }
  }

  return {
    command: process.platform === 'win32' ? 'kane-cli.cmd' : 'kane-cli',
    prefix: [],
    mode: 'path',
  }
}

function backendCwd() {
  return process.cwd()
}

function expandHome(value) {
  return value.startsWith('~') ? path.join(os.homedir(), value.slice(1)) : value
}

function extractSteps(events) {
  const steps = new Map()
  for (const event of events) {
    if (event.type) continue
    if (typeof event.step !== 'number' || typeof event.status !== 'string') continue
    steps.set(event.step, {
      n: event.step,
      status: event.status,
      remark: typeof event.remark === 'string' ? event.remark : '',
    })
  }
  return [...steps.values()].sort((a, b) => a.n - b.n).slice(0, MAX_STEPS)
}

// kane-cli prints these before every run, whether or not anything is wrong.
// They are notices, not reasons a run failed, so never report them as one.
const STDERR_NOISE =
  /bundled node runtime not found|running on system node|^running on:|skill update available/i

export function stderrHint(stderr) {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !STDERR_NOISE.test(line))
  const interesting =
    lines.find((line) => /not authenticated|not logged in|login --oauth/i.test(line)) ??
    lines.find((line) => /error|chrome|login|auth|missing|not found|cannot|failed/i.test(line)) ??
    lines.at(-1)
  return interesting ? interesting.slice(0, 400) : ''
}

async function findEvidenceFile(sessionDir) {
  if (!sessionDir) return null
  try {
    const dir = path.join(expandHome(sessionDir), 'evidence')
    const files = await fs.readdir(dir)
    const packs = files.filter((file) => file.endsWith('.evidence'))
    if (!packs.length) return null
    const stats = await Promise.all(
      packs.map(async (file) => {
        const full = path.join(dir, file)
        return { full, mtime: (await fs.stat(full)).mtimeMs }
      }),
    )
    stats.sort((a, b) => b.mtime - a.mtime)
    return stats[0].full
  } catch {
    return null
  }
}

function killTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } else {
    try {
      child.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

/**
 * Pure classification of a finished process, so the tricky exit-code rules can
 * be unit tested without spawning a browser.
 */
export function classifyOutcome({ runEnd, typedError, code, spawnError, hardKilled, timeoutSec, hint, command }) {
  if (spawnError) {
    return {
      status: 'error',
      errorMessage: `Kane CLI could not start (${command}). Install it with "npm install -g @testmuai/kane-cli" or set KANE_BIN.`,
    }
  }
  if (runEnd?.status === 'passed') return { status: 'passed', errorMessage: null }
  if (runEnd?.status === 'failed') return { status: 'failed', errorMessage: null }

  if (hardKilled || code === 3) {
    return {
      status: 'timeout',
      errorMessage: `Kane did not finish within ${timeoutSec}s, so the check was stopped.`,
    }
  }

  if (code === 2) {
    const detail = typedError?.message || hint
    return {
      status: 'error',
      errorMessage: detail
        ? `Kane could not start the run: ${detail}`
        : 'Kane could not start the run. Check that Google Chrome is installed and that "kane-cli login" has been run.',
    }
  }

  if (code === 0) {
    return {
      status: 'error',
      errorMessage: 'Kane exited successfully but sent no run_end event, so there is no verdict to report.',
    }
  }

  return {
    status: 'error',
    errorMessage:
      typedError?.message || hint || `Kane exited with code ${code} before reporting a result.`,
  }
}

export async function runCriterion({
  siteUrl,
  objective,
  timeoutSec = config.kaneTimeoutSec,
  maxSteps = config.kaneMaxSteps,
  logPath = null,
  onEvent = null,
  workDir = paths.work,
  profileDir = null,
}) {
  const startedAt = Date.now()
  const kane = await resolveKane()
  const args = [
    'run',
    objective,
    '--url',
    siteUrl,
    '--agent',
    '--headless',
    '--timeout',
    String(timeoutSec),
    '--max-steps',
    String(maxSteps),
  ]

  // Every concurrent check needs its own Chrome user-data-dir. Sharing one makes
  // the parallel browsers close each other's page ("TargetClosedError").
  if (profileDir) {
    await fs.mkdir(profileDir, { recursive: true })
    args.push('--chrome-profile', profileDir)
  }

  await fs.mkdir(workDir, { recursive: true })
  if (logPath) await fs.mkdir(path.dirname(logPath), { recursive: true })

  const useShell = kane.mode === 'path' && process.platform === 'win32'
  let child
  try {
    child = spawn(kane.command, [...kane.prefix, ...args], {
      cwd: workDir,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
      shell: useShell,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    return errorResult(`Could not launch Kane CLI: ${error.message}`, { logPath, startedAt })
  }

  const events = []
  let stderr = ''
  let pending = ''
  let spawnError = null
  let hardKilled = false
  const logStream = logPath ? createWriteStream(logPath, { flags: 'w' }) : null

  activeChildren.add(child)
  child.on('close', () => activeChildren.delete(child))
  child.on('error', () => activeChildren.delete(child))

  const pushEvent = (event) => {
    if (events.length < MAX_EVENTS) events.push(event)
    if (onEvent) {
      try {
        onEvent(event)
      } catch {
        /* a subscriber must never break the run */
      }
    }
  }

  const handleLine = (line) => {
    const event = parseNdjsonLine(line)
    if (event) pushEvent(event)
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    logStream?.write(chunk)
    pending += chunk
    let index
    while ((index = pending.indexOf('\n')) >= 0) {
      handleLine(pending.slice(0, index))
      pending = pending.slice(index + 1)
    }
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    logStream?.write(`[stderr] ${chunk}`)
    if (stderr.length < 20_000) stderr += chunk
  })

  const hardTimeout = setTimeout(
    () => {
      hardKilled = true
      killTree(child)
    },
    (timeoutSec + 30) * 1000,
  )

  const { code } = await new Promise((resolve) => {
    let settled = false
    const settle = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    child.on('error', (error) => {
      spawnError = error
      settle({ code: -1 })
    })
    child.on('close', (exitCode) => settle({ code: exitCode ?? -1 }))
  })

  clearTimeout(hardTimeout)
  if (pending.trim()) handleLine(pending)
  logStream?.end()

  const runEnd = [...events].reverse().find((event) => event.type === 'run_end') ?? null
  const typedError = [...events].reverse().find((event) => event.type === 'error') ?? null
  const steps = extractSteps(events)
  const hint = stderrHint(stderr)

  const { status, errorMessage } = classifyOutcome({
    runEnd,
    typedError,
    code,
    spawnError,
    hardKilled,
    timeoutSec,
    hint,
    command: kane.command,
  })

  const evidenceFile = await findEvidenceFile(runEnd?.session_dir)

  return {
    status,
    oneLiner: runEnd?.one_liner ?? null,
    summary: runEnd?.summary ?? null,
    reason: runEnd?.reason ?? null,
    durationS: runEnd?.duration ?? Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
    steps,
    testUrl: runEnd?.test_url ?? null,
    sessionDir: runEnd?.session_dir ?? null,
    evidenceFile,
    exitCode: code,
    errorMessage,
    credits: runEnd?.credits_consumed ?? runEnd?.credits ?? null,
  }
}

function errorResult(message, { logPath, startedAt }) {
  return {
    status: 'error',
    oneLiner: null,
    summary: null,
    reason: null,
    durationS: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
    steps: [],
    testUrl: null,
    sessionDir: null,
    evidenceFile: null,
    exitCode: null,
    errorMessage: message,
    credits: null,
    logPath,
  }
}
