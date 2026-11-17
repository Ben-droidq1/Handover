import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { sendScreenshot } from '../files.js'
import * as store from '../store.js'

export const runsRouter = Router()

runsRouter.get(
  '/runs/:id',
  asyncRoute(async (req, res) => {
    res.json(store.getRunDetail(req.params.id))
  }),
)

runsRouter.get(
  '/results/:id/screenshot',
  asyncRoute(async (req, res, next) => {
    const result = store.findResult(req.params.id)
    if (!result) {
      res.status(404).json({ error: 'Check not found.' })
      return
    }
    sendScreenshot(res, next, result.screenshot_path)
  }),
)
