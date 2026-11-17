import { config } from './config.js'
import { badRequest } from './errors.js'

export function textField(value, label, { max = 500, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${label} is required.`)
    return undefined
  }
  if (typeof value !== 'string') throw badRequest(`${label} must be text.`)
  const trimmed = value.trim()
  if (!trimmed) {
    if (required) throw badRequest(`${label} is required.`)
    return ''
  }
  if (trimmed.length > max) throw badRequest(`${label} must be ${max} characters or fewer.`)
  return trimmed
}

export function httpUrl(value, label = 'Site URL') {
  const raw = textField(value, label, { max: 2048 })
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw badRequest(`${label} must be a full URL, for example https://example.com.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest(`${label} must start with http:// or https://.`)
  }
  return raw
}

export function criteriaList(value) {
  if (!Array.isArray(value)) throw badRequest('criteria must be an array of strings.')
  const cleaned = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (trimmed) cleaned.push(trimmed)
  }
  if (cleaned.length === 0) throw badRequest('Add at least one acceptance criterion.')
  if (cleaned.length > config.maxCriteria) {
    throw badRequest(`A project can have at most ${config.maxCriteria} criteria.`)
  }
  for (const criterion of cleaned) {
    if (criterion.length > 500) throw badRequest('Each criterion must be 500 characters or fewer.')
  }
  return cleaned
}

export function projectPatch(body) {
  const patch = {}
  if (body.name !== undefined) patch.name = textField(body.name, 'Project name', { max: 120 })
  if (body.clientName !== undefined) {
    patch.clientName = textField(body.clientName, 'Client name', { max: 120, required: false })
  }
  if (body.siteUrl !== undefined) patch.siteUrl = httpUrl(body.siteUrl)
  if (body.criteria !== undefined) patch.criteria = criteriaList(body.criteria)
  if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.')
  return patch
}
