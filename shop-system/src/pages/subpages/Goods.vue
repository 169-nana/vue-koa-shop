<template>
  <div class="goods-workbench">
    <aside class="category-panel">
      <div class="panel-title">
        <div><strong>商品分类</strong><span>{{ categoryList.length }} 个分类</span></div>
        <el-button type="primary" link @click="openCategory(0)">新增</el-button>
      </div>
      <el-input v-model="categoryKeyword" clearable placeholder="搜索分类" :prefix-icon="Search" />
      <el-scrollbar class="category-scroll">
        <el-tree ref="categoryTreeRef" node-key="id" highlight-current default-expand-all
          :data="categoryTree" :props="{ label: 'name', children: 'children' }"
          :filter-node-method="filterCategory" @node-click="selectCategory">
          <template #default="{ data }">
            <div class="category-node">
              <span class="category-name">{{ data.name }}</span>
              <span class="category-actions" @click.stop>
                <el-button link @click="openCategory(data.id)">编辑</el-button>
                <el-button link type="danger" @click="removeCategory(data)">删除</el-button>
              </span>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>
    </aside>

    <section class="goods-panel" @submit.prevent="searchGoods" @keyup.enter="searchGoods">
      <div class="page-heading">
        <div><h2>商品数据管理</h2><p>按分类组织商品，并通过多条件快速定位数据</p></div>
        <el-button type="primary" @click="openGoods(0)">新增商品</el-button>
      </div>

      <el-form class="query-form" :model="query" label-position="top">
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item label="关键词">
              <el-input v-model="query.keyword" clearable placeholder="商品名称、规格或商品编号" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item label="价格区间"><div class="range-inputs">
              <el-input-number v-model="query.min_price" :min="0" :precision="2" controls-position="right" placeholder="最低价" />
              <span>—</span>
              <el-input-number v-model="query.max_price" :min="0" :precision="2" controls-position="right" placeholder="最高价" />
            </div></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item label="库存区间"><div class="range-inputs">
              <el-input-number v-model="query.min_stock" :min="0" :precision="0" controls-position="right" placeholder="最低库存" />
              <span>—</span>
              <el-input-number v-model="query.max_stock" :min="0" :precision="0" controls-position="right" placeholder="最高库存" />
            </div></el-form-item>
          </el-col>
        </el-row>
        <div class="query-actions">
          <span class="selected-category">当前分类：{{ selectedCategoryName || '全部商品' }}
            <el-button v-if="selectedCategoryId" link @click="clearCategory">清除</el-button>
          </span>
          <div><el-button @click="resetQuery">重置</el-button><el-button type="primary" :loading="loading" @click="searchGoods">查询</el-button></div>
        </div>
      </el-form>

      <div class="result-summary">共找到 <strong>{{ total }}</strong> 件商品</div>
      <el-table v-loading="loading" :data="goodsList" row-key="id" border stripe>
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column label="商品信息" min-width="250"><template #default="{ row }">
          <div class="goods-info">
            <el-image class="goods-image" :src="toAssetURL(row.picture)" fit="cover"><template #error><div class="image-fallback">暂无图片</div></template></el-image>
            <div><strong>{{ row.name }}</strong><small>{{ row.spec || '暂无规格' }}</small></div>
          </div>
        </template></el-table-column>
        <el-table-column label="所属分类" min-width="160"><template #default="{ row }">{{ [row.parent_category_name, row.category_name].filter(Boolean).join(' / ') || '未分类' }}</template></el-table-column>
        <el-table-column label="售价" width="120"><template #default="{ row }">¥{{ Number(row.price).toFixed(2) }}</template></el-table-column>
        <el-table-column label="库存" width="120"><template #default="{ row }">
          <el-tag :type="row.stock === 0 ? 'danger' : row.stock <= 10 ? 'warning' : 'success'">{{ row.stock === 0 ? '已售罄' : `${row.stock} 件` }}</el-tag>
        </template></el-table-column>
        <el-table-column fixed="right" label="操作" width="150"><template #default="{ row }">
          <el-button link type="primary" @click="openGoods(row.id)">编辑</el-button><el-button link type="danger" @click="removeGoods(row)">删除</el-button>
        </template></el-table-column>
        <template #empty><el-empty description="没有符合条件的商品" /></template>
      </el-table>
      <el-pagination v-if="total" class="pagination" v-model:current-page="page" background
        layout="total, prev, pager, next" :total="total" :page-size="pagesize" @current-change="loadGoodsList" />
    </section>

    <el-dialog v-model="goodsDialogVisible" :title="goodsId ? '修改商品' : '新增商品'" width="760px" destroy-on-close>
      <GoodsEdit :id="goodsId" @success="goodsEditSuccess" />
    </el-dialog>
    <el-dialog v-model="categoryDialogVisible" :title="categoryId ? '修改分类' : '新增分类'" width="560px" destroy-on-close>
      <CategoryEdit :id="categoryId" @success="categoryEditSuccess" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { Category, CategoryNode, GoodsListItem, GoodsQuery } from '../../../../shared/api'
