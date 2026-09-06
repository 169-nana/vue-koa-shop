import { defineStore } from 'pinia'
import { ref } from 'vue'
const useToken=defineStore('token',()=>{
    const token = ref<string | null>(null)
    //更新token
    const updateToken=(val: string)=>{
        token.value=val
    }
    //移除token
    const removeToken=()=>{
        token.value=null
    }
    return{
        token,
        updateToken,
        removeToken
    }
}, {
        persist: {
        enabled: true,
         strategies: [{
            key: 'token',
            storage: localStorage
        }]
    }
})
    export default useToken

