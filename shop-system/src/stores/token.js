import { defineStore } from 'pinia'
import { ref } from 'vue'
const useToken=defineStore('token',()=>{
    const token = ref(null)
    //更新token
    const updateToken=val=>{
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

