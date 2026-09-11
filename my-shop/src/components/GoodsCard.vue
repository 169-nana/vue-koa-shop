<script setup lang="ts">
import type { Goods } from '../../../shared/api'
import { toAssetURL } from '../config'

defineProps<{ goods: Goods }>()
</script>

<template>
  <RouterLink class="goods-card" :to="{ name: 'goods-detail', params: { id: goods.id } }" target="_blank" rel="noopener" :aria-label="`查看商品：${goods.name}`">
    <div class="goods-picture">
      <img :src="toAssetURL(goods.picture)" :alt="goods.name">
      <span v-if="goods.stock === 0" class="sold-out">暂时售罄</span>
    </div>
    <div class="goods-content">
      <h3>{{ goods.name }}</h3>
      <p>{{ goods.spec || '品质好物，值得选择' }}</p>
      <div class="goods-footer">
        <strong><small>¥</small>{{ goods.price.toFixed(2) }}</strong>
        <span>库存 {{ goods.stock }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.goods-card { min-width: 0; overflow: hidden; border: 1px solid #eef0ed; border-radius: 14px; background: white; box-shadow: 0 4px 16px rgba(46, 64, 54, .055); transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
.goods-card:hover { border-color: #c9d9cf; box-shadow: 0 12px 28px rgba(46, 64, 54, .12); transform: translateY(-3px); }
.goods-picture { position: relative; aspect-ratio: 1; overflow: hidden; background: #eef1ee; }
.goods-picture img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
.goods-card:hover img { transform: scale(1.035); }
.sold-out { position: absolute; top: 9px; right: 9px; padding: 4px 8px; border-radius: 999px; color: white; background: rgba(38, 44, 40, .76); font-size: 11px; }
.goods-content { padding: 12px 13px 13px; }
.goods-content h3 { margin: 0; overflow: hidden; color: #26352d; font-size: 15px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.goods-content > p { margin: 5px 0 11px; overflow: hidden; color: #909a94; font-size: 12px; line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.goods-footer { display: flex; min-width: 0; align-items: end; justify-content: space-between; gap: 8px; }
.goods-footer strong { color: #d5573d; font: 700 18px Georgia, serif; white-space: nowrap; }
.goods-footer strong small { margin-right: 1px; font-size: 12px; }
.goods-footer span { overflow: hidden; color: #a0a7a2; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 560px) { .goods-card { border-radius: 11px; } .goods-content { padding: 10px; } .goods-content h3 { font-size: 14px; } .goods-footer strong { font-size: 16px; } .goods-footer span { display: none; } }
</style>
