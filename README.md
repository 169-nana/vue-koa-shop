# 微商城（TypeScript）

当前维护的三个项目已经使用 TypeScript，后续新模块继续使用 TS。

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

Koa 使用原来的 `KoaServer/.env`：`PORT`、`JWT_SECRET`、`JWT_EXPIRES_IN`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`。请保留现有配置，数据库结构与数据未因迁移改变。`JWT_EXPIRES_IN` 推荐使用 `2h`、`30m` 等带单位的值。

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

## 不熟悉 TS 时怎么增加模块

见 [TypeScript 开发说明](docs/TypeScript开发说明.md)，里面有接口、页面和后端的写法。以后描述需要的业务功能即可，新增代码遵循 TS 约定。

依赖安装以各项目的 `package-lock.json` 为准，使用 `npm ci`。迁移时前台 Vite 从 3 升至 7，Vue 插件升至 6，以兼容原有 Vue Router 5；管理后台的 UI 库保持原版本。
