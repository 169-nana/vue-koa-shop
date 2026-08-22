import { ElNotification } from 'element-plus'
let notificationInstance = null
export default (options) => {
  notificationInstance && notificationInstance.close()
  notificationInstance = ElNotification(options)
}
