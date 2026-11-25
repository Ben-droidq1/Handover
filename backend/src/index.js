import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { config } from './config.js'
import { db } from './db.js'
import { asyncRoute } from './errors.js'
import { getHealth } from './health.js'
import { killActiveRuns } from './kane.js'
import { ensureKaneLogin } from './login.js'
import { publicRouter } from './routes/public.js'
import { projectsRouter } from './routes/projects.js'
import { runsRouter } from './routes/runs.js'
import { recoverInterruptedRuns } from './store.js'

const recovered = recoverInterruptedRuns()
if (recovered.runs || recovered.results) {
  console.warn(
    `[startup] marked ${recovered.runs} interrupted run(s) and ${recovered.results} check(s) as failed`,
  )
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))

app.get(
  '/api/health',
  asyncRoute(async (req, res) => {
    res.json(await getHealth({ force: req.query.force === '1' }))
  }),
)

app.use('/api', projectsRouter)
app.use('/api', runsRouter)
app.use('/api/public', publicRouter)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' })
})

// The deliberately broken demo site used by the hackathon walkthrough.
app.use('/demo', express.static(config.demoDir, { extensions: ['html'], index: 'index.html' }))

if (fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
  app.use(express.static(config.frontendDist, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next()
    return res.sendFile(path.join(config.frontendDist, 'index.html'))
  })
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'handover-api',
      message: 'API is running. Frontend is not built: run "npm run dev" in ../frontend.',
      demo: '/demo/',
      health: '/api/health',
    })
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (res.headersSent) return

  // body-parser rejects malformed JSON before any route sees the request.
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request body is not valid JSON.', code: 'bad_request' })
    return
  }
  if (error.type === 'entity.too.large') {
    res.status(413).json({ error: 'The request body is too large.', code: 'too_large' })
    return
  }

  const status = error.status || error.statusCode || 500
  if (status >= 500) console.error('[api]', error)
  res.status(status).json({ error: error.message || 'Server error.', code: error.code })
})

const server = app.listen(config.port, () => {
  console.log(`[handover] API listening on http://localhost:${config.port}`)
  console.log(`[handover] demo site on http://localhost:${config.port}/demo/`)
  console.log(
    `[handover] concurrency=${config.maxConcurrency} timeout=${config.kaneTimeoutSec}s maxSteps=${config.kaneMaxSteps} ownerGate=${config.ownerPassword ? 'on' : 'off'}`,
  )
  if (!fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
    console.log('[handover] frontend/dist not found — use the Vite dev server on :5173')
  }

  // Runs after the port is open so the platform's health check can connect
  // while Kane logs in. Failure is reported, never fatal.
  ensureKaneLogin()
    .then((result) => {
      if (result.alreadyLoggedIn) console.log('[kane] already logged in')
      else if (result.attempted && result.ok) console.log('[kane] logged in from KANE_USERNAME/KANE_ACCESS_KEY')
      else if (result.attempted) console.warn(`[kane] login from env failed: ${result.reason}`)
      else if (!config.kaneUsername || !config.kaneAccessKey) {
        console.log('[kane] no KANE_USERNAME/KANE_ACCESS_KEY set; using the existing CLI profile')
      }
    })
    .catch((error) => console.warn(`[kane] login from env failed: ${error.message}`))
    .finally(() => {
      // Warm the health cache so the first request does not wait on two CLI
      // startups (which can take 30s when update checks are slow).
      getHealth().catch(() => {})
    })
})

function shutdown(signal) {
  console.log(`\n[handover] ${signal} received, stopping…`)
  killActiveRuns()
  server.close(() => {
    try {
      db.close()
    } catch {
      /* already closed */
    }
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
