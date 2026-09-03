<template>
<div>
  <el-button type="primary" style="margin-bottom: 10px" @click="addRow
">新增分类</el-button>
<el-dialog v-model="dialogVisible" :title="id ? '修改分类' : '新增分类'" :before-close="closeDialog">
  <CategoryEdit ref="categoryForm" :id="id" @success="editSuccess"/>
</el-dialog>
<!-- 分类管理页面界面 -->
 <el-table ref="tableRef" :data="tableData" style="margin-bottom: 20px
" row-key="id" border default-expand-all>
<el-table-column prop="name" label="分类名称"></el-table-column>
<el-table-column label="分类级别">
  <template #default="{ row }">
    <span v-if="row.pid == 0">一级分类</span>
    <span v-else>二级分类</span>
   </template>
</el-table-column>
<el-table-column prop="id" label="分类编号"/>
<el-table-column label="分类图片">
  <template #default="{ row }">
    <el-image v-if="row.picture != ''" :src="toAssetURL(row.picture)" fit="contain" style="display: flex; align-items: center; height: 60px" />
  </template>
</el-table-column>
<el-table-column label="操作" fixed="right" width="180">
  <template #default="{row}">
    <el-button type="warning" @click="editRow(row)">编辑</el-button>
    <el-button type="danger" @click="delRow(row)">删除</el-button>
  </template>
</el-table-column>
 </el-table>
</div>
</template>
<script setup>
import { getCategoryList, delCategory } from '../../api'
import { ref, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { toAssetURL } from '../../config'
//引入模态框组件
import CategoryEdit from '../../components/CategoryEdit.vue'
const tableData = ref([])
const dialogVisible = ref(false)
const id = ref(0)
const categoryForm = ref()
//在组件挂载完成后查询分类列表数据
onMounted(() => {
  loadCategoryList()
})
//查询分类列表
const loadCategoryList = async () => {
  try {
    const data = await getCategoryList()
    tableData.value = convertToTree(data)
  } catch {
    tableData.value = []
  }
}

//将扁平的一维数组转换为树形结构的方法
const convertToTree = data => {
  const treeData = []
  //创建一个节点映射表，用于存储每个节点的引用
  const map = {}
  //遍历一维数组数据，建立映射
  for (const item of data) {
    map[item.id] = { ...item, children: [] }
  }
  //遍历映射表，将节点添加到父节点的children中
  for (const item of data) {
    const node = map[item.id]
    //如果是根节点，直接添加到树数据中
    if (item.pid === 0) {
      treeData.push(node)
    } else {
      //如果不是根节点，根据pid找到父节点，将当前节点添加到父节点的children中
      const parent = map[item.pid]
      //增加父节点存在性检查，避免pid无效时报错
      if (parent) {
        parent.children.push(node)
      } else {
        //找不到父节点时，降级为根节点展示，防止数据丢失
        treeData.push(node)
      }
    }
  }
  return treeData
}

//新增分类
const addRow = () => {
  id.value = 0
  dialogVisible.value = true
  if (categoryForm.value) {
    categoryForm.value.resetForm(0)
  }
}

//修改分类
const editRow = row => {
  id.value = row.id
  dialogVisible.value = true
  if (categoryForm.value) {
    categoryForm.value.resetForm(row.id)
  }
}
//删除分类
const delRow = row => {
  if (row.pid == 0 && row.children.length != 0) {
    ElMessage({
      type: 'warning',
      message: '该分类下存在二级分类，请先删除二级分类再删除此分类'
    })
  } else {
    ElMessageBox.confirm('确定要删除此分类吗？', {
      closeOnClickModal: false,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    }).then(async () => {
      try {
        await delCategory({ id: row.id })
        loadCategoryList()
      } catch {
        // 请求层已展示错误
      }
    }).catch(() => {})
  }
}
//关闭弹窗
const closeDialog = () => {
  dialogVisible.value = false
}
const editSuccess = () => {
  loadCategoryList()
  dialogVisible.value = false
}
</script>
