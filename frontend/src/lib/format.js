const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_ONLY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDateTime(value) {
  if (!value) return '—'
  return DATE_TIME.format(new Date(value))
}

export function formatDate(value) {
  if (!value) return '—'
  return DATE_ONLY.format(new Date(value))
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rest = s % 60
  return rest ? `${m}m ${rest}s` : `${m}m`
}

export function relativeTime(value) {
  if (!value) return 'never'
  const then = new Date(value).getTime()
  const diff = Date.now() - then
  if (Number.isNaN(then)) return 'never'
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

export function passRate(passed, total) {
  if (!total) return 0
  return Math.round((passed / total) * 100)
}

export function plural(count, one, many = `${one}s`) {
  return count === 1 ? one : many
}

export function isRunActive(run) {
  return run?.status === 'queued' || run?.status === 'running'
}

/**
 * A stored run is only passed or failed, but "failed" hides two very different
 * stories: the delivered site really is broken, or Kane never got to look at it
 * (Chrome missing, CLI not logged in). Only the first is the freelancer's fault,
 * so runs made up entirely of error/timeout results read as "couldn't run".
 */
export function runDisplayStatus(run) {
  if (!run || run.status !== 'failed') return run?.status
  const broken = run.broken ?? 0
  const failed = run.failed ?? 0
  return failed > 0 && failed === broken ? 'error' : run.status
}

export function isFinished(status) {
  return status === 'passed' || status === 'failed' || status === 'error' || status === 'timeout'
}

export function initializeLabel(name) {
  const parts = String(name || '?')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
