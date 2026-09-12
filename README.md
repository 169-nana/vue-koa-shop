# 微商城（TypeScript）

| 目录 | 用途 |
| --- | --- |
| `my-shop` | 商城前台，Vue + Pinia + Vue Router |
| `shop-system` | 管理后台，Vue + Element Plus |
| `KoaServer` | 在用的 Koa + MySQL 后端 |
| `shared` | 前后端共用的接口类型与纯函数 |
| `shop-backend` | ThinkJS 历史代码，未迁移 |

## 运行项目

使用 Node.js 22.12 或更新的兼容版本，推荐 Node.js 22 LTS。在项目根目录执行：

```sh
npm run setup
```

然后打开三个终端，分别运行：

```sh
npm run dev:api
npm run dev:admin
npm run dev:shop
```

Vite 会输出实际页面地址。两端默认访问 `http://localhost:8360`；可在各自 `.env.local` 中设置 `VITE_API_BASE_URL`，管理后台还支持 `VITE_ASSET_BASE_URL`。

Koa 使用 `KoaServer/.env`：`PORT`、`JWT_SECRET`、`JWT_EXPIRES_IN`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`，以及顾客智能体所需的 `DEEPSEEK_API_KEY`、可选的 `DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL`。不要把真实密钥提交到仓库。`JWT_EXPIRES_IN` 推荐使用 `2h`、`30m` 等带单位的值。

## 检查和构建

```sh
npm run typecheck   # 三个项目的严格类型检查，含 Vue 模板
npm test            # 无需真实数据库写入的回归测试
npm run build       # 构建两个前端和 Koa 后端
```

每个前端的 `npm run build` 会先检查类型。后端的 `npm run check` 现在检查整个项目，不再只检查入口语法。

生产启动后端：

```sh
cd KoaServer
npm start
```

`npm start` 会先构建，再运行 `dist/KoaServer/app.js`。开发入口已由 `app.js` 改为 `app.ts`，请把 IDE 中旧的 `node app.js` 启动配置改为 `npm run dev`。生产环境若只安装运行依赖，先在构建环境执行构建，再运行 `node dist/KoaServer/app.js`；部署时保留整个 `KoaServer/dist`、`KoaServer/public`、`KoaServer/package.json` 和 `.env`。


## 违规处置与记录

升级前先备份数据库，再按文件名顺序执行 `KoaServer/sql/001` 至 `011` 的迁移。迁移脚本只执行一次，应用代码不能先于对应迁移上线。

- 审核人员：查看记录、强制下架商品、暂停经营；管理员额外拥有撤销资质和恢复经营权限。后端每次处置重新查询有效账号角色，页面按钮仅用于提示权限。
- 暂停经营会下架全部商品；恢复仅恢复经营资格，必须填写恢复依据，商品仍需重新上架，平台强制下架商品需整改复审。
- 撤销资质须输入完整店铺名称确认；关联商品逐条留痕，待审核申请记录为因处置终止，通过关联处置编号追溯。恢复记录关联最近一次暂停记录。
- 四个标签独立分页和筛选；详情区分历史快照与当前对象信息。旧记录缺少的快照及关联不伪造回填。
- 弹窗展示当时对象及预计影响数量；提交时在事务锁内比较对象内容及处置版本，过期操作要求刷新。关联记录、业务变更和通知使用同一事务。

## 顾客智能体运营

- `009` 创建知识库、调用日志和转化事件，`010` 创建带确认的一次性加购动作，`011` 增加反馈、Prompt 版本、自动评测和运营指标。
- 管理后台“智能体运营”支持指标看板、知识有效期、Prompt 发布/回滚和评测用例。审核人员只读，管理员可写；Prompt 自动评测低于 75 分不能发布。
- 顾客端只提交回答编号和评价，不保存完整对话到运营日志；反馈会校验回答所属用户或游客会话。自动评测会调用 `.env` 中配置的模型，运行前应确认评测问题和商品数据可发送到该服务。
