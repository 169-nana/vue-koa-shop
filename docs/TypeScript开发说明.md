# TypeScript 开发说明

## 你平时需要做什么

日常启动仍然用 `npm run dev`。TS 会在编辑器里提醒“字段写错了”“这里可能为空”等问题。保存前可以运行根目录 `npm run typecheck`，它不会修改业务数据。

Vue 文件后缀仍是 `.vue`，只把脚本声明写成：

```vue
<script setup lang="ts">
import { ref } from 'vue'
const loading = ref(false) // 能推断出 boolean，不必给每个变量手写类型
</script>
```

## 增加一个模块的顺序

1. 在 `shared/api.ts` 定义接口的输入和输出。
2. 在后端 Service 写数据库操作，给查询结果和返回值标明类型。
3. 在 Controller 使用 `AppMiddleware<返回类型>`，继续检查真实请求参数。
4. 在 Router 挂载接口，按业务需要接入鉴权。
5. 在前端 `src/api/index.ts` 添加有类型的 API 函数，再写页面。
6. 运行类型检查、相关测试和构建。

示例类型（示意，不代表已经实现订单接口）：

```ts
export interface OrderSummary {
  id: number
  status: 'pending' | 'paid' | 'cancelled'
}
```

前端请求写法：

```ts
export const getOrder = (params: { id: number }) =>
  request.get<OrderSummary>('/home/order', { params })
```

这样调用 `getOrder({ id: 'abc' })` 会报错，编辑器也会提示返回数据具有 `id` 和 `status`。

## 本项目已经处理的几种情况

- **接口响应**：服务器仍返回 `{ errno, data, errmsg }`；前端统一请求层检查业务状态，再返回业务数据。没有业务数据的成功响应返回 `null`。页面不再拿 Axios 原始响应当业务对象。
- **表单空值**：商品价格、库存和分类未填写时使用 `undefined`，提交前校验并缩小为 `number`。不要随意把空字符串强转为数字，否则 `Number('')` 会得到 `0`。
- **相册**：商品详情返回图片对象数组，提交时使用 `string[]`。上传中的 `blob:` URL 不能写入数据库。
- **登录状态**：token 可以为空，用户 ID 在未加载时可为 `null`；使用前处理这些状态。
- **组件实例**：表单使用 `ref<FormInstance>()`，通过 `formRef.value?.validate()` 调用。组件未挂载时 ref 可能不存在。
- **后端请求**：`getBody(ctx.request.body)` 返回 `Record<string, unknown>`。先用 `typeof`、数值范围等校验，再传给 Service。
- **数据库金额**：mysql2 的 DECIMAL 行数据使用字符串类型；保留原有参数化 SQL、事务和金额校验。

## 不要用来“消除红线”的写法

不要直接添加 `any`、`@ts-ignore` 或大量 `as 某类型`。先确认数据真正可能是什么、在哪里完成了转换。少数边界断言集中在网络数据、环境配置等位置，并有明确说明。

TS 不检查外部请求的真实性，也不验证 SQL 与数据库结构一致。鉴权、运行时校验和实际联调仍然必要。

## 兼容说明

管理后台保留 Element Plus 2.2 等旧版本，其声明文件的包导出配置不完整，因此 `tsconfig.json` 设置 `resolvePackageJsonExports: false` 来读取已有声明；`strict` 和模板检查仍然开启。未来升级这些依赖后，可以重新评估该兼容设置。

根目录 `AGENTS.md` 已记录“新模块一律使用 TS”的约定，后续由代码助手继续开发时也应遵守。
