import { useState } from 'react'
import { api } from '../api/client'
import { ApproveBox } from '../components/ApproveBox'
import { BrandMark } from '../components/Header'
import { ResultCard } from '../components/ResultCard'
import { EmptyState, ErrorNote, ScoreRing, Skeleton, StatusPill } from '../components/ui'
import { formatDate, formatDateTime, passRate, plural, runDisplayStatus } from '../lib/format'
import { useAsync } from '../lib/useAsync'

function ReportTopbar() {
  return (
    <header className="report-topbar">
      <div className="report-topbar-inner">
        <span className="brand brand-static">
          <BrandMark size={24} />
          <span>Handover</span>
        </span>
        <span className="muted small">Delivery report</span>
      </div>
    </header>
  )
}

export default function PublicReport({ token }) {
  const { data, loading, error, reload } = useAsync(() => api.getPublicReport(token), [token])
  const [signoff, setSignoff] = useState(null)

  if (loading && !data) {
    return (
      <div className="report">
        <ReportTopbar />
        <main className="report-main narrow">
          <div className="card card-pad">
            <Skeleton lines={6} />
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="report">
        <ReportTopbar />
        <main className="report-main narrow">
          <ErrorNote error={error} onRetry={reload} />
        </main>
      </div>
    )
  }

  if (!data) return null

  const { project, run, results, history } = data
  const currentSignoff = signoff ?? data.signoff
  const failed = results.filter((result) => result.status === 'failed').length
  const broken = results.filter((result) => result.status === 'error' || result.status === 'timeout').length
  const issues = failed + broken
  const passed = results.filter((result) => result.status === 'passed').length

  const verdictTitle =
    issues === 0
      ? 'Every criterion passed in a real browser'
      : failed > 0
        ? `${failed} ${plural(failed, 'criterion', 'criteria')} failed in the browser${broken ? ` · ${broken} could not run` : ''}`
        : `${broken} ${plural(broken, 'criterion', 'criteria')} could not be checked`

  const verdictBody =
    issues === 0
      ? 'Each check below was performed by Kane CLI in Chrome, with screenshots captured at the final step.'
      : failed > 0
        ? 'Each failed check includes a screenshot of where Kane stopped and the reason. Approve only if what remains is acceptable for this handover.'
        : 'Kane could not start these checks — usually Chrome or the Kane login. The report explains what to fix; they can be run again without changing the site.'

  return (
    <div className="report">
      <ReportTopbar />

      <main className="report-main">
        {!run ? (
          <div className="card">
            <EmptyState title="No checks have run yet">
              {project.name} has a checklist ready, but the checks have not been run. Ask the sender for a fresh link
              once they have run them.
            </EmptyState>
          </div>
        ) : (
          <>
            <section className="report-hero card">
              <div className="report-hero-copy">
                <p className="eyebrow">{project.clientName || 'Delivery report'}</p>
                <h1>{project.name}</h1>
                <p className="muted">
                  Run on {formatDateTime(run.startedAt)} · {results.length} {plural(results.length, 'acceptance criterion', 'acceptance criteria')}
                </p>
                <a className="url-link" href={project.siteUrl} target="_blank" rel="noreferrer">
                  {project.siteUrl}
                </a>
              </div>
              <ScoreRing passed={passed} total={results.length} size={116} label="criteria proven" />
            </section>

            <div className={`verdict ${issues ? (currentSignoff ? 'verdict-warn' : 'verdict-bad') : 'verdict-ok'}`}>
              <span className="verdict-mark" aria-hidden="true">
                {issues ? '!' : '✓'}
              </span>
              <div>
                <strong>{verdictTitle}</strong>
                <p>{verdictBody}</p>
              </div>
              {run.status === 'running' ? <StatusPill status="running" /> : null}
            </div>

            <div className="report-section-head">
              <h2>What was checked</h2>
              <span className="muted small">
                {passRate(passed, results.length)}% pass rate
              </span>
            </div>

            <div className="results">
              {results.map((result, index) => (
                <ResultCard key={result.id} result={result} index={index + 1} variant="client" />
              ))}
            </div>

            <ApproveBox
              token={token}
              signoff={currentSignoff}
              failureCount={issues}
              onApproved={(next) => setSignoff(next)}
            />

            {history.length > 1 ? (
              <section className="history">
                <div className="report-section-head">
                  <h2>Run history</h2>
                  <span className="muted small">Newest first</span>
                </div>
                <div className="card">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Run</th>
                        <th>Result</th>
                        <th>Passed</th>
                        <th>Sign-off</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry, index) => (
                        <tr key={entry.runId}>
                          <td>
                            {formatDate(entry.startedAt)}
                            {index === 0 ? <span className="pill pill-muted pill-sm current-tag">current</span> : null}
                          </td>
                          <td>
                            <StatusPill status={runDisplayStatus(entry)} size="sm" />
                          </td>
                          <td>
                            {entry.passed}/{entry.total}
                          </td>
                          <td className="muted">
                            {entry.signoff ? `Approved by ${entry.signoff.approvedBy}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <footer className="report-foot">
              <p>
                Verified with <strong>Kane CLI</strong> · every run seals an evidence pack with screenshots, browser
                logs, and a failure record.
              </p>
              <p className="fineprint">
                This link is unique to this delivery. Anyone with it can view the report and approve it.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}
