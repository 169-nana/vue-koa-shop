<template>
  <el-row :gutter="20">
    <el-col :span="6">
      <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <el-avatar class="avatar" :src="admin.avatar" :size="20" shape="square"/>
          <span style="font-size: 24px;">{{ admin.username }}</span>
        </div>
      </template>
      <div class="info">
          <p>登录时间：{{ logInfo.loginTime }}</p>
          <p>登录地点：{{ logInfo.loginPlace }}</p>
        </div>
      </el-card>
    </el-col>
    <!-- 单月统计信息展示 -->
     <el-col :span="18">
      <el-card class="box-card">
        <template #header>
          <div class="card-header">
            6月统计信息
          </div>
        </template>
        <div class="info">
          <el-row :gutter="24">
        <!-- 商品数量 -->
         <el-col :span="8">
          <div class="card-container">
            <div class="card-left-container" style="background-color: #EEAD0E;">
            <el-icon :size="90">
              <Memo />
            </el-icon>
      </div>
      <div class="card-right-container">
        <p class="number">500</p>
        <p>商品数量</p>
            </div>
          </div>
         </el-col>
         <!-- 商品分类数量 -->
         <el-col :span="8">
          <div class="card-container">
            <div class="card-left-container" style="background-color: #AB82FF;">
            <el-icon :size="90">
              <Memo />
            </el-icon>
      </div>
      <div class="card-right-container">
        <p class="number">20</p>
        <p>商品分类数量(个)</p>
            </div>
          </div>
         </el-col>
         <!-- 用户访问次数 -->
         <el-col :span="8">
          <div class="card-container">
            <div class="card-left-container" style="background-color: #AB82FF;">
            <el-icon :size="90">
              <Memo />
            </el-icon>
      </div>
      <div class="card-right-container">
        <p class="number">121</p>
        <p>用户访问次数(次)</p>
            </div>
          </div>
         </el-col>
          </el-row>
        </div>
      </el-card>
     </el-col>
  </el-row>
  <!-- 图表区域 -->
   <el-row :gutter="20">
    <el-col :span="12">
      <el-card class="box-card">
        <div id="saleVolume" style="height: 400px; width: 100%"></div>
      </el-card>
    </el-col>
    <!-- 通过柱状图展示2026年6月商品销售量 -->
    <el-col :span="12">
      <el-card class="box-card">
        <div id="orderQuantity" style="height: 400px; width: 100%"></div>
      </el-card>
    </el-col>
   </el-row>
</template>
<script setup lang="ts">
import type { EChartsType } from 'echarts/core'
// ========== 依赖引入 ==========
import { reactive, onMounted, onUnmounted } from 'vue'
import { use, init } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Memo } from '@element-plus/icons-vue'
import { getAdmin } from '../../api';
import useAdmin from '../../stores/admin';

use([LineChart, BarChart, TitleComponent, TooltipComponent, GridComponent, CanvasRenderer])

// 状态与数据
const { admin, updateAdmin } = useAdmin();
// 图表实例引用，用于 resize
let chart1: EChartsType | null = null;
let chart2: EChartsType | null = null;
// 还没有设置后端接口，这里模拟数据
const logInfo = reactive({
  loginTime: '2026-08-01 10:00:00',
  loginPlace: '中国 北京'
})

// 业务函数
// 加载管理员信息
const loadAdmin = async () => {
  try {
    let data = await getAdmin();
    if (!data) return;
    updateAdmin({
      username: data.username,
      avatar: data.avatar,
    });
  } catch (e) {
    console.warn('获取管理员信息失败：', e);
  }
};
//图表1：月度销售量
const initCharts1 = () => {
  const el = document.getElementById('saleVolume');
  if (!el) return;
  chart1 = init(el);
  chart1.setOption({
    color: ['#1493fa'],
    title: {
      text: '2026年商品销售量'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      name: '月份',
      axisLabel: {
        interval: 0
      }
    },
    yAxis: {
      name: '单位(千万元)',
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '5%',
      containLabel: true
    },
    series: [{
      data: [6, 7, 8.5, 8, 7.6, 11, 13, 11.8, 12.5, 15, 16, 17],
      name: '销售量',
      type: 'line',
      smooth: true,
      label: {
        show: true,
        position: 'top'
      }
    }]
  });
  setTimeout(() => chart1?.resize(), 0);
}

//图表2：月度订单量
const initCharts2 = () => {
  const el = document.getElementById('orderQuantity');
  if (!el) return;
  chart2 = init(el);
  chart2.setOption({
    color: ['#1493fa'],
    title: {
      text: '2026年订单量'
    },
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      name: '月份',
      axisTick: {
        alignWithLabel: true
      },
      axisLabel: {
        interval: 0,
        rotate: 45
      }
    },
    yAxis: {
      name: '单位(个)',
    },
    series: [{
      data: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500],
      name: '订单总量',
      type: 'bar',
      barWidth: '60%',
      label: {
        show: true,
        position: 'top'
      }
    }]
  });
  setTimeout(() => chart2?.resize(), 0);
}

// 窗口缩放时同步调整两个图表
const handleResize = () => {
  chart1 && chart1.resize();
  chart2 && chart2.resize();
}

// 生命周期钩子 
onMounted(() => {
  loadAdmin();
  initCharts1();
  initCharts2();
  window.addEventListener('resize', handleResize);
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chart1 && chart1.dispose();
  chart2 && chart2.dispose();
})
</script>
<style lang="scss" scoped>
.el-row{
  margin-bottom: 20px;
  &:last-child{
    margin-bottom: 0;
  }
  .el-col{
    .box-card{
      .card-header{
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .info{
        font-size: 14px;
      }
    }
  }
}
.card-container {
 display: flex;
 align-items: center;
 justify-content: space-between;
 border: 1px solid #e4e7ed;
 text-align: center;
 padding-right: 20px;
 .card-left-container {
   width: 90px;
   height: 90px;
   display: flex;
   align-items: center;
   justify-content: center;
   color: white;
   flex-shrink: 0;
 }
 .card-right-container {
 .number {
 font-size: 18px;
 font-weight: bold;
    }
  }
}
</style>
