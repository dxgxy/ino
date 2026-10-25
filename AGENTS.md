# AGENTS.md

## 工作约定
- 先更新 `PRD.md` 与 `TECH_DESIGN.md`，再实现功能。
- 代码按领域/功能分段，避免把服务端逻辑写进 UI 组件。
- 所有新增模块通过接口接入，默认可禁用、可离线降级。
- 关键函数写用途注释，组件只负责展示与事件编排。
- 运行 `npm run build` 作为提交前最低验证。
- 桌面开发运行 `npm install` 后执行 `npm run dev`；发布前执行 `npm run build`，再由 Electron 打包工具生成安装包。

## 扩展接口
后续模块应实现 `ReviewService`、`SearchService`、`ImportService`、`SyncService`、`CommunityService`、`BillingService`，由依赖注入替换本地 mock。
