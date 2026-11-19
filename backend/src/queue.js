import path from 'node:path'
import { config, paths } from './config.js'
import { collectEvidence } from './evidence.js'
import { runCriterion } from './kane.js'
import * as store from './store.js'

/**
 * Runs every criterion of a run, at most `MAX_CONCURRENCY` browsers at a time.
 * One failing criterion never stops the others, and nothing here is allowed to
 * throw into the request that started the run.
 */

function createLimiter(limit) {
  let active = 0
  const queue = []

  const pump = () => {
    if (active >= limit || queue.length === 0) return
    active += 1
    const { task, resolve, reject } = queue.shift()
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active -= 1
        pump()
      })
  }

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject })
      pump()
    })
}

const limit = createLimiter(config.maxConcurrency)
const activeRuns = new Set()

export function enqueueRun(runId) {
  if (activeRuns.has(runId)) return
  activeRuns.add(runId)

  setImmediate(() => {
    executeRun(runId)
      .catch((error) => {
        console.error(`[run ${runId}] crashed:`, error)
        try {
          store.failRun(runId, `The server hit an unexpected error: ${error.message}`)
        } catch (inner) {
          console.error(`[run ${runId}] could not record the failure:`, inner)
        }
      })
      .finally(() => activeRuns.delete(runId))
  })
}

async function executeRun(runId) {
  const context = store.getRunContext(runId)
  if (context.status !== 'queued') return

  store.markRunRunning(runId)
  const results = store.getRunnableResults(runId)
  console.log(`[run ${runId}] starting ${results.length} checks against ${context.site_url}`)

  await Promise.all(
    results.map((result) =>
      limit(() => runOne(result, context.site_url)),
    ),
  )

  const summary = store.recomputeRun(runId)
  console.log(`[run ${runId}] finished: ${summary.status} (${summary.passed}/${summary.total})`)
}

async function runOne(result, siteUrl) {
  const logPath = path.join(paths.logs, `${result.id}.ndjson`)
  const liveSteps = []

  const onEvent = (event) => {
    if (event.type || typeof event.step !== 'number') return
    const existing = liveSteps.find((step) => step.n === event.step)
    if (existing) {
      existing.status = event.status
      existing.remark = event.remark ?? existing.remark
    } else {
      liveSteps.push({ n: event.step, status: event.status, remark: event.remark ?? '' })
    }
    try {
      store.updateResultSteps(result.id, liveSteps.slice(0, 40))
    } catch (error) {
      console.error(`[result ${result.id}] could not save step progress:`, error.message)
    }
  }

  store.markResultRunning(result.id)

  try {
    const outcome = await runCriterion({
      siteUrl,
      objective: result.criterion_text,
      logPath,
      onEvent,
      // Each concurrent check gets its own working dir and Chrome user-data-dir.
      // Sharing either one makes parallel runs close each other's page
      // ("TargetClosedError") because Kane keeps session state in the cwd.
      workDir: path.join(paths.work, result.id),
      profileDir: path.join(paths.work, result.id, 'chrome'),
    })

    const evidence = await collectEvidence({
      evidenceFile: outcome.evidenceFile,
      resultId: result.id,
      evidenceDir: paths.evidence,
      shotsDir: paths.shots,
    })

    store.finishResult(result.id, {
      ...outcome,
      steps: outcome.steps.length ? outcome.steps : liveSteps,
      screenshotPath: evidence.screenshotPath,
      evidencePath: evidence.evidencePath,
      logPath,
    })
  } catch (error) {
    console.error(`[result ${result.id}] failed:`, error)
    store.failResult(result.id, `The check could not be completed: ${error.message}`)
  }
}
