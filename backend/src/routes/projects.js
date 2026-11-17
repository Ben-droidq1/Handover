import { Router } from 'express'
import { requireOwner } from '../auth.js'
import { asyncRoute } from '../errors.js'
import { enqueueRun } from '../queue.js'
import * as store from '../store.js'
import { criteriaList, httpUrl, projectPatch, textField } from '../validate.js'

export const projectsRouter = Router()

projectsRouter.get('/projects', (req, res) => {
  res.json({ projects: store.listProjects() })
})

projectsRouter.post(
  '/projects',
  requireOwner,
  asyncRoute(async (req, res) => {
    const body = req.body ?? {}
    const project = store.createProject({
      name: textField(body.name, 'Project name', { max: 120 }),
      clientName: textField(body.clientName, 'Client name', { max: 120, required: false }) ?? '',
      siteUrl: httpUrl(body.siteUrl),
      criteria: criteriaList(body.criteria),
    })
    res.status(201).json(project)
  }),
)

projectsRouter.get(
  '/projects/:id',
  asyncRoute(async (req, res) => {
    res.json(store.getProjectDetail(req.params.id))
  }),
)

projectsRouter.patch(
  '/projects/:id',
  requireOwner,
  asyncRoute(async (req, res) => {
    res.json(store.updateProject(req.params.id, projectPatch(req.body ?? {})))
  }),
)

projectsRouter.post(
  '/projects/:id/runs',
  requireOwner,
  asyncRoute(async (req, res) => {
    const { run } = store.createRun(req.params.id)
    enqueueRun(run.id)
    res.status(202).json({ run })
  }),
)
