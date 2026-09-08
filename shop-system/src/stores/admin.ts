import type { PublicAdmin } from '../../../shared/api'
import { defineStore } from 'pinia'
import { reactive } from 'vue'
const useAdmin = defineStore('admin', () => {
  const defaultAdmin: Omit<PublicAdmin, 'id'> = {
    username: '',
    avatar:'',
    role: 'reviewer',
    status: 1
  }
  // 管理员信息，包含用户名和头像
  const admin = reactive(Object.assign({}, defaultAdmin))
  const updateAdmin = (options: Partial<PublicAdmin>) => {
    //reactive 对象 不能重新赋值 （会丢失响应式），只能修改属性。所以用 Object.assign 合并字段是正确做法
    Object.assign(admin, options)
    return admin
  }
  const removeAdmin = () => {
    Object.assign(admin, defaultAdmin)
    return admin
  }
return{admin,updateAdmin,removeAdmin}
}, {
  persist: {
    enabled: true,
    strategies: [
      {
        key: 'admin',
        storage: localStorage
      }
    ]
  }
})
export default useAdmin
