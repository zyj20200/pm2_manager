# PM2 管理器

基于 Web 的 PM2 管理 UI + API，前端使用 Vite/React，后端为
Express + tRPC。

## 技术栈
- 前端：Vite、React、Tailwind
- 后端：Express、tRPC、Socket.IO
- 数据库：Drizzle ORM + MySQL

## 目录结构
- `client/` — 前端源码（`client/src/main.tsx`）
- `server/` — 后端服务与 API 路由
- `shared/` — 前后端共享的类型与常量
- `drizzle/` — 数据库 schema 与 SQL 迁移

## 快速开始
前置：Node.js 与 pnpm。

```bash
pnpm install
pnpm dev
```

开发模式会启动后端，并通过 Vite 提供前端资源。如果 3000 端口被占用，
会自动选择下一个可用端口。

## 常用命令
```bash
pnpm dev     # 本地开发（watch 模式）
pnpm build   # 构建前端并打包后端到 dist/
pnpm start   # 运行生产构建
pnpm check   # TypeScript 类型检查
pnpm test    # 运行 Vitest 测试
pnpm format  # 使用 Prettier 格式化
pnpm db:push # 生成并应用 Drizzle 迁移
```

## 配置说明
环境变量通过 `dotenv` 加载。请将本地密钥保存在 `.env` 中，
避免提交环境相关配置。

## 测试
测试使用 Vitest，目录为 `server/**/*.test.ts` 和
`server/**/*.spec.ts`。
