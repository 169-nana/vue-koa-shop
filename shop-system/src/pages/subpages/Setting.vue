<template>
<el-row :gutter="20">
  <el-col :span="8">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">头像信息</div>
      </template>
      <div class="text item">
        <div class="avatar">
          <el-avatar class="avatar" :src="avatarURL" :size="50" shape="square" />
        </div>
        <el-upload
        ref="uploadRef"
        class="upload-demo"
        :limit="1"
        :action="uploadURL"
        :headers="headers"
        :data="uploadData"
        :auto-upload="false"
        :on-success="uploadSuccess"
        >
        <!--触发器插槽 -->
          <template #trigger>
            <p><el-button>选择头像</el-button></p>
          </template>
          <div>
            <el-button type="success" @click="submitUpload">上传头像</el-button>
          </div>
          <template #tip>
            <div class="el-upload_tip"><p>限制上传1个文件，旧文件会被替代</p></div>
          </template>
        </el-upload>
      </div>
    </el-card>
  </el-col>
  <el-col :span="16">
    <el-card class="box-card">
      <template #header>个人信息</template>
      <div class="change-password-box">
        <el-form :model="form" :rules="rules" ref="rulesFormRef" status-icon label-width="140px">
          <el-form-item label="修改密码:" prop="password">
            <el-input type="password" v-model="form.password"/>
          </el-form-item>
          <el-form-item label="请再次输入密码:" prop="password2">
            <el-input type="password" v-model="form.password2"/>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="submitForm(rulesFormRef)">提交</el-button>
            <el-button @click="resetForm">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>
  </el-col>
</el-row>
</template>
<script setup>
import { ref, reactive } from 'vue'
import defaultAvatarURL from '/images/avatar-default.png'
import { uploadPictureURL,changeAdminPassword,changeAdminAvatar } from '../../api'
import useToken  from '../../stores/token'
import useAdmin from '../../stores/admin'
import notification from '../../utils/notification'
import router from '../../router'
//token校验
const { admin,removeAdmin,updateAdmin } = useAdmin()
const { token,removeToken } = useToken()
const headers = { jwt: token }

const uploadURL=uploadPictureURL()
const uploadData = { type: 'admin_avatar' }
//表单数据和校验规则
const form = reactive({
  password: '',
  password2: ''
})
//头像功能
const avatarURL = ref(admin.avatar || defaultAvatarURL)
const uploadRef = ref()
const rulesFormRef = ref()
//上传头像
const submitUpload = () => {
  uploadRef.value.submit()
}
const uploadSuccess = async response => {
  const { errno, errmsg, data } = response
  if (errno !== 0) {
    notification({
      message: errmsg,
      type: 'error'
    })
  } else {
    if (errmsg !== '') {
      notification({
        message: errmsg,
      type: 'success'
    })
  }
  await changeAdminAvatar({
    avatar: data.savepath
  })
  updateAdmin({
    avatar: data.url
  })
  avatarURL.value = data.url
  }
  uploadRef.value.clearFiles()
}
//修改密码
const submitForm = (formEl) => {
  formEl.validate(async valid => {
    if (valid) {
      await changeAdminPassword({ password: form.password })
      resetForm()
      //退出登录
      removeToken()
      removeAdmin()
      router.push({ name: 'login' })
      notification({
        message: '密码修改成功,请重新登录',
        type: 'success'
      })
    } else {
      notification({
        message: '表单填写有误',
        type: 'error'
      })
    }
  })
}
//重置表单
const resetForm = () => {
  rulesFormRef.value.resetFields()
}
//校验密码是否一致
const validatePass = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}
const rules = reactive({
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 12, message: '密码长度必须在6到12个字符之间', trigger: 'blur' }
  ],
  password2: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validatePass, trigger: 'blur' }
  ]
})
</script>
<style lang="scss" scoped>
.avatar {
 text-align: center;
}
.upload-demo {
 text-align: center;
}
.box-card {
 height: 316px;
}
.change-password-box {
 padding-top: 38px;
}
</style>
