<template>
  <el-card class="box-card">
    <el-card class="box-form">
      <template #header>
        <div class="card-header">
          <h3>"微商城"后台管理系统</h3>
        </div>
      </template>
      <el-form ref="ruleFormRef" status-icon :model="form" :rules="rules" label-width="120px" >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" placeholder="请输入密码" type="password" show-password></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitForm(ruleFormRef)">登录</el-button>
          <!-- <el-button type="primary" @click="registerForm(ruleFormRef)">注册</el-button> -->
        </el-form-item>
        <el-form-item>
          <el-link type="primary" href="#">/忘记密码？</el-link>
        </el-form-item>
      </el-form>
    </el-card>
  </el-card>
</template>
<script setup >
import { ref,reactive} from 'vue'
import { login } from '../api/'
import { useRouter } from 'vue-router'
import useToken from '../stores/token'
import notification from '../utils/notification'
const token = useToken()
const router = useRouter()
const form = reactive({
  username: '',
  password: ''
})
const ruleFormRef = ref(null)
const rules = reactive({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 10, message: '用户名长度必须在3到10个字符之间', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 12, message: '密码长度必须在6到12个字符之间', trigger: 'blur' }
  ]
})
const submitForm = (formRef) => {
  // 模板中传入的 ruleFormRef 已被 Vue 自动解包，
  // formRef 就是 el-form 组件实例本身
  // console.log(formRef)
  // 调用表单验证等方法：formRef.validate()
  formRef.validate(async valid => {
    if (valid) {
      try {
        const data = await login(form)
        //登录成功
        token.updateToken(data.token)
        notification({ message: '登录成功', type: 'success' })
        // 登录成功后，跳转到首页
        const redirect = router.currentRoute.value.query.redirect
        router.replace(typeof redirect === 'string' ? redirect : { name: 'index' })
      } catch {
        // 请求层已统一展示错误信息
      }
    }
  })
}
</script>
<style scoped lang="scss">
.box-card {
 height: 100%;
 background: rgb(40, 79, 209) url('/images/loginBg.jpg') center / cover
no-repeat;
 .box-form {
 position: absolute;
 top: 50%;
 left: 50%;
 width: 70%;
 max-width: 750px;
 transform: translate(-50%, -50%);
 .card-header {
 display: flex;
 justify-content: center;
 align-items: center;
 }
 .el-form {
 display: flex;
 flex-direction: column;
 align-items: center;
 justify-content: center;
 .el-form-item {
 width: 70%;
 display: flex;
 align-items: center;
 justify-content: center;
 --el-form-label-font-size: 16px;
 margin-top: 15px;;
 margin-bottom: 15px;
 .button {
 width: 90px;
 }
 &.center {
 display: flex;
 justify-content: center;
 }
 }
 }
 }
}
</style>
