import { ElNotification, type NotificationHandle, type NotificationParams } from 'element-plus'
let notificationInstance: NotificationHandle | null = null
export default (options: NotificationParams) => {
  notificationInstance && notificationInstance.close()
  notificationInstance = ElNotification(options)
}