import type { ElTree } from 'element-plus'

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import GoodsEdit from '../../components/GoodsEdit.vue'
import CategoryEdit from '../../components/CategoryEdit.vue'
import { delCategory, delGoods, getCategoryList, getGoodsList } from '../../api'
import { toAssetURL } from '../../config'

const goodsList = ref<GoodsListItem[]>([]), categoryList = ref<Category[]>([]), loading = ref(false)
const page = ref(1), pagesize = 10, total = ref(0)
const selectedCategoryId = ref<number | null>(null), categoryKeyword = ref(''), categoryTreeRef = ref<InstanceType<typeof ElTree>>()
const goodsDialogVisible = ref(false), categoryDialogVisible = ref(false)
const goodsId = ref(0), categoryId = ref(0)
const query = reactive<{ keyword: string; min_price: number | undefined; max_price: number | undefined; min_stock: number | undefined; max_stock: number | undefined }>({ keyword: '', min_price: undefined, max_price: undefined, min_stock: undefined, max_stock: undefined })

const categoryTree = computed(() => {
  const map = new Map<number, CategoryNode>(categoryList.value.map(item => [item.id, { ...item, children: [] }]))
  const roots: CategoryNode[] = []
  map.forEach(item => {
    const parent = map.get(item.pid)
    if (item.pid && parent) parent.children.push(item)
    else roots.push(item)
  })
  return roots
})
const selectedCategoryName = computed(() => categoryList.value.find(item => item.id === selectedCategoryId.value)?.name || '')
watch(categoryKeyword, value => categoryTreeRef.value?.filter(value))
onMounted(async () => { await loadCategories(); await loadGoodsList() })

