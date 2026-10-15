import db from '../src/db'
import { autoConfirmDelivered } from '../src/service/order'
import { closeExpiredOrders } from '../src/service/payment'

Promise.all([closeExpiredOrders(500), autoConfirmDelivered()])
  .then(([closed, completed]) => console.log(`关闭超时订单 ${closed} 笔，自动确认收货 ${completed} 笔`))
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
  .finally(() => db.end())
