import { useSyncExternalStore } from 'react'

/**
 * Owner password for write endpoints (backend reads OWNER_PASSWORD).
 * Kept in localStorage so a demo does not ask on every page load.
 */

const STORAGE_KEY = 'handover.owner-password'
const listeners = new Set()

let password = ''
try {
  password = window.localStorage.getItem(STORAGE_KEY) || ''
} catch {
  password = ''
}

export function getOwnerPassword() {
  return password
}

export function setOwnerPassword(next) {
  password = next.trim()
  try {
    if (password) window.localStorage.setItem(STORAGE_KEY, password)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode: keep the in-memory value only */
  }
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOwnerPassword() {
  return useSyncExternalStore(subscribe, getOwnerPassword, () => '')
}

export function openOwnerDialog(message) {
  window.dispatchEvent(new CustomEvent('handover:owner', { detail: { message } }))
}
