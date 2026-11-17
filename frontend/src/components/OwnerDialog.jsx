import { useEffect, useState } from 'react'
import { setOwnerPassword, useOwnerPassword } from '../api/auth'
import { IconLock } from './ui'

export function OwnerDialog() {
  const saved = useOwnerPassword()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [value, setValue] = useState('')

  useEffect(() => {
    const onOpen = (event) => {
      setMessage(event.detail?.message || 'Write access is protected by the owner password.')
      setValue(saved)
      setOpen(true)
    }
    window.addEventListener('handover:owner', onOpen)
    return () => window.removeEventListener('handover:owner', onOpen)
  }, [saved])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-icon">
          <IconLock width={18} height={18} />
        </div>
        <h2 id="owner-title">Owner access</h2>
        <p className="muted">{message}</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            setOwnerPassword(value)
            setOpen(false)
          }}
          className="stack"
        >
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              placeholder="OWNER_PASSWORD from your .env"
            />
          </label>
          <div className="row gap-8 end">
            {saved ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setOwnerPassword('')
                  setValue('')
                }}
              >
                Forget
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
              Save
            </button>
          </div>
        </form>
        <p className="fineprint">Stored in this browser only. Clients never need it — they use the report link.</p>
      </div>
    </div>
  )
}