async function loadCategories() {
  try { categoryList.value = await getCategoryList() } catch { categoryList.value = [] }
}
async function loadGoodsList() {
  loading.value = true
  try {
    const params: GoodsQuery = { page: page.value, pagesize, ...query }
    if (selectedCategoryId.value) params.category_id = selectedCategoryId.value
    const data = await getGoodsList(params)
    goodsList.value = data.list
    total.value = data.total
    if (!data.list.length && data.total > 0 && page.value > 1) { page.value--; await loadGoodsList() }
  } catch { goodsList.value = []; total.value = 0 } finally { loading.value = false }
}
const filterCategory = (value: string, data: Record<string, unknown>) => !value || (typeof data.name === 'string' && data.name.toLowerCase().includes(value.toLowerCase()))
const selectCategory = (data: Category) => { selectedCategoryId.value = data.id; page.value = 1; loadGoodsList() }
const clearCategory = () => { selectedCategoryId.value = null; categoryTreeRef.value?.setCurrentKey(undefined); page.value = 1; loadGoodsList() }
const searchGoods = () => { page.value = 1; loadGoodsList() }
const resetQuery = () => { Object.assign(query, { keyword: '', min_price: undefined, max_price: undefined, min_stock: undefined, max_stock: undefined }); clearCategory() }
const openGoods = (id: number) => { goodsId.value = id; goodsDialogVisible.value = true }
const goodsEditSuccess = () => { goodsDialogVisible.value = false; loadGoodsList() }
async function removeGoods(row: GoodsListItem) {
  try { await ElMessageBox.confirm(`确定删除商品“${row.name}”吗？`, '删除确认', { type: 'warning' }); await delGoods({ id: row.id }); await loadGoodsList() }
  catch (error) { if (error !== 'cancel' && error !== 'close') return }
}
const openCategory = (id: number) => { categoryId.value = id; categoryDialogVisible.value = true }
const categoryEditSuccess = async () => { categoryDialogVisible.value = false; await loadCategories(); await loadGoodsList() }
async function removeCategory(row: Category) {
  try {
    await ElMessageBox.confirm(`确定删除分类“${row.name}”吗？`, '删除确认', { type: 'warning' })
    await delCategory({ id: row.id })
    if (selectedCategoryId.value === row.id) selectedCategoryId.value = null
    await loadCategories(); await loadGoodsList()
  } catch (error) { if (error !== 'cancel' && error !== 'close') return }
}
</script>

<style scoped lang="scss">
.goods-workbench { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 20px; min-height: calc(100vh - 150px); }
.category-panel { border-right: 1px solid #ebeef5; padding-right: 20px; min-width: 0; }
.panel-title, .page-heading, .query-actions { display: flex; align-items: center; justify-content: space-between; }
.panel-title { margin-bottom: 16px; }
.panel-title strong { display: block; font-size: 16px; }
.panel-title span { display: block; margin-top: 4px; color: #909399; font-size: 12px; }
.category-scroll { height: calc(100vh - 245px); margin-top: 12px; }
.category-node { width: 100%; display: flex; align-items: center; justify-content: space-between; padding-right: 8px; }
.category-name { overflow: hidden; text-overflow: ellipsis; }
.category-actions { visibility: hidden; white-space: nowrap; }
.category-node:hover .category-actions { visibility: visible; }
.category-actions .el-button + .el-button { margin-left: 6px; }
.goods-panel { min-width: 0; }
.page-heading { margin-bottom: 18px; }
.page-heading h2 { margin: 0; font-size: 20px; }
.page-heading p { margin: 6px 0 0; color: #909399; font-size: 13px; }
.query-form { padding: 16px 18px 14px; margin-bottom: 16px; background: #f7f8fa; border-radius: 6px; }
.query-form :deep(.el-form-item) { margin-bottom: 12px; }
.range-inputs { display: flex; align-items: center; gap: 8px; width: 100%; }
.range-inputs .el-input-number { width: calc(50% - 12px); }
.selected-category { color: #606266; font-size: 13px; }
.result-summary { margin: 0 0 12px; color: #606266; font-size: 14px; }
.result-summary strong { color: #409eff; }
.goods-info { display: flex; align-items: center; gap: 12px; }
.goods-info strong, .goods-info small { display: block; }
.goods-info small { margin-top: 6px; color: #909399; }
.goods-image { width: 54px; height: 54px; flex: 0 0 54px; border-radius: 4px; background: #f5f7fa; }
.image-fallback { height: 100%; display: flex; align-items: center; justify-content: center; color: #c0c4cc; font-size: 11px; }
.pagination { justify-content: flex-end; margin-top: 18px; }
@media (max-width: 1000px) { .goods-workbench { grid-template-columns: 1fr; } .category-panel { border-right: 0; border-bottom: 1px solid #ebeef5; padding: 0 0 14px; } .category-scroll { height: 220px; } }
</style>
