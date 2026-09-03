const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const path = require('node:path')
const serve = require('koa-static')

const router = require('./src/router/index.js');
const config = require('./src/config/index.js')
const db = require('./src/db/index.js')
const errorHandler = require('./src/middleware/err.js')

const app = new Koa();

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
  serve(path.resolve(__dirname, 'public'))
)

app.use(bodyParser())
app.use(router.routes())
app.use(router.allowedMethods())

async function bootstrap() {
  // 执行最简单的 SQL，验证数据库是否可用
  await db.query('SELECT 1')

  console.log('数据库连接成功')

  //这叫“快速失败”。如果数据库不可用，继续启动服务器没有意义，否则每个接口都会运行到一半才报错
  app.listen(config.port, () => {
    console.log(`服务器运行在 http://localhost:${config.port}`)
  })
}

bootstrap().catch(error => {
  console.error('服务器启动失败：', error.message)
  process.exit(1)
})

