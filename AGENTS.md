# 项目开发约定

- 维护范围：`my-shop`（商城前台）、`shop-system`（管理后台）、`KoaServer`（在用后端）。
- 新业务代码一律使用 TypeScript：逻辑文件使用 `.ts`，Vue 组件使用 `<script setup lang="ts">`。纯模板组件可不写 script。
- 保持 `strict: true` 和前端模板检查。不能用 `any`、`@ts-ignore`、`@ts-nocheck` 或关闭检查来掩盖业务类型错误。
- 前后端接口契约统一放在 `shared/api.ts`，共用纯函数可放在 `shared/`；不能在共享模块引入数据库、Node 专有 API 或浏览器全局对象。
- 数据库行、API 返回、提交参数、未填写的表单状态应分别建模。金额在数据库层保持 DECIMAL 字符串，接口层遵守现有转换规则。
- 后端输入视为 `unknown`，使用 `getBody` 后继续做运行时校验。TS 类型不能替代鉴权、数据校验或数据库事务。
- 新增 Controller 使用 `AppMiddleware<响应数据类型>`，新增 API 函数明确参数类型和请求泛型。错误必须先缩小类型再读取属性。
- 后端使用 TS 的 import/export；构建编译为 Node CommonJS。开发运行 `tsx`，生产运行编译产物。资源目录使用 `projectRoot`，避免编译后路径变化。
- 根目录 `npm run typecheck` 检查三个项目，`npm test` 执行无需数据库写入的回归测试，`npm run build` 验证全部构建。变更后运行适当检查；迁移或跨层变更运行全部。
- 使用 npm 和 `package-lock.json` 安装依赖；历史 yarn.lock 不再作为安装依据。
- 保留用户已有的未提交修改；不擅自提交、推送、修改真实账号密码或写入测试数据到真实数据库。
