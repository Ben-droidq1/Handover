import { passRate } from '../lib/format'

/* ---------- icons (inline, no icon dependency) ---------- */

const base = { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconCheck(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  )
}

export function IconX(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

export function IconClock(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" />
    </svg>
  )
}

export function IconAlert(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M10 3.5l7 12H3l7-12z" />
      <path d="M10 8.5v3M10 14h.01" />
    </svg>
  )
}

export function IconLock(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 016 0V9" />
    </svg>
  )
}

export function IconArrow(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  )
}

export function IconExternal(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M8 4H4.8A1.8 1.8 0 003 5.8v9.4A1.8 1.8 0 004.8 17h9.4A1.8 1.8 0 0016 15.2V12" />
      <path d="M12 3h5v5M17 3l-7 7" />
    </svg>
  )
}

export function IconCopy(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="7" y="7" width="9" height="10" rx="2" />
      <path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </svg>
  )
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M4 6h12M8 3.5h4M6 6l.7 10.2a1.5 1.5 0 001.5 1.3h3.6a1.5 1.5 0 001.5-1.3L14 6" />
    </svg>
  )
}

export function IconShield(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M10 2.8l6 2.3v5c0 3.4-2.5 5.9-6 7.1-3.5-1.2-6-3.7-6-7.1v-5l6-2.3z" />
      <path d="M7.4 10l1.9 1.9 3.4-3.8" />
    </svg>
  )
}

/* ---------- primitives ---------- */

export function Spinner({ size = 14, className = '' }) {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}

const STATUS_COPY = {
  queued: { label: 'Queued', tone: 'muted', icon: IconClock },
  running: { label: 'Running', tone: 'accent', icon: null },
  passed: { label: 'Passed', tone: 'ok', icon: IconCheck },
  failed: { label: 'Failed', tone: 'bad', icon: IconX },
  error: { label: "Couldn't run", tone: 'warn', icon: IconAlert },
  timeout: { label: 'Timed out', tone: 'warn', icon: IconClock },
}

export function StatusPill({ status, size = 'md' }) {
  const copy = STATUS_COPY[status] ?? { label: status, tone: 'muted', icon: IconClock }
  const Icon = copy.icon
  return (
    <span className={`pill pill-${copy.tone} pill-${size}`}>
      {status === 'running' ? <Spinner size={size === 'sm' ? 10 : 12} /> : Icon ? <Icon width={size === 'sm' ? 12 : 14} height={size === 'sm' ? 12 : 14} /> : null}
      {copy.label}
    </span>
  )
}

export function PassBar({ passed, total, tone }) {
  const pct = passRate(passed, total)
  const resolved = tone ?? (passed === total && total > 0 ? 'ok' : 'bad')
  return (
    <div className="passbar" role="img" aria-label={`${passed} of ${total} checks passed`}>
      <div className={`passbar-fill passbar-${resolved}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ScoreRing({ passed, total, size = 108, label = 'checks passed' }) {
  const pct = passRate(passed, total)
  const stroke = 9
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const perfect = total > 0 && passed === total
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={perfect ? 'ring-value ring-ok' : 'ring-value ring-bad'}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label">
        <strong>
          {passed}/{total || 0}
        </strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">
        <IconShield width={22} height={22} />
      </div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  )
}

export function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${92 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="note note-bad" role="alert">
      <div>
        <strong>{error.code === 'network' ? 'Backend not reachable' : 'Something went wrong'}</strong>
        <p>{error.message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={() => onRetry()}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
