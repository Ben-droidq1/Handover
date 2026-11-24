import { spawn } from 'node:child_process'
import { config } from './config.js'
import { resolveKane } from './kane.js'

/**
 * Kane's interactive login is OAuth: it opens a browser and listens on
 * 127.0.0.1, so a headless container can never finish it. Instead, when
 * KANE_USERNAME and KANE_ACCESS_KEY are present, log in once at startup with
 * the CLI's non-interactive credential flow. That is what lets a fresh deploy -
 * or a free instance with no persistent disk - verify criteria without anyone
 * opening a shell.
 */

const NOT_LOGGED_IN = /not logged in/i
const NOISE = /skill update available|update available|bundled node runtime/i

function lastMeaningfulLine(text) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !NOISE.test(line))
      .at(-1) ?? ''
  ).slice(0, 300)
}

function runKane(kane, args, timeoutMs) {
  return new Promise((resolve) => {
    let out = ''
    let err = ''
    let child
    let settled = false

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
        /* already gone */
      }
      finish({ code: null, out, err: `${err}\ntimed out after ${timeoutMs / 1000}s` })
    }, timeoutMs)

    try {
      child = spawn(kane.command, [...kane.prefix, ...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      })
    } catch (error) {
      finish({ code: null, out, err: error.message })
      return
    }

    child.stdout?.on('data', (chunk) => {
      out += chunk
    })
    child.stderr?.on('data', (chunk) => {
      err += chunk
    })
    child.on('error', (error) => finish({ code: null, out, err: `${err}${error.message}` }))
    child.on('close', (code) => finish({ code, out, err }))
  })
}

/**
 * Never throws: a failed login must not stop the API from booting, it just
 * leaves /api/health reporting loggedIn:false with the reason.
 */
export async function ensureKaneLogin({
  username = config.kaneUsername,
  accessKey = config.kaneAccessKey,
  run = runKane,
  resolve = resolveKane,
} = {}) {
  if (!username || !accessKey) {
    return { attempted: false, ok: false, reason: 'KANE_USERNAME/KANE_ACCESS_KEY are not set' }
  }

  let kane
  try {
    kane = await resolve()
  } catch (error) {
    return { attempted: false, ok: false, reason: `could not resolve Kane CLI: ${error.message}` }
  }

  const who = await run(kane, ['whoami'], 30_000)
  if (who.code === 0 && !NOT_LOGGED_IN.test(`${who.out}${who.err}`)) {
    return { attempted: false, ok: true, alreadyLoggedIn: true }
  }

  const login = await run(
    kane,
    ['login', '--username', username, '--access-key', accessKey],
    120_000,
  )

  if (login.code === 0) return { attempted: true, ok: true }

  return {
    attempted: true,
    ok: false,
    reason: lastMeaningfulLine(login.err) || lastMeaningfulLine(login.out) || 'kane-cli login failed',
  }
}
