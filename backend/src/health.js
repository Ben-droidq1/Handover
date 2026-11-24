import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { homedir } from 'node:os'
import { config } from './config.js'
import { resolveKane } from './kane.js'

// Mirrors Kane CLI's own search order so /api/health tells the truth about the
// browser Kane will actually pick (including Chrome for Testing and kane-chrome).
const CHROME_PATHS = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\chrome-for-testing\\chrome-win64\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\chrome-for-testing\\chrome-win64\\chrome.exe`,
    `${process.env.LOCALAPPDATA || ''}\\kane-chrome\\chrome.exe`,
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    `${homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    `${homedir()}/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome-for-testing',
    '/usr/local/bin/google-chrome-for-testing',
    `${homedir()}/chrome-for-testing/chrome-linux64/chrome`,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
}

function runText(command, args, timeoutMs, shell = false) {
  return new Promise((resolve) => {
    let out = ''
    let err = ''
    let settled = false
    let child

    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }

    const timer = setTimeout(() => {
      try {
        child?.kill()
      } catch {
        /* ignore */
      }
      finish({ ok: false, out, err: `${err}\ntimed out`, code: null })
    }, timeoutMs)

    try {
      child = spawn(command, args, { windowsHide: true, shell, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      finish({ ok: false, out, err: error.message, code: null })
      return
    }

    child.stdout?.on('data', (chunk) => {
      out += chunk
    })
    child.stderr?.on('data', (chunk) => {
      err += chunk
    })
    child.on('error', (error) => finish({ ok: false, out, err: `${err}${error.message}`, code: null }))
    child.on('close', (code) => finish({ ok: code === 0, out, err, code }))
  })
}

function probeChrome() {
  const override = process.env.KANE_CLI_CHROME_PATH?.trim()
  if (override) return { available: fs.existsSync(override), path: override }

  const candidates = CHROME_PATHS[process.platform] ?? []
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate))
  return { available: Boolean(found), path: found ?? null }
}

async function probeKane() {
  const kane = await resolveKane()
  const shell = kane.mode === 'path' && process.platform === 'win32'
  const version = await runText(kane.command, [...kane.prefix, '--version'], 20_000, shell)

  if (!version.ok) {
    return {
      available: false,
      loggedIn: false,
      version: null,
      error:
        (version.err || version.out).trim().slice(-400) ||
        'kane-cli --version failed. Is the CLI installed and on PATH?',
    }
  }

  const whoami = await runText(kane.command, [...kane.prefix, 'whoami'], 20_000, shell)
  const whoamiText = `${whoami.out}${whoami.err}`
  const loggedIn = whoami.ok && !/not logged in/i.test(whoamiText)

  return {
    available: true,
    loggedIn,
    version: version.out.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? null,
    error: loggedIn ? null : 'Kane CLI is installed but not logged in. Run "kane-cli login".',
  }
}

let cached = null
let cachedAt = 0

export async function getHealth({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < 20_000) return cached

  const [kane, chrome] = await Promise.all([probeKane(), Promise.resolve(probeChrome())])

  cached = {
    ok: kane.available && kane.loggedIn && chrome.available,
    kane,
    chrome,
    limits: {
      concurrency: config.maxConcurrency,
      timeoutSec: config.kaneTimeoutSec,
      maxSteps: config.kaneMaxSteps,
      maxCriteria: config.maxCriteria,
      ownerGate: Boolean(config.ownerPassword),
      // True when the container can log Kane in by itself (no shell needed).
      loginFromEnv: Boolean(config.kaneUsername && config.kaneAccessKey),
    },
    checkedAt: new Date().toISOString(),
  }
  cachedAt = Date.now()
  return cached
}
