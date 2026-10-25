# 开发与维护

## 目录

```text
src/
  App.tsx                 页面编排和状态边界
  domain/types.ts         卡片与领域类型
  features/account/       登录、注册和个人中心
  features/lists/         词书浏览、选词和自动分组
  features/review/        四种复习方案与 List 参数
  services/               词典、词库、List、复习、发音、账号服务
server/                   轻量账号 API、SQLite 和安全策略
electron/                 主进程、preload 和账号 IPC bridge
deploy/                   Nginx、systemd 和环境变量示例
scripts/                  开发、构建、检查和打包脚本
public/dictionaries/       词库来源与许可证元数据
```

## 开发命令

```bat
cd /d D:\ino
npm install
npm run dev
```

脚本说明：

- `npm run dev`：自动启动本地 API、Vite 和 Electron。
- `npm run dev:web`：只启动网页前端。
- `npm run server`：只启动账号 API。
- `npm run build`：TypeScript 检查与 Vite 生产构建。
- `npm run check:library`：验证 8,560 词条、词书、List 去重和持久化。
- `node scripts/check-review.mjs`：验证四种方案、成功门控、每日上限、跨日重置、衰减和 List 隔离。
- `npm run test:server`：运行真实 SQLite 账号集成测试。
- `npm run dist:win`：构建 NSIS 与便携版；本任务不默认执行打包。

## 代码约定

- TypeScript 使用 strict 模式，组件负责展示和事件编排，数据规则放在 `services`。
- 新的学习模块不能直接依赖账号后端；必须支持本地实现和离线降级。
- 复习、List 和账号状态都需要显式类型；持久化字段变更必须兼容旧数据或增加迁移。
- 关键算法函数写清输入、输出和边界；用户可见术语不要直接暴露内部字段名。
- 不在 UI 组件中保存密码、会话令牌或数据库连接。

## 本地数据

开发 API 默认数据库：`server/data/wordflow.sqlite`。该目录只属于本机运行数据，已被 Git 忽略。清理它会删除本地测试账号；不要把它复制到仓库或服务器代码包。

浏览器/Electron 学习数据使用 `localStorage` 版本键保存。当前学习数据不上传服务端；修改存储结构时必须保留旧版本读取能力。

## 远程账号服务

开发时可直接运行本地 API。生产桌面端启动前配置：

```bat
set WORDFLOW_API_URL=https://your-domain.example
```

服务端部署和 Nginx 配置见 `deploy/README.md`。服务器只承载账号 API 和 SQLite，词库与学习记录不需要上传。

## 打包故障排查

如果 Electron Builder 报 `EPERM` 重命名 `win-unpacked.tmp`：

1. 关闭旧的 Electron 应用和正在运行的打包进程。
2. 删除 `output/release` 下的临时目录。
3. 把产物输出到不被安全软件锁定的目录，例如 `C:/wordflow-release`。
4. 必要时设置 `ELECTRON_MIRROR` 和 `ELECTRON_BUILDER_BINARIES_MIRROR` 后重试。

项目源码路径中含特殊字符时，使用仓库提供的 Node 脚本，不要直接调用 npm `.cmd` 里的二进制路径。
