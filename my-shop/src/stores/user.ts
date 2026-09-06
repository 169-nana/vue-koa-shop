import type { PublicUser } from '../../../shared/api'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

const useUserStore = defineStore(
  'user',
  () => {
    const user = reactive<Omit<PublicUser, 'id'> & { id: number | null }>({
      id: null,
      username: '',
      avatar: ''
    })

    const updateUser = (data: PublicUser) => {
      Object.assign(user, data)
    }

    const removeUser = () => {
      Object.assign(user, {
        id: null,
        username: '',
        avatar: ''
      })
    }

    return {
      user,
      updateUser,
      removeUser
    }
  }
)

export default useUserStore
