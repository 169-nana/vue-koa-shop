<template>
 <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
 <!-- 商品名称 -->
 <el-form-item label="商品名称" prop="name" style="width: 92%">
 <el-input v-model="form.name" placeholder="请填写商品名称" />
 </el-form-item>
 <!-- 商品分类 -->
 <el-form-item label="分类名称" prop="category_id">
   <el-select v-model="form.category_id" placeholder="请选择二级分类名称">
     <el-option-group v-for="category in categoryList" :key="category.id" :label="category.name">
       <el-option v-for="item in category.children" :key="item.id" :label="item.name" :value="item.id" />
     </el-option-group>
   </el-select>
 </el-form-item>
 <!-- 商品价格 -->
 <el-form-item label="商品价格" prop="price" style="width: 92%">
  <el-input-number v-model="form.price" :min="0" :precision="2" placeholder="请填写商品价格" />
 </el-form-item>
 <!-- 商品图片 -->
 <el-form-item label="商品图片" prop="picture">
   <el-upload
     ref="uploadRef"
     v-model:file-list="fileList"
     class="upload-demo"
     :action="uploadURL"
     :headers="headers"
     :data="{ type: 'goods_picture' }"
     :limit="1"
     accept="image/jpeg,image/png,image/webp,image/gif"
     :before-upload="beforeImageUpload"
     :on-exceed="handleExceed"
     :on-success="uploadSuccess"
     :on-error="uploadError"
   >
     <template #trigger>
       <el-button type="primary" style="text-align: left;">选择图片</el-button>
     </template>
     <template #tip>
       <div class="el-upload__tip">
         图片文件大小不超过 500KB
       </div>
     </template>
   </el-upload>
 </el-form-item>
 <!-- 商品相册 -->
 <el-form-item label="图片相册" prop="album">
   <el-upload
     ref="albumUploadRef"
     class="upload-demo"
     list-type="picture-card"
     v-model:file-list="albumFileList"
     :action="uploadURL"
     :data="{ type: 'goods_album' }"
     :headers="headers"
     :on-preview="handlePictureCardPreview"
     :on-remove="albumHandleRemove"
     :on-success="albumUploadSuccess"
     :multiple="true"
     accept="image/jpeg,image/png,image/webp,image/gif"
     :before-upload="beforeImageUpload"
     :on-error="uploadError"
   >
     <el-icon>
       <Plus />
     </el-icon>
   </el-upload>
   <el-dialog v-model="albumDialogVisible" align-center width="30%">
     <el-Image :src="albumDialogImageUrl" />
   </el-dialog>
 </el-form-item>
 <!-- 商品库存 -->
 <el-form-item label="商品库存" prop="stock" style="width: 92%">
  <el-input-number v-model="form.stock" :min="0" :precision="0" placeholder="请填写库存数量" />
 </el-form-item>
 <!-- 商品规格 -->
 <el-form-item label="商品规格" prop="spec" style="width: 92%">
 <el-input v-model="form.spec" placeholder="请填写商品规格" />
 </el-form-item>
 <!-- 商品简介 -->
<el-form-item label="商品简介" prop="description" style="width: 92%" class="desc">
  <Editor :init="initEditor" v-model="form.description"></Editor>
</el-form-item>
 <!-- 操作按钮 -->
 <el-form-item>
 <el-button type="primary" :loading="submitting" @click="editSubmit()" v-if="form.id">修改</el-button>
 <el-button type="primary" :loading="submitting" @click="addSubmit()" v-else>新增</el-button>
 <el-button @click="btnCancel">重置</el-button>
 </el-form-item>
 </el-form>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue'
