import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { sendScreenshot } from '../files.js'
import * as store from '../store.js'
import { textField } from '../validate.js'

export const publicRouter = Router()

publicRouter.get(
  '/:token',
  asyncRoute(async (req, res) => {
    res.json(store.getPublicReport(req.params.token))
  }),
)

publicRouter.post(
  '/:token/approve',
  asyncRoute(async (req, res) => {
    const body = req.body ?? {}
    const name = textField(body.name, 'Your name', { max: 120 })
    const note = textField(body.note, 'Note', { max: 1000, required: false }) ?? ''
    res.status(201).json(store.approveDelivery(req.params.token, { name, note }))
  }),
)

publicRouter.get(
  '/:token/results/:resultId/screenshot',
  asyncRoute(async (req, res, next) => {
    const result = store.findResultWithToken(req.params.resultId)
    if (!result || result.public_token !== req.params.token) {
      res.status(404).json({ error: 'Screenshot not found for this report.' })
      return
    }
    sendScreenshot(res, next, result.screenshot_path)
  }),
)
