# 微商城（TypeScript）

| 目录 | 用途 |
| --- | --- |
| `my-shop` | 商城前台，Vue + Pinia + Vue Router |
| `shop-system` | 管理后台，Vue + Element Plus |
| `KoaServer` | 在用的 Koa + MySQL 后端 |
| `shared` | 前后端共用的接口类型与纯函数 |

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

首次启动先复制 `KoaServer/.env.example` 为 `KoaServer/.env`，创建空数据库后执行：

```sh
npm run migrate --prefix KoaServer
npm run init-admin --prefix KoaServer -- admin "请替换为强密码"
```

如果数据库已经手工执行过 `000` 至 `015`，首次启用迁移记录时使用
`npm run migrate --prefix KoaServer -- --baseline=015`；该命令只标记旧迁移，再执行 `016`，使用前必须确认旧结构确实齐全。

开发环境订单使用模拟支付；`NODE_ENV=production` 时模拟支付入口自动禁用。真实支付渠道应调用支付回调服务并使用独立的 `PAYMENT_CALLBACK_SECRET` 验签。服务进程每分钟关闭超时未支付订单并释放库存，已发货七天且没有待处理售后的订单会自动确认收货。

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

升级前先备份数据库，再执行 `npm run migrate --prefix KoaServer`。迁移器会按文件名顺序执行、记录校验和，并拒绝已执行后又被修改的脚本；应用代码不能先于对应迁移上线。

- 审核人员：查看记录、强制下架商品、暂停经营；管理员额外拥有撤销资质和恢复经营权限。后端每次处置重新查询有效账号角色，页面按钮仅用于提示权限。
- 暂停经营会下架全部商品；恢复仅恢复经营资格，必须填写恢复依据，商品仍需重新上架，平台强制下架商品需整改复审。
- 撤销资质须输入完整店铺名称确认；关联商品逐条留痕，待审核申请记录为因处置终止，通过关联处置编号追溯。恢复记录关联最近一次暂停记录。
- 四个标签独立分页和筛选；详情区分历史快照与当前对象信息。旧记录缺少的快照及关联不伪造回填。
- 弹窗展示当时对象及预计影响数量；提交时在事务锁内比较对象内容及处置版本，过期操作要求刷新。关联记录、业务变更和通知使用同一事务。

## 顾客智能体运营

- `009` 创建知识库、调用日志和转化事件，`010` 创建带确认的一次性加购动作，`011` 增加反馈、Prompt 版本、自动评测和运营指标。
- 管理后台“智能体运营”支持指标看板、知识有效期、Prompt 发布/回滚和评测用例。审核人员只读，管理员可写；Prompt 自动评测低于 75 分不能发布。
- 顾客端只提交回答编号和评价，不保存完整对话到运营日志；反馈会校验回答所属用户或游客会话。自动评测会调用 `.env` 中配置的模型，运行前应确认评测问题和商品数据可发送到该服务。
- `012` 增加商品级售后、一次性售后确认凭证和人工客服工单。智能体只能查询资格并准备确认卡，退款金额由订单快照在服务器端重新计算，顾客确认后仍需管理员审核。
- `013` 保存登录顾客的智能体文本对话，并通过游标分页按需加载更早记录；一次性操作凭证及历史商品价格、库存不写入聊天历史。
- `014` 增加智能体多会话和最近商品候选上下文，让“第一个/第二个商品”等后续指代可稳定映射到商品 ID，并对明确加购意图强制进入工具调用轮次；登录用户历史保留 90 天。
- `015` 增加会话版本并关联确认动作与请求；清空对话后旧请求不能回写，停止生成会中断服务端模型请求，未过期确认卡可在重新打开聊天窗口后恢复。
