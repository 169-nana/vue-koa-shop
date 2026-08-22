<template>
<el-config-provider :locale="zhCn">
<router-view>
</router-view>
</el-config-provider>
</template>

<script setup>
// 引入中文语言包,
//zhCn（语言包）是一个“JavaScript 数据对象”，它必须被传递给 App.vue 模板中的 <el-config-provider> 组件的属性（:locale）
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>
