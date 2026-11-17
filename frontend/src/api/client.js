import { getOwnerPassword, openOwnerDialog } from './auth'
import { mockApi } from './mock'

/**
 * API contract (see backend/src/routes):
 *   GET    /api/projects                     -> { projects: ProjectSummary[] }
 *   POST   /api/projects                     -> { project }            [owner]
 *   GET    /api/projects/:id                 -> { project }            (criteria + runs)
 *   PATCH  /api/projects/:id                 -> { project }            [owner]
 *   POST   /api/projects/:id/runs            -> { run }                [owner]
 *   GET    /api/runs/:id                     -> { run, results }
 *   GET    /api/public/:token                -> { project, run, results, history, signoff }
 *   POST   /api/public/:token/approve        -> { signoff }
 *   GET    /api/public/:token/results/:resultId/screenshot
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''
const USE_MOCK = import.meta.env.VITE_MOCK === '1'

export const isMockMode = USE_MOCK

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function qualify(url) {
  if (!url) return null
  if (/^(https?:|data:|blob:)/.test(url)) return url
  return `${BASE}${url}`
}

function qualifyRun(payload) {
  if (!payload) return payload
  return {
    ...payload,
    results: (payload.results ?? []).map((result) => ({
      ...result,
      screenshotUrl: qualify(result.screenshotUrl),
    })),
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const password = getOwnerPassword()
  if (password) headers['X-Owner-Password'] = password

  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the Handover API. Is the backend running on port 3001?', {
      code: 'network',
    })
  }

  if (response.status === 401) {
    openOwnerDialog('Enter the owner password to change anything.')
    throw new ApiError('Owner password required.', { status: 401, code: 'unauthorized' })
  }

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, { status: response.status })
  }
  return data
}

const realApi = {
  listProjects: () => request('/api/projects'),

  getProject: (id) => request(`/api/projects/${encodeURIComponent(id)}`),

  createProject: (body) => request('/api/projects', { method: 'POST', body }),

  updateProject: (id, body) => request(`/api/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body }),

  startRun: (projectId) => request(`/api/projects/${encodeURIComponent(projectId)}/runs`, { method: 'POST' }),

  getRun: async (runId) => qualifyRun(await request(`/api/runs/${encodeURIComponent(runId)}`)),

  getPublicReport: async (token) => qualifyRun(await request(`/api/public/${encodeURIComponent(token)}`)),

  approve: (token, body) =>
    request(`/api/public/${encodeURIComponent(token)}/approve`, { method: 'POST', body }),
}

export const api = USE_MOCK ? mockApi : realApi

export function clientReportUrl(token) {
  return `${window.location.origin}/r/${token}`
}
