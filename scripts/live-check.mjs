#!/usr/bin/env node
/**
 * Live smoke test for a deployed Handover instance.
 *
 *   node scripts/live-check.mjs --base https://handover.onrender.com
 *   node scripts/live-check.mjs --base https://handover.onrender.com --full
 *   node scripts/live-check.mjs --base https://handover.onrender.com --full --password "$OWNER_PASSWORD"
 *
 * Without --full it only reads: health, the SPA shell, a deep link, and the
 * demo pages. With --full it also creates a throwaway project pointing at
 * <base>/demo/, runs its three criteria through Kane, fetches a screenshot, and
 * signs the report off through the public token - the whole client journey.
 *
 * Exits 1 if any check fails, so it can gate a deploy.
 */

const args = process.argv.slice(2)

const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const base = (option('base') || process.env.HANDOVER_BASE || 'http://localhost:3001').replace(/\/+$/, '')
const password = option('password') || process.env.OWNER_PASSWORD || ''
const full = flag('full')
const runTimeoutMs = Number(option('timeout', '1200')) * 1000
const ownerHeaders = password ? { 'x-owner-password': password } : {}

let failures = 0
const summary = []

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function check(name, fn) {
  const started = Date.now()
  try {
    const detail = await fn()
    summary.push({ name, ok: true, ms: Date.now() - started })
    console.log(`PASS  ${name}${typeof detail === 'string' && detail ? `  ${detail}` : ''}`)
    return detail
  } catch (error) {
    failures += 1
    summary.push({ name, ok: false, ms: Date.now() - started })
    console.log(`FAIL  ${name}  ${error.message}`)
    return null
  }
}

async function request(path, { method = 'GET', body, headers = {}, timeoutMs = 60_000 } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...ownerHeaders,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  return res
}

async function json(path, options = {}) {
  const res = await request(path, options)
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status} ${payload?.error ?? ''}`.trim())
  }
  return payload
}

async function html(path, needle) {
  const res = await request(path, { headers: { accept: 'text/html' } })
  const body = await res.text()
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`)
  if (!body.includes(needle)) throw new Error(`GET ${path} did not contain ${JSON.stringify(needle)}`)
  return `${res.status}, ${body.length} bytes`
}

/** Render's free instances spin down, so the first hit can take ~a minute. */
async function healthWithRetry(attempts = 8) {
  let last
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await request('/api/health?refresh=1', { timeoutMs: 90_000 })
      if (res.ok) return res.json()
      last = new Error(`health -> ${res.status}`)
    } catch (error) {
      last = error
    }
    if (i < attempts) {
      console.log(`      health not ready (${last.message}), retrying in 10s [${i}/${attempts}]`)
      await sleep(10_000)
    }
  }
  throw last
}

console.log(`Handover live check against ${base}${full ? ' (full: runs real criteria)' : ''}\n`)

const health = await check('health endpoint reports Kane + Chrome', async () => {
  const h = await healthWithRetry()
  const line = `kane=${h.kane?.version ?? 'missing'} chrome=${h.chrome?.path ?? 'missing'} concurrency=${h.limits?.concurrency}`
  if (!h.kane?.available) throw new Error(`Kane CLI is not available: ${h.kane?.error ?? 'unknown'}`)
  if (!h.chrome?.available) throw new Error(`Chrome is not available at ${h.chrome?.path ?? 'unknown path'}`)
  if (!h.kane?.loggedIn) throw new Error('Kane CLI is installed but not logged in (run kane-cli login in the Render Shell)')
  if (h.ok !== true) throw new Error(`health ok=false (${line})`)
  return line
})

await check('app shell is served', () => html('/', 'id="root"'))
await check('deep link /r/<token> serves the app shell', () => html('/r/live-check-token', 'id="root"'))
await check('demo shop page is served', () => html('/demo/', 'Northwind Supply'))
await check('demo billing page is served', () => html('/demo/billing.html', 'download-invoice'))

