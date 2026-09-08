import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'shop_user_token'

//defineStore(Store名称, Store内容)
const useTokenStore = defineStore(
  'userToken',
  () => {
    const token = ref(
      localStorage.getItem(STORAGE_KEY) || ''
    )

    const updateToken = (value: string) => {
      token.value = value
      localStorage.setItem(
        STORAGE_KEY,
        value
      )
    }

    const removeToken = () => {
      token.value = ''
      localStorage.removeItem(STORAGE_KEY)
    }

    const syncFromStorage = () => {
      token.value = localStorage.getItem(STORAGE_KEY) || ''
    }
    return {
      token,
      updateToken,
      removeToken,
      syncFromStorage
    }
  }
)

export default useTokenStore
