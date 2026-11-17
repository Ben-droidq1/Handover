import crypto from 'node:crypto'
import { config } from './config.js'

/**
 * Single-owner gate. When OWNER_PASSWORD is empty (local dev), writes are open.
 * Clients only ever touch /api/public/*, which is token-scoped instead.
 */
export function requireOwner(req, res, next) {
  if (!config.ownerPassword) return next()

  const provided = req.get('x-owner-password') ?? ''
  const expected = config.ownerPassword
  const a = crypto.createHash('sha256').update(provided).digest()
  const b = crypto.createHash('sha256').update(expected).digest()

  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Owner password required.', code: 'unauthorized' })
  }
  return next()
}
