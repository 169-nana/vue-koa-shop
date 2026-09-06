//不直接监听端口，自动化测试可以导入它，在随机端口运行，不会占用正常开发端口。

import type { AppState } from './types'
import { projectRoot } from './utils/paths'
import Koa from 'koa'
import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'
import path from 'node:path'
import serve from 'koa-static'

import router from './router/index'
import errorHandler from './middleware/err'

const app = new Koa<AppState>();

//全局错误类型中间件
app.use(errorHandler)

app.use(cors({
  origin: (ctx) => ctx.header.origin || '*',
  allowHeaders: 'Content-Type, Authorization, X-Requested-With, jwt',
  exposeHeaders: 'jwt',
  maxAge: 86400
}))

// public目录中的文件可以通过HTTP访问
app.use(
  serve(path.join(projectRoot, 'public'))
)

app.use(bodyParser())
app.use(router.routes())
app.use(router.allowedMethods())

export default app
