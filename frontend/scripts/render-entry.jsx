import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.jsx'
import NewProject from '../src/pages/NewProject.jsx'
import RunDetail from '../src/pages/RunDetail.jsx'

/**
 * Loaded through Vite's SSR graph (see smoke-render.mjs) so React and the app
 * share one module instance. Renders the initial state of each page.
 */
export function renderAll() {
  const cases = [
    ['App (dashboard)', App, {}],
    ['NewProject', NewProject, {}],
    ['RunDetail', RunDetail, { id: 'run_demo' }],
  ]

  return cases.map(([name, Component, props]) => {
    try {
      return { name, ok: true, length: renderToString(createElement(Component, props)).length }
    } catch (error) {
      return { name, ok: false, error: error.message }
    }
  })
}
