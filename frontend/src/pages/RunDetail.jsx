import { api } from '../api/client'
import { ResultCard } from '../components/ResultCard'
import { PassBar, Skeleton, Spinner, StatusPill } from '../components/ui'
import { formatDateTime, formatDuration, isRunActive, runDisplayStatus } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { Link, navigate } from '../router'
import { useState } from 'react'

export default function RunDetail({ id }) {
  const { data, loading, error, reload } = useAsync(() => api.getRun(id), [id], {
    pollMs: 2000,
    shouldPoll: (value) => (value ? isRunActive(value.run) : false),
  })
  const [starting, setStarting] = useState(false)
  const [rerunError, setRerunError] = useState(null)

  if (loading && !data) {
    return (
      <div className="page">
        <div className="card card-pad">
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          ← All projects
        </Link>
        <div className="note note-bad">
          <div>
            <strong>Could not load this run</strong>
            <p>{error.message}</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { run, results } = data
  const project = run.project
  const active = isRunActive(run)
  const finished = results.filter((result) => !isRunActive({ status: result.status })).length
  const passed = results.filter((result) => result.status === 'passed').length
  const failed = results.filter((result) => result.status === 'failed').length
  const broken = results.filter((result) => result.status === 'error' || result.status === 'timeout').length
  const slowest = results.reduce((max, result) => Math.max(max, result.durationS ?? 0), 0)

  async function rerun() {
    setStarting(true)
    setRerunError(null)
    try {
      const response = await api.startRun(project.id)
      navigate(`/runs/${response.run.id}`)
    } catch (err) {
      setRerunError(err.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="page run-page">
      <Link to={`/projects/${project.id}`} className="back-link">
        ← {project.name}
      </Link>

      <header className="detail-head">
        <div>
          <p className="eyebrow">
            Run · {formatDateTime(run.startedAt)}
          </p>
          <h1 className="run-title">
            {active
              ? 'Checking the delivery'
              : passed === results.length
                ? 'Every check passed'
                : failed > 0
                  ? 'Some checks need attention'
                  : 'Kane could not run these checks'}
            <StatusPill status={runDisplayStatus({ status: run.status, failed: failed + broken, broken })} />
          </h1>
          <p className="lede">
            {active
              ? `Kane is working through ${results.length} criteria, up to three at a time. This page updates live.`
              : `${passed}/${results.length} criteria passed${failed ? `, ${failed} failed` : ''}${broken ? `, ${broken} could not run` : ''}.`}
          </p>
        </div>
        <div className="detail-actions">
          <Link to={`/r/${project.publicToken}`} target="_blank" rel="noreferrer" className="btn">
            Client view
          </Link>
          <button type="button" className="btn btn-primary" onClick={rerun} disabled={starting || active}>
            {starting ? <Spinner /> : null}
            {active ? 'Running…' : 'Run again'}
          </button>
        </div>
      </header>

      {rerunError ? <p className="form-error">{rerunError}</p> : null}

      <section className="card card-pad run-summary">        <div className="summary-stats">
          <div>
            <span className="stat-label">Passed</span>
            <strong className="ok-text">{passed}</strong>
          </div>
          <div>
            <span className="stat-label">Failed</span>
            <strong className={failed ? 'bad-text' : ''}>{failed}</strong>
          </div>
          <div>
            <span className="stat-label">Couldn&apos;t run</span>
            <strong className={broken ? 'warn-text' : ''}>{broken}</strong>
          </div>
          <div>
            <span className="stat-label">Slowest check</span>
            <strong>{slowest ? formatDuration(slowest) : '—'}</strong>
          </div>
        </div>
        <PassBar passed={passed} total={results.length} tone={failed || broken ? 'bad' : undefined} />
        {active ? (
          <p className="muted small progress-note">
            <Spinner size={12} /> {finished} of {results.length} finished — you can leave this page, the run keeps going.
          </p>
        ) : null}
      </section>

      <div className="results">
        {results.map((result, index) => (
          <ResultCard key={result.id} result={result} index={index + 1} />
        ))}
      </div>
    </div>
  )
}
