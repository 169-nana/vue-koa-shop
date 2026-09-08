<template>
 <div class="category-editor">
 <div class="level-summary" :class="showMore ? 'secondary' : 'primary'">
   <strong>{{ form.id ? '编辑' : '创建' }}{{ showMore ? '二级分类' : '一级分类' }}</strong>
   <span>{{ showMore ? '二级分类用于商品归类，不设置分类图片' : '一级分类用于组织二级分类，可设置展示图片' }}</span>
 </div>
 <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
 <!-- 分类名称 -->
 <el-form-item prop="name" label="分类名称" style="width: 92%">
 <el-input v-model="form.name" placeholder="请填写分类名称" />
 </el-form-item>
 <el-form-item label="分类层级"><el-tag :type="showMore ? 'success' : ''">{{ showMore ? '二级分类' : '一级分类' }}</el-tag></el-form-item>
 <!-- 上级分类 -->
 <el-form-item v-show="showMore" label="上级分类" prop="pid">
   <el-select v-model="form.pid" :disabled="isDirectChild" placeholder="请选择上级分类名称">
     <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.id" />
   </el-select>
 </el-form-item>
 <!-- 只有一级分类展示图片，二级分类不允许提交图片 -->
 <el-form-item label="分类图片" v-show="!showMore">
   <el-upload
     ref="uploadRef"
     class="upload-demo"
     v-model:file-list="fileList"
     :action="uploadPictureURL()"
     :headers="{ jwt: token }"
     :data="{ type: 'category_picture' }"
     :limit="1"
     accept="image/jpeg,image/png,image/webp,image/gif"
     :before-upload="beforeImageUpload"
     :on-exceed="handleExceed"
     :on-success="uploadSuccess"
     :on-error="uploadError"
   >
     <template #trigger>
       <el-button type="primary">请选择图片</el-button>
     </template>
     <template #tip>
       <div class="el-upload__tip">图片文件大小不超过 500KB</div>
     </template>
   </el-upload>
 </el-form-item>
 <!-- 操作按钮 -->
 <el-form-item>
 <el-button type="primary" :loading="submitting" @click="editSubmit" v-if="id">保存修改</el-button>
 <el-button type="primary" :loading="submitting" @click="addSubmit" v-else>创建{{ showMore ? '二级' : '一级' }}分类</el-button>
 <el-button @click="btnCancel">重置</el-button>
 </el-form-item>
 </el-form>
 </div>
</template>
<script setup lang="ts">
import { genFileId, type FormInstance, type FormRules, type UploadInstance, type UploadProps, type UploadRawFile, type UploadUserFile } from 'element-plus'
import type { Category, ApiResponse, UploadResult } from '../../../shared/api'
type ImageFile = UploadUserFile & { serverPath?: string }

import { computed, ref, reactive, onMounted } from 'vue'
import { getCategory, getCategoryList, uploadPictureURL, addCategory, editCategory } from '../api'
import useToken from '../stores/token'
import notification from '../utils/notification'
import { handleUploadUnauthorized, validateImage } from '../utils/upload'

const emit = defineEmits<{ (event: 'success'): void }>()

const props = withDefaults(defineProps<{ id?: number; parentId?: number }>(), { id: 0, parentId: 0 })
const form = reactive({
 id: props.id,
 name: '',
 pid: props.parentId,
 picture: ''
})
const formRef = ref<FormInstance>()
const categoryList = ref<Category[]>([])
const showMore = ref(props.parentId > 0)
const isDirectChild = computed(() => form.id === 0 && props.parentId > 0)
const fileList = ref<ImageFile[]>([])
const uploadRef = ref<UploadInstance>()
const { token } = useToken()
const submitting = ref(false)
const rules: FormRules = {
 name: [
   { required: true, message: '请填写分类名称', trigger: 'blur' },
   { min: 1, max: 30, message: '分类名称不能超过30个字符', trigger: 'blur' }
 ],
 pid: [{
   validator: (rule, value, callback) => {
     showMore.value && !value ? callback(new Error('请选择上级分类')) : callback()
   },
   trigger: 'change'
 }]
}

onMounted(() => {
  //在组件挂载完成后查询分类详情
 loadCategory()
})
//查询分类详情
const loadCategory = async () => {
  try {
    const categories = await getCategoryList()
    categoryList.value = categories.filter(item => item.pid === 0 && item.id !== form.id)
    if (!form.id) {
      form.pid = props.parentId
      showMore.value = props.parentId > 0
      return
    }
    const data = await getCategory({ id: form.id })
    Object.assign(form, data)
    showMore.value = form.pid !== 0
  } catch {
    categoryList.value = []
  }
}
// 重置表单供父组件调用
const resetForm = (id: number) => {
  form.id = id
  btnCancel()
}
defineExpose({ resetForm })
// 新增分类操作
const addSubmit = async () => {
  if (!await formRef.value?.validate().catch(() => false)) return
  const data = {
    name: form.name,
    picture: showMore.value ? '' : form.picture,
    pid: showMore.value ? form.pid : 0
  }
  submitting.value = true
  try {
    await addCategory(data)
    emit('success')
  } catch {
    // 请求层已展示错误
  } finally {
    submitting.value = false
  }
}
// 修改操作
const editSubmit = async () => {
  if (!await formRef.value?.validate().catch(() => false)) return
  submitting.value = true
  try {
    await editCategory({ ...form, picture: showMore.value ? '' : form.picture, pid: showMore.value ? form.pid : 0 })
    emit('success')
  } catch {
    // 请求层已展示错误
  } finally {
    submitting.value = false
  }
}
// 重置表单
const btnCancel = () => {
 formRef.value?.resetFields()
 form.name = ''
 form.pid = props.parentId
 form.picture = ''
 showMore.value = props.parentId > 0
 uploadRef.value?.clearFiles()
 loadCategory()
}
// 文件超出个数限制时替换已有图片
const handleExceed: UploadProps['onExceed'] = files => {
 uploadRef.value?.clearFiles()
 const file = files[0] as UploadRawFile
  file.uid = genFileId()
  uploadRef.value?.handleStart(file)
 uploadRef.value?.submit()
}
const beforeImageUpload = (file: File) => validateImage(file)
const uploadError = () => notification({ message: '图片上传失败', type: 'error' })
// 上传成功（仅失败时通知，成功通过图片预览给出视觉反馈，避免打扰）
const uploadSuccess = (response: ApiResponse<UploadResult>) => {
 if (handleUploadUnauthorized(response)) return
 const { errno, errmsg, data } = response
 if (errno !== 0 || !data) {
   notification({
     message: errmsg,
     type: 'error'
   })
 } else {
   form.picture = data.savepath
 }
}
</script>
<style scoped>
.level-summary { display: grid; gap: 5px; margin: 0 4px 22px; padding: 14px 16px; border: 1px solid #d8e6f8; border-radius: 8px; color: #285f9f; background: #f3f8ff; }
.level-summary.secondary { border-color: #d5e8dc; color: #2d6a4f; background: #f1f8f4; }
.level-summary span { font-size: 12px; font-weight: 400; opacity: .78; }
.upload-demo {
 text-align: left;
 width: 91%;
}
</style>
