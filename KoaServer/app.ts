import app from './src/app'
import config from './src/config'
import db from './src/db'

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
