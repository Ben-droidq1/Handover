import { useEffect, useState } from 'react'
import { api, clientReportUrl } from '../api/client'
import { CriterionEditor } from '../components/CriterionEditor'
import { IconCopy, IconExternal, PassBar, ScoreRing, Skeleton, Spinner, StatusPill } from '../components/ui'
import { formatDateTime, isRunActive, passRate, plural, relativeTime, runDisplayStatus } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { Link, navigate } from '../router'

function CopyLink({ token }) {
  const [copied, setCopied] = useState(false)
  const url = clientReportUrl(token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy the client report link', url)
    }
  }

  return (
    <div className="link-row">
      <code className="link-box" title={url}>
        {url}
      </code>
      <button type="button" className="btn btn-sm" onClick={copy}>
        <IconCopy width={14} height={14} />
        {copied ? 'Copied' : 'Copy'}
      </button>
      <a className="btn btn-sm btn-ghost" href={`/r/${token}`} target="_blank" rel="noreferrer">
        <IconExternal width={14} height={14} />
        Open
      </a>
    </div>
  )
}

export default function ProjectDetail({ id }) {
  const { data, loading, error, reload } = useAsync(() => api.getProject(id), [id])
  const project = data?.project

  const [items, setItems] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (!project || dirty) return
    setItems(project.criteria.map((criterion) => ({ key: criterion.id, text: criterion.text })))
  }, [project, dirty])

  async function persist() {
    const criteria = items.map((item) => item.text.trim()).filter(Boolean)
    if (!criteria.length) throw new Error('Keep at least one criterion.')
    const { project: updated } = await api.updateProject(id, {
      name: project.name,
      clientName: project.clientName,
      siteUrl: project.siteUrl,
      criteria,
    })
    setItems(updated.criteria.map((criterion) => ({ key: criterion.id, text: criterion.text })))
    setDirty(false)
    await reload()
  }

  async function save() {
    setFormError(null)
    setSaving(true)
    try {
      await persist()
      setNotice('Saved')
      setTimeout(() => setNotice(null), 1800)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function runNow() {
    setFormError(null)
    setBusy(true)
    try {
      if (dirty) await persist()
      const { run } = await api.startRun(id)
      navigate(`/runs/${run.id}`)
    } catch (err) {
      setFormError(err.message)
      setBusy(false)
    }
  }

  if (loading && !project) {
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
            <strong>Could not load this project</strong>
            <p>{error.message}</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!project) return null

  const lastRun = project.runs[0] ?? null
  const running = isRunActive(lastRun)

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← All projects
      </Link>

      <header className="detail-head">
        <div>
          <p className="eyebrow">{project.clientName || 'No client set'}</p>
          <h1>{project.name}</h1>
          <a className="url-link" href={project.siteUrl} target="_blank" rel="noreferrer">
            {project.siteUrl}
          </a>
        </div>
        <div className="detail-actions">
          {dirty ? <span className="dirty-dot">Unsaved changes</span> : null}
          <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>
            {saving ? <Spinner /> : null}
            {notice || (saving ? 'Saving…' : 'Save changes')}
          </button>
          <button type="button" className="btn btn-primary" onClick={runNow} disabled={busy || running}>
            {busy ? <Spinner /> : null}
            {running ? 'Run in progress' : busy ? 'Starting…' : 'Run checks'}
          </button>
        </div>
      </header>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="split">
        <div className="stack gap-20">
          <section className="card card-pad">
            <CriterionEditor
              items={items}
              onChange={(next) => {
                setItems(next)
                setDirty(true)
              }}
              disabled={saving || busy}
            />
          </section>

          <section className="card card-pad">
            <div className="section-head">
              <h2 className="section-title">Run history</h2>
              <span className="muted small">{project.runs.length} runs</span>
            </div>

            {project.runs.length === 0 ? (
              <p className="muted">No runs yet. Hit “Run checks” and Kane will verify every criterion in a real browser.</p>
            ) : (
              <ul className="run-list">
                {project.runs.map((run) => (
                  <li key={run.id}>
                    <Link to={`/runs/${run.id}`} className="run-row">
                      <StatusPill status={runDisplayStatus(run)} size="sm" />
                      <span className="run-when">{formatDateTime(run.startedAt)}</span>
                      <span className="run-ratio">
                        {run.passed}/{run.total} passed
                      </span>
                      {run.signoff ? <span className="pill pill-ok pill-sm">Signed off</span> : null}
                      <span className="run-arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="aside-rail stack gap-16">
          <section className="card card-pad rail-card">
            <div className="section-head">
              <h3>Latest run</h3>
              {lastRun ? <span className="muted small">{relativeTime(lastRun.startedAt)}</span> : null}
            </div>

            {lastRun ? (
              <>
                <div className="rail-ring">
                  <ScoreRing passed={lastRun.passed} total={lastRun.total} size={92} />
                  <div className="stack gap-8">
                    <StatusPill status={runDisplayStatus(lastRun)} />
                    <p className="muted small">
                      {lastRun.failed
                        ? lastRun.broken >= lastRun.failed
                          ? `${lastRun.failed} ${plural(lastRun.failed, 'check')} could not run. Nothing on the site is at fault; the report explains the fix.`
                          : `${lastRun.failed} ${plural(lastRun.failed, 'check')} ${lastRun.failed === 1 ? 'needs' : 'need'} attention before the client sees it.`
                        : 'Everything your client asked for is proven.'}
                    </p>
                  </div>
                </div>
                <PassBar passed={lastRun.passed} total={lastRun.total} />
                <Link to={`/runs/${lastRun.id}`} className="btn btn-block">
                  View run
                </Link>
              </>
            ) : (
              <p className="muted small">No runs yet. The first run takes about a minute.</p>
            )}
          </section>

          <section className="card card-pad rail-card">
            <h3>Client report</h3>
            <p className="muted small">
              Anyone with this link can see the evidence and approve. No login needed.
            </p>
            <CopyLink token={project.publicToken} />
            <p className="fineprint">
              {lastRun ? `Shows the run from ${formatDateTime(lastRun.startedAt)}.` : 'It will show the first run once it finishes.'}
            </p>
          </section>

          <section className="card card-pad rail-card">
            <h3>Before the client sees it</h3>
            <p className="muted small">
              {lastRun
                ? `Pass rate ${passRate(lastRun.passed, lastRun.total)}% · ${plural(project.runs.length, 'run')} recorded.`
                : 'Run the checks, look at the failing screenshots, then send the link.'}
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
