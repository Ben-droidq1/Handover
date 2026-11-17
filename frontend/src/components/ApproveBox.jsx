import { useState } from 'react'
import { api } from '../api/client'
import { formatDateTime, plural } from '../lib/format'
import { IconCheck, Spinner } from './ui'

export function ApproveBox({ token, signoff, failureCount = 0, onApproved }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (signoff) {
    return (
      <section className="signoff is-approved">
        <div className="signoff-badge">
          <IconCheck width={18} height={18} />
        </div>
        <div>
          <h3>Delivery approved</h3>
          <p className="muted">
            <strong>{signoff.approvedBy}</strong> signed off on {formatDateTime(signoff.createdAt)}.
          </p>
          {signoff.note ? <blockquote className="signoff-note">“{signoff.note}”</blockquote> : null}
        </div>
      </section>
    )
  }

  const canSubmit = name.trim().length > 1 && (failureCount === 0 || accepted) && !busy

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const response = await api.approve(token, { name, note })
      onApproved?.(response.signoff)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="signoff">
      <h3>Approve this delivery</h3>
      <p className="muted">
        {failureCount > 0
          ? `${failureCount} ${plural(failureCount, 'check')} did not pass. You can still approve and note what follows up.`
          : 'Every check passed. Sign off to close the handover.'}
      </p>

      <form onSubmit={submit} className="signoff-form">
        <label className="field">
          <span className="field-label">Your name</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jane Doe, Northwind Ltd."
            autoComplete="name"
          />
        </label>

        <label className="field">
          <span className="field-label">Note for the record (optional)</span>
          <textarea
            className="input textarea"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Looks good — invoice download can follow in the next sprint."
          />
        </label>

        {failureCount > 0 ? (
          <label className="check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>I accept the outstanding {plural(failureCount, 'check')}</span>
          </label>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
          {busy ? <Spinner /> : null}
          {busy ? 'Recording approval…' : 'Approve delivery'}
        </button>
        <p className="fineprint">Your name and the date are recorded with this run. No account needed.</p>
      </form>
    </section>
  )
}
