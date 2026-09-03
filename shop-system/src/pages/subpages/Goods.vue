<template>
 <div>
 <el-button type="primary" style="margin-bottom: 10px;" @click="addRow">新增商品</el-button>
 <!-- 新增商品的弹出框 -->
 <el-dialog v-model="dialogVisible" :title="id ? '修改商品' : '新增商品'" :before-close="handleBeforeClose">
   <GoodsEdit ref="goodsForm" :id="id" @success="editSuccess" />
 </el-dialog>
 <!-- 商品列表 -->
 <el-table :data="goodsList" style="width: 100%; margin-bottom: 20px" row-key="id" border default-expand-all>
 <el-table-column prop="id" label="商品编号" width="100" />
 <el-table-column prop="name" label="商品名称" width="260" />
 <el-table-column prop="price" label="商品价格" width="100" />
 <el-table-column prop="stock" label="商品库存" width="100" />
 <el-table-column prop="description" label="商品简介" />
 <el-table-column prop="picture" label="商品图片" width="120">
 <template #default="{ row }">
 <el-image v-if="row.picture != ''" :src="toAssetURL(row.picture)" fit="contain"
 style="display: flex; align-items: center; height: 60px;" />
 </template>
 </el-table-column>
 <el-table-column fixed="right" label="操作" width="200">
 <template #default="{ row }">
 <el-button type="warning" @click="editRow(row)">编辑</el-button>
 <el-button type="danger" @click="delRow(row)">删除</el-button>
 </template>
 </el-table-column>
 </el-table>
 <el-pagination
 v-model:current-page="page"
 background layout="prev, pager, next"
 :total="total"
 :page-size="pagesize"
 @current-change="handleCurrentChange"
 style="margin-bottom: 50px;"
 />
 </div>
</template>
<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { getGoodsList, delGoods } from '../../api'
import { ElMessageBox } from 'element-plus'
import { toAssetURL } from '../../config'

const GoodsEdit = defineAsyncComponent(() => import('../../components/GoodsEdit.vue'))
const goodsList = ref([])
const page = ref(1)
const pagesize = ref(10)
const total = ref(0)
const id = ref()
const dialogVisible = ref(false)
const goodsForm = ref()

onMounted(() => {
  loadGoodsList()
})
const loadGoodsList = async () => {
  const params = {
    page: page.value,
    pagesize: pagesize.value
  }
  try {
    const data = await getGoodsList(params)
    goodsList.value = data.list.map(item => ({
      ...item,
      description: removeTags(item.description)
    }))
    total.value = data.total
  } catch {
    goodsList.value = []
    total.value = 0
  }
}
// 去掉标签，仅显示文字
const removeTags = str => {
  return (str || '').replace(/<[^>]+>/g, '')
}
//新增商品
const addRow = () => {
  if (goodsForm.value) {
    goodsForm.value.resetForm(0)
  }
  id.value = 0
  dialogVisible.value = true
}
//修改商品
const editRow = row => {
  if (goodsForm.value) {
    goodsForm.value.resetForm(row.id)
  }
  id.value = row.id
  dialogVisible.value = true
}
//删除商品
const delRow = row => {
  ElMessageBox.confirm('确定要删除此商品吗？', {
    closeOnClickModal: false,
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      await delGoods({ id: row.id })
      loadGoodsList()
    } catch {
      // 请求层已展示错误
    }
  }).catch(() => {})
}
//分页切换
const handleCurrentChange = value => {
  page.value = value
  loadGoodsList()
}
//编辑完成
const editSuccess = () => {
  loadGoodsList()
  dialogVisible.value = false
}
//关闭弹出框
const handleBeforeClose = () => {
  dialogVisible.value = false
  setTimeout(() => {
    goodsForm.value.resetForm()
  }, 500)
}
</script>
