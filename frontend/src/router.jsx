import { useSyncExternalStore } from 'react'

/**
 * A ~50 line history router. No dependency, no route config: App.jsx matches
 * paths with small regexes. Enough for a five page app.
 */

const listeners = new Set()

function currentPath() {
  return window.location.pathname + window.location.search
}

function notify() {
  for (const listener of listeners) listener()
}

export function navigate(to, { replace = false } = {}) {
  if (to === currentPath()) return
  if (replace) window.history.replaceState({}, '', to)
  else window.history.pushState({}, '', to)
  notify()
  window.scrollTo({ top: 0, behavior: 'instant' })
}

export function useLocation() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      window.addEventListener('popstate', onChange)
      return () => {
        listeners.delete(onChange)
        window.removeEventListener('popstate', onChange)
      }
    },
    currentPath,
    () => '/',
  )
}

export function Link({ to, children, className, ...rest }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (event.button !== 0) return
        event.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