if (health && full) {
  const project = await check('create a project pointing at the deployed demo site', async () => {
    const { project: created } = await json('/api/projects', {
      method: 'POST',
      body: {
        name: `Live check ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
        clientName: 'Live check',
        siteUrl: `${base}/demo/`,
        criteria: [
          'Add the Field Tool Roll to the cart and confirm the cart badge shows 1.',
          'Create an account with the email test@example.com and the password Secret123! and confirm the dashboard greets that email.',
          'Open the Billing page and click Download invoice, then confirm a PDF file is downloaded.',
        ],
      },
    })
    return created
  })
  if (project) {
    const started = await check('start a run', async () => {
      const { run } = await json(`/api/projects/${project.id}/runs`, { method: 'POST', body: {} })
      return run
    })

    if (started) {
      const detail = await check(`run finishes within ${Math.round(runTimeoutMs / 1000)}s`, async () => {
        const deadline = Date.now() + runTimeoutMs
        let last = 'running'
        while (Date.now() < deadline) {
          await sleep(5000)
          const current = await json(`/api/runs/${started.id}`)
          const states = current.results.map((r) => r.status).join(',')
          if (states !== last) {
            console.log(`      ${states}`)
            last = states
          }
          if (current.run.status !== 'running') return current
        }
        throw new Error(`run ${started.id} was still running after ${runTimeoutMs / 1000}s`)
      })

      if (detail) {
        await check('two criteria pass and only the invoice check fails', async () => {
          const results = detail.results.map((r) => ({ status: r.status, text: r.criterion.text }))
          const passed = results.filter((r) => r.status === 'passed').length
          const failed = results.filter((r) => r.status === 'failed').length
          if (passed !== 2 || failed !== 1) {
            throw new Error(
              `expected 2 passed / 1 failed, got ${results.map((r) => `${r.status}: ${r.text.slice(0, 40)}`).join(' | ')}`,
            )
          }
          if (detail.run.status !== 'failed') throw new Error(`run status was ${detail.run.status}`)
          return 'cart + signup passed, invoice failed as designed'
        })

        await check('every check has a screenshot that downloads', async () => {
          const withShots = detail.results.filter((r) => r.screenshotUrl)
          if (withShots.length !== detail.results.length) {
            throw new Error(`${withShots.length}/${detail.results.length} checks have a screenshot`)
          }
          const res = await request(withShots[0].screenshotUrl, { timeoutMs: 30_000 })
          const bytes = (await res.arrayBuffer()).byteLength
          const type = res.headers.get('content-type') || ''
          if (!res.ok) throw new Error(`screenshot -> ${res.status}`)
          if (!type.startsWith('image/')) throw new Error(`screenshot content-type was ${type}`)
          if (bytes < 5000) throw new Error(`screenshot was only ${bytes} bytes`)
          return `${withShots.length} screenshots, ${type}, ${Math.round(bytes / 1024)} KB each`
        })

        await check('public report shows the results', async () => {
          const report = await json(`/api/public/${project.publicToken}`)
          if (report.results?.length !== detail.results.length) {
            throw new Error(`public report has ${report.results?.length ?? 0} results`)
          }
          return `${report.results.length} results at /r/${project.publicToken}`
        })

        await check('client can sign off through the public link', async () => {
          await json(`/api/public/${project.publicToken}/approve`, {
            method: 'POST',
            body: { name: 'Live check', note: 'Automated deploy verification.' },
          })
          const report = await json(`/api/public/${project.publicToken}`)
          const signoff = report.signoff ?? report.latest?.signoff
          if (signoff?.approvedBy !== 'Live check') {
            throw new Error(`signoff missing after approve: ${JSON.stringify(signoff)}`)
          }
          return `approved by ${signoff.approvedBy}`
        })

        console.log(`\nProject report: ${base}/r/${project.publicToken}`)
      }
    }
  }
}

const passed = summary.filter((s) => s.ok).length
console.log(`\n${passed}/${summary.length} checks passed`)
process.exit(failures === 0 ? 0 : 1)
