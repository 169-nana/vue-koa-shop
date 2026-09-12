import Router from '@koa/router'

import type { AppState } from '../types'

import * as controller from '../controller/agentOperations'
import auth from '../middleware/auth'
import activeAdmin from '../middleware/activeAdmin'
import { adminOnly } from '../middleware/adminPermission'

const router = new Router<AppState>({ prefix: '/admin/agent' })
const read = [auth, activeAdmin] as const
const write = [auth, activeAdmin, adminOnly] as const

router.get('/metrics', ...read, controller.metrics)
router.get('/knowledge', ...read, controller.knowledgeList)
router.post('/knowledge/save', ...write, controller.knowledgeSave)
router.post('/knowledge/disable', ...write, controller.knowledgeDisable)
router.get('/prompts', ...read, controller.promptList)
router.post('/prompts/create', ...write, controller.promptCreate)
router.post('/prompts/publish', ...write, controller.promptPublish)
router.get('/eval-cases', ...read, controller.evalCaseList)
router.post('/eval-cases/save', ...write, controller.evalCaseSave)
router.post('/evaluations/run', ...write, controller.evalRun)

export default router