import { getCategoryList, uploadPictureURL, getGoods, addGoods, editGoods } from '../api'
import useToken from '../stores/token'
import notification from '../utils/notification'
import { toAssetURL } from '../config'
import { handleUploadUnauthorized, validateImage } from '../utils/upload'
import { Plus } from '@element-plus/icons-vue'
import Editor from '@tinymce/tinymce-vue'
import 'tinymce/tinymce'
import 'tinymce/models/dom'
import 'tinymce/themes/silver'
import 'tinymce/icons/default'
import 'tinymce/plugins/image'
// 编辑器配置
let initEditor = {
  width: '100%',
  skin_url: '/tinymce/skins/ui/oxide',
  content_css: '/tinymce/skins/content/default/content.css',
  language_url: '/tinymce/langs/zh-Hans.js',
  language: 'zh-Hans',
  menubar: false,
  statusbar: false,
  toolbar: 'bold underline italic strikethrough image undo redo',
  plugins: 'image'
}
const props = defineProps({
  id: {
    type: Number
  }
})
const emit = defineEmits(['success'])
const form = reactive({
  id: props.id,
  name: '',
  category_id: '',
  price: '',
  picture: '',
  album: [],
  stock: '',
  spec: '',
  description: ''
})
const formRef = ref()
const categoryList = ref([])
const fileList = ref([])
const uploadRef = ref()
const uploadURL = uploadPictureURL()
const { token } = useToken()
const headers = { jwt: token }
const albumUploadRef = ref()
const albumDialogImageUrl = ref('')
const albumDialogVisible = ref(false)
const albumFileList = ref([])
const submitting = ref(false)
const rules = {
  name: [{ required: true, message: '请填写商品名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  price: [{ required: true, message: '请填写商品价格', trigger: 'change' }],
  stock: [{ required: true, message: '请填写库存数量', trigger: 'change' }],
  picture: [{ required: true, message: '请上传商品主图', trigger: 'change' }]
}
onMounted(() => {
  loadGoods()
})
const resetForm = id => {
  form.id = id
  btnCancel()
}
defineExpose({ resetForm })

// 后端可能返回相对路径，也兼容旧接口返回的完整 URL。
// 表单中始终保存相对路径，只有图片预览时才拼接资源域名。
const toServerPath = path => {
  return (path || '').replace(/^https?:\/\/[^/]+\//i, '')
}

const loadGoods = async () => {
  try {
   if (form.id) {
    const goods = await getGoods({ id: form.id })
    const picturePath = toServerPath(goods.picture)
    if (picturePath !== '') {
      const fileName = picturePath.substring(picturePath.lastIndexOf('/') + 1)
      if (fileName) {
        fileList.value = [{
          name: fileName,
          url: toAssetURL(picturePath),
          serverPath: picturePath
        }]
      }
    }

    const albumPaths = goods.album.map(item => toServerPath(item.picture))
    albumFileList.value = albumPaths.map(serverPath => {
      return {
        name: serverPath.substring(serverPath.lastIndexOf('/') + 1),
        url: toAssetURL(serverPath),
        serverPath
      }
    })

    Object.assign(form, {
      ...goods,
      picture: picturePath,
      album: albumPaths
    })
  }
   const data = await getCategoryList()
  categoryList.value = convertToTree(data)
  } catch {
    categoryList.value = []
  }
}
const convertToTree = data => {
  const treeData = []
  const map = {}
  for (const item of data) {
    map[item.id] = { ...item, children: [] }
  }
  for (const item of data) {
    const node = map[item.id]
    if (item.pid === 0) {
      treeData.push(node)
    } else {
      const parent = map[item.pid]
      if (parent) parent.children.push(node)
    }
  }
  return treeData
}
// 新增商品
const addSubmit = async () => {
  if (!await formRef.value.validate().catch(() => false)) return
  const data = {
    name: form.name,
    category_id: form.category_id,
    price: form.price,
    picture: form.picture,
    album: form.album,
    stock: form.stock,
    spec: form.spec,
    description: form.description
  }
  submitting.value = true
  try {
    await addGoods(data)
    emit('success')
  } catch {
    // 请求层已展示错误
  } finally {
    submitting.value = false
  }
}
// 修改商品
const editSubmit = async () => {
  if (!await formRef.value.validate().catch(() => false)) return
  submitting.value = true
  try {
    await editGoods(form)
    emit('success')
  } catch {
    // 请求层已展示错误
  } finally {
    submitting.value = false
  }
}
// 重置表单
const btnCancel = () => {
  formRef.value.resetFields()
  form.picture = ''
  uploadRef.value.clearFiles()
  form.album = []
  albumUploadRef.value.clearFiles()
  loadGoods()
}
// 文件超出个数限制时替换已有图片
const handleExceed = files => {
  uploadRef.value.clearFiles()
  uploadRef.value.handleStart(files[0])
  uploadRef.value.submit()
}
const beforeImageUpload = file => validateImage(file)
const uploadError = () => notification({ message: '图片上传失败', type: 'error' })
// 上传成功（仅失败时通知，成功通过图片预览给出视觉反馈，避免打扰）
const uploadSuccess = (response, uploadFile) => {
  if (handleUploadUnauthorized(response)) return
  const { errno, errmsg, data } = response
  if (errno !== 0) {
    notification({
      message: errmsg,
      type: 'error'
    })
  } else {
    form.picture = data.savepath
    // 同步替换 fileList 中的临时 URL，保证预览的稳定性
    const fullUrl = data.url || toAssetURL(data.savepath)
    const target = fileList.value.find(f => f.uid === uploadFile.uid)
    if (target) {
      target.url = fullUrl
      target.serverPath = data.savepath
    }
  }
}
// 相册图上传成功（仅失败时通知）
const albumUploadSuccess = (response, uploadFile) => {
  if (handleUploadUnauthorized(response)) return
  const { errno, errmsg, data } = response
  if (errno !== 0) {
    notification({
      message: errmsg,
      type: 'error'
    })
  } else {
    form.album.push(data.savepath)
    // 构建服务器永久 URL 并替换 fileList 中的临时 blob URL，
    // 防止浏览器 GC/HMR 导致预览图过段时间消失
    const fullUrl = data.url || toAssetURL(data.savepath)
    const target = albumFileList.value.find(f => f.uid === uploadFile.uid)
    if (target) {
      target.url = fullUrl
      target.serverPath = data.savepath
    }
  }
}
// 删除相册图
const albumHandleRemove = (removeFile, uploadFiles) => {
  form.album = []
  uploadFiles.forEach(item => {
    form.album.push(item.serverPath || item.response?.data?.savepath || item.url)
  })
}
// 预览已上传的相册图
const handlePictureCardPreview = uploadFile => {
  albumDialogImageUrl.value = uploadFile.url
  albumDialogVisible.value = true
}
</script>
<style scoped>
.upload-demo {
  text-align: left;
  width: 91%;
}
</style>
