import path from 'node:path'
import { paths } from './config.js'

/** Screenshots are stored by generated filename, never by client input. */
export function sendScreenshot(res, next, storedName) {
  if (!storedName) {
    res.status(404).json({ error: 'No screenshot was captured for this check.' })
    return
  }

  const fullPath = path.join(paths.shots, path.basename(storedName))
  res.sendFile(fullPath, { headers: { 'Cache-Control': 'public, max-age=3600' } }, (error) => {
    if (!error) return
    if (res.headersSent) return next(error)
    res.status(404).json({ error: 'Screenshot file is missing.' })
  })
}
