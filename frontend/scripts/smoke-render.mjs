/**
 * Renders the app to a string in Node (no browser) to catch module-level
 * crashes, bad imports and JSX errors before opening a browser.
 *
 *   npm run smoke
 */
import { createServer } from 'vite'

const noop = () => {}

globalThis.window = {
  location: { pathname: '/', search: '', origin: 'http://localhost:5173' },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: noop,
  history: { pushState: noop, replaceState: noop },
  scrollTo: noop,
}
globalThis.CustomEvent = class extends Event {}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const { renderAll } = await server.ssrLoadModule('/scripts/render-entry.jsx')
  const results = renderAll()
  let failed = false
  for (const result of results) {
    if (result.ok) console.log(`ok   ${result.name} rendered ${result.length} chars`)
    else {
      failed = true
      console.error(`FAIL ${result.name}: ${result.error}`)
    }
  }
  process.exitCode = failed ? 1 : 0
} finally {
  await server.close()
}
