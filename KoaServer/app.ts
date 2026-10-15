import app from './src/app'
import config from './src/config'
import db from './src/db'
import { closeExpiredOrders } from './src/service/payment'
import { autoConfirmDelivered } from './src/service/order'

async function maintainOrders(): Promise<void> {
  const [closed, completed] = await Promise.all([closeExpiredOrders(), autoConfirmDelivered()])
  if (closed || completed) console.log(`订单维护：关闭 ${closed} 笔，自动收货 ${completed} 笔`)
}

async function bootstrap() {
  // 执行最简单的 SQL，验证数据库是否可用
  await db.query('SELECT 1')

  console.log('数据库连接成功')
  await maintainOrders()
  const maintenanceTimer = setInterval(() => {
    maintainOrders().catch(error => console.error('订单维护失败：', error instanceof Error ? error.message : error))
  }, 60_000)
  maintenanceTimer.unref()

  //这叫“快速失败”。如果数据库不可用，继续启动服务器没有意义，否则每个接口都会运行到一半才报错
  app.listen(config.port, () => {
    console.log(`服务器运行在 http://localhost:${config.port}`)
  })
}

bootstrap().catch(error => {
  console.error('服务器启动失败：', error.message)
  process.exit(1)
})
