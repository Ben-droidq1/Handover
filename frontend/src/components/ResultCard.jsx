import { formatDuration } from '../lib/format'
import { Screenshot } from './Screenshot'
import { StatusPill } from './ui'

/** Never claim a finished check is still "waiting to start". */
function leadLine(result) {
  if (result.oneLiner) return result.oneLiner
  switch (result.status) {
    case 'queued':
      return 'Waiting to start…'
    case 'running':
      return 'Kane is checking this in Chrome now…'
    case 'passed':
      return 'This criterion passed.'
    case 'failed':
      return 'This criterion did not pass.'
    case 'timeout':
      return 'This check ran out of time.'
    case 'error':
      return 'This check could not be completed.'
    default:
      return ''
  }
}

export function ResultCard({ result, index, variant = 'owner' }) {
  const failed = result.status === 'failed' || result.status === 'error' || result.status === 'timeout'
  const showDetails = variant === 'owner' && result.status !== 'queued'
  const lead = leadLine(result)

  return (
    <article className={`result ${variant} ${failed ? 'is-failed' : ''}`} data-status={result.status}>
      <div className="result-rail" aria-hidden="true" />

      <div className="result-main">
        <header className="result-head">
          <div className="result-title">
            <span className="result-index">{index}</span>
            <h3>{result.criterion?.text ?? 'Criterion'}</h3>
          </div>
          <StatusPill status={result.status} />
        </header>

        {lead ? <p className={`result-oneliner ${failed ? 'is-failed' : ''}`}>{lead}</p> : null}

        {result.errorMessage ? (
          <div className="note note-bad result-error">
            <div>
              <strong>Kane could not complete this check</strong>
              <p>{result.errorMessage}</p>
            </div>
          </div>
        ) : null}

        <div className="result-body">
          <div className="result-shot">
            <Screenshot
              src={result.screenshotUrl}
              alt={`Screenshot of the final step: ${result.criterion?.text ?? ''}`}
              variant={variant === 'client' ? 'large' : 'thumb'}
            />
          </div>

          <div className="result-side">
            <dl className="result-meta">
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(result.durationS)}</dd>
              </div>
              <div>
                <dt>Steps</dt>
                <dd>{result.steps?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{result.reason || '—'}</dd>
              </div>
            </dl>

            {result.testUrl ? (
              <a className="link-quiet" href={result.testUrl} target="_blank" rel="noreferrer">
                Open in Test Manager
              </a>
            ) : null}
          </div>
        </div>

        {showDetails && result.steps?.length ? (
          <details className="steps">
            <summary>
              What Kane did <span className="muted">({result.steps.length} steps)</span>
            </summary>
            <ol className="step-list">
              {result.steps.map((step) => (
                <li key={step.n} className={`step step-${step.status}`}>
                  <span className="step-dot" aria-hidden="true" />
                  <span className="step-n">{step.n}</span>
                  <span className="step-remark">{step.remark}</span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </article>
  )
}
