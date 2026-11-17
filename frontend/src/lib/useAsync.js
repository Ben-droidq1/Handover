import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads data on mount (and when `deps` change), with optional silent polling.
 * Every page needs the same loading/error/refresh trio, so it lives here.
 */
export function useAsync(loader, deps = [], { pollMs = 0, shouldPoll } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const mountedRef = useRef(true)
  const shouldPollRef = useRef(shouldPoll)
  shouldPollRef.current = shouldPoll

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await loaderRef.current()
      if (mountedRef.current) setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      if (mountedRef.current) setState((prev) => ({ ...prev, error, loading: false }))
      return null
    }
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (!pollMs) return undefined
    const on = shouldPollRef.current ? shouldPollRef.current(state.data) : true
    if (!on) return undefined
    const timer = setInterval(() => load({ silent: true }), pollMs)
    return () => clearInterval(timer)
  }, [pollMs, state.data, load])

  return { ...state, reload: load }
}
