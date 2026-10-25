# 技术设计

## 架构
当前采用 React + TypeScript + Vite + Electron 桌面壳层。开发期 Electron 加载 Vite，生产期加载 `dist/index.html`。客户端使用本地缓存承载离线复习，服务端承载账号、词库、复习记录、AI 与商业化流水。

## 分层
- `src/features/*`：按功能拆分 UI 与交互。
- `src/domain/*`：卡面、List、复习调度等领域模型。
- `src/services/*`：API、AI、词书导入、MCP、埋点适配器。
- `src/storage/*`：本地 IndexedDB/SQLite 与同步队列。

## 接口约定
```ts
export interface WordCard { id:string; kind:'word'|'sentence'|'custom'; content:string; translation?:string; audioUrl?:string; tags:string[] }
export interface ReviewService { getDueCards(userId:string):Promise<WordCard[]>; submitReview(input:{cardId:string; rating:number}):Promise<void> }
export interface SearchService { search(query:string, scope:'local'|'server'):Promise<WordCard[]> }
export interface ImportService { importText(text:string):Promise<WordCard[]> }
```

## 数据策略
核心卡面与复习队列本地可用；账号、跨设备同步、AI 生成、外刊内容和商业化流水放在服务端。同步采用事件队列，冲突按 `updatedAt` 与服务端版本处理。

## 安全
最小权限 token、敏感数据加密、用户可导出/删除、关键词屏蔽服务端化、广告举报与审计日志独立模块。

## 代码格式
TypeScript strict；2 空格；组件 PascalCase；函数 camelCase；类型显式导出；每个服务接口说明输入/输出/失败行为；关键业务分支必须有注释。
# 词典与 List 设计记录

## 词典数据源
MVP 接入 Free Dictionary API（dictionaryapi.dev），按单词返回音标、释义、例句和音频地址。接口调用在 `src/services/dictionary.ts`，返回结果直接映射为 `WordCard`，可加入当前 List。

## 发音
优先播放词典返回的 `audioUrl`；没有音频时降级到浏览器 `speechSynthesis`。桌面版通过 Electron 的安全渲染进程运行，后续可替换为本地音频缓存服务。

## List 优先 UI
侧栏以 List 为一级导航，主区显示当前 List 的卡片行，右侧显示选中卡片详情。复习、收藏、词书导入都围绕 List 操作，避免将单张卡片作为孤立首页模块。

## 7. 本次迭代实现
- `src/services/dictionary.ts` 负责公开词典查询与 WordCard 映射。
- `src/App.tsx` 负责 List 选择、卡片导入、复习状态和发声事件编排。
- `scripts/dev.cjs`、`scripts/vite.cjs`、`scripts/electron.cjs` 绕过 Windows 路径中 `&` 对 npm `.bin` 的解析问题。

## ECDICT 数据构建
从固定版本 ecdict@0.0.4 分发包提取 CSV 与 MIT 许可，记录 SHA256 和来源；构建词条去重后的本地 JSON，保留中文、英文解释、音标、词形与标签。LibraryService 以异步接口载入本地资源，按词书提供候选词条，离线优先查词；不创建默认学习组。

## List 所有权修正
LibraryService 只返回候选卡片；StudyListService.create/generate 仅在用户确认后调用。localStorage 以版本化键保存用户列表；首次初始化为空数组。自动生成基于用户指定词书、起点、总数、每组10–30张，普通组去重。


## 轻量后端实现约定
使用Node.js内置HTTP与SQLite，服务端零npm运行依赖，单进程监听127.0.0.1:8787，Nginx反代TLS。SQLite WAL及4MiB页缓存；scrypt异步密码哈希（N32768 r8 p3），最多2个并发哈希，有限请求队列。API限制4KiB JSON、限流、参数化SQL、过期会话清理。网页使用HttpOnly会话Cookie和同源写请求校验；Electron使用主进程限定路由IPC，原始令牌仅在主进程内存，数据库仅存令牌SHA256。前端不持久化密码或会话令牌；离线缓存仅个人展示资料，不构成服务器身份。部署包只包含server及部署配置，不包含词典和客户端依赖。

### 本轮验证结果
真实SQLite集成测试覆盖注册登录、重启持久化、隔离、改密撤销旧会话、会话上限、来源校验、4KiB输入限制、限流和桌面IPC令牌隐藏。浏览器验证覆盖真实注册、错误密码、个人资料修改、刷新保持登录和访客/账号List隔离。小型集成测试主数据库32KiB、进程RSS约62MiB，仅为本机测量，生产负载需实测。后端部署包使用白名单文件，不包含学习词典或个人数据库。

## Windows exe 打包
- 使用 electron-builder，产物写入 output/release，仅包含 dist、electron 及运行所需文件。
- 使用 Node 脚本直接调用构建工具，兼容 Windows 项目路径中的 & 字符。
- 配置 WORDFLOW_API_URL 后启动桌面程序，通过真实注册/登录及 GET /api/health 验证后端；数据库仅在服务端。

## 当前实现清单

- React + TypeScript + Vite 渲染层，Electron 主进程负责桌面窗口和账号 IPC。
- `src/services` 承载词库加载、Free Dictionary 查询、发音降级、List 操作、复习调度和账号 API 客户端。
- `src/features/review` 承载四种作答流程和 List 复习参数；内部 `shortMark/longMark` 继续作为兼容存储字段，用户界面显示“今日巩固度/长期记忆度”。
- `localStorage` 按访客/账号分区保存学习状态；读取旧状态时缺少 `reviewRecords` 会自动补空数组。
- Node 内置 HTTP + SQLite 账号服务不依赖运行时 npm 包；Electron 桌面账号令牌只存在主进程内存。

## 重要非目标

当前服务端不保存词库、卡片、List、复习事件、音频、头像文件或社区内容；没有实现跨设备学习同步。`ReviewService` 等接口是扩展约定，不代表已存在完整远程实现。

## 构建验证

最低检查为 `npm run build`。功能检查包括 `npm run check:library`、`node scripts/check-review.mjs` 和 `npm run test:server`。Electron 安装包由 `npm run dist:win` 生成，但打包需要额外下载 Electron/NSIS 资源。
