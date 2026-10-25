# WordFlow Android 模型交接文档

> 用途：切换模型/新对话时，先读取本文件，再继续 `D:\\ino_Android` 的 Android 任务。
> 当前日期：2026-10-25（Asia/Shanghai）

## 1. 当前工作区

- Android 工作目录：`D:\\ino_Android`
- Git 分支：`android/migrate`
- 远程仓库：`git@github.com:dxgxy/ino.git`
- 当前最新提交：`4153235 feat(android): refine mobile dashboard UI`
- 工作区状态：已推送、干净
- Android Studio：`D:\\Android\\AndroidStudio\\bin\\studio64.exe`
- SDK：`D:\\Android\\sdk`
- Java：`D:\\Android\\AndroidStudio\\jbr`
- Android 项目：`D:\\ino_Android\\android-app`

打开 Android Studio：选择 `D:\\ino_Android\\android-app`。

## 2. 产品当前状态

WordFlow（xx大人）是离线优先的背词应用。Android 不是重新实现一份业务，而是：

- React + TypeScript + Vite：共享业务和 UI。
- Android 原生 WebView：负责 APK 壳、原生 TextToSpeech、API 地址桥接。
- Node + SQLite 后端：只保存账号资料、密码哈希和会话。
- 词典、List、卡片、复习记录：留在本机，不上传服务器。

桌面代码与 Android 代码目前共用同一工作树；Android 分支的改动应优先考虑手机交互，不要直接套用桌面侧栏布局。

## 3. Android 首页当前 UI

入口组件：`src/features/home/HomeDashboard.tsx`
样式：`src/features/home/home.css`
路由编排：`src/App.tsx`

首页结构：

1. 顶部头像、昵称、学习等级、账号状态。
2. 离线双语词典/功能模块搜索。
3. 今日学习主卡：待复习数、开始复习/创建 List。
4. List 复习情况：今日达标、待复习、每日上限、进度条。
5. 今日简报：练习词次、今日达标、符合预期、需加强。
6. 艾宾浩斯规划：当前待复习 List 和未来 7 天预览。
7. 学习提示。
8. 底部导航：首页、List、设置、扩展。

首页不显示桌面端左侧 List 栏。List 侧栏仍保留在 List 工作区，可收起。

最近 UI 自评：8.8/10。

- 信息层级 9/10
- 单手可达性 9/10
- 复习主操作可见性 9/10
- 信息密度 8/10
- 窄屏适配 8/10
- 离线查询 9/10

已用 Playwright 检查 390×844 和 320×740；无明显横向溢出。真实设备还需检查状态栏、系统字体、TTS 语音包和安全区。

## 4. Android 复习功能

复习入口：`src/features/review/ReviewPanel.tsx`
复习算法：`src/services/review.ts`
List 设置：`src/features/review/ListSettings.tsx`

四种方案：隐藏含义、只听发音、含义拼写、含义识词。

流程：作答 → 立即播放发音 → 显示完整卡片 → 用户选择是否符合预期 → 更新记忆进度。

界面名称：

- 今日巩固度：当天复习进度，每天重置。
- 长期记忆度：跨天积累，按时间衰减。

每个 List、每张卡独立保存记录。长期衰减采用 FSRS-4.5 遗忘曲线的稳定度思想，项目是离散产品规则，不是完整 FSRS。

详细规则：`REVIEW_DESIGN.md`

## 5. Android 账号与后端

客户端账号：`src/services/account.ts`、`src/features/account/useAccount.ts`、`src/features/account/AccountPanel.tsx`。

Android 使用：

- 页面来源：`https://appassets.androidplatform.net`
- 请求头：`X-Wordflow-Client: android`
- bearer token 只存在当前 JS 页面内存，不写 localStorage。
- 服务端支持 CORS 预检和 Android bearer 会话。

后端：`server/index.mjs`、`server/database.mjs`、`server/security.mjs`。

- 数据库默认：`server/data/wordflow.sqlite`（本地运行数据，已忽略）
- Android 模拟器访问电脑本机后端：`http://10.0.2.2:8787`
- 实体手机使用电脑局域网 IP，例如 `http://192.168.1.100:8787`
- 生产必须使用 HTTPS。

账号测试已覆盖 Android OPTIONS 预检、注册 bearer token、`/api/auth/me`、SQLite 用户和密码哈希保存、Android bearer 会话及浏览器 Cookie 流程。

## 6. 发音链路

入口：`src/services/pronunciation.ts`。

顺序：词典 `audioUrl` → Android 原生 TextToSpeech → Web Speech API。

Android 原生代码：`android-app/app/src/main/java/com/xxdaren/wordflow/MainActivity.java`。

如果设备没有英语 TTS 语音包，原生桥返回失败，前端继续尝试 Web Speech API。

## 7. Android 构建

```bat
cd /d D:\\ino_Android
npm install
npm run build
npm run check:library
node scripts/check-review.mjs
npm run test:server

cd android-app
set JAVA_HOME=D:\\Android\\AndroidStudio\\jbr
gradlew.bat assembleDebug -PwordflowApiUrl=http://10.0.2.2:8787 --offline
```

APK：`D:\\ino_Android\\android-app\\app\\build\\outputs\\apk\\debug\\app-debug.apk`。

Gradle 在 `preBuild` 前自动执行共享前端构建，并把 `dist` 同步到 Android assets。

## 8. 当前已验证结果

最近一次通过：`npm run build`、`npm run check:library`、`npm run test:server`、Android `assembleDebug`，以及 Playwright 390×844 / 320×740：首页渲染、底部导航、离线功能搜索。

构建中唯一稳定的提示是 ECDICT 词库 chunk 大于 500 kB；这是内置离线词库导致的 warning，不是失败。

## 9. 重要文件索引

```text
src/App.tsx                              主页面路由和本地状态
src/features/home/HomeDashboard.tsx     Android 首页仪表盘
src/features/home/home.css               Android 首页样式
src/services/dashboard.ts                首页统计、List 复习摘要、离线规划
src/services/androidExtensions.ts        后续扩展注册接口
src/services/review.ts                   四方案复习和长期记忆度
src/services/studyLists.ts               List、学习状态、List 设置
src/services/pronunciation.ts            音频/TTS/Web Speech
src/services/account.ts                  账号客户端
server/index.mjs                         账号 API 和 Android CORS/bearer
android-app/app/build.gradle.kts         Android 构建和 Web 资源同步
android-app/app/src/main/.../MainActivity.java  WebView/TTS/API 桥
ANDROID.md                               Android 使用说明
REVIEW_DESIGN.md                          复习算法边界
```

## 10. 后续建议顺序

1. 在 Android 模拟器或实体机安装最新 APK，检查状态栏、安全区、返回键和 TTS。
2. 用实体手机的局域网后端地址验证注册、登录、账号验证和重新连接。
3. 检查首页点击 List、开始复习、设置、扩展返回路径。
4. 若 UI 评分低于 8/10，优先优化窄屏信息密度和触控目标，不恢复桌面侧栏。
5. 再考虑首页真实图标/背景资源、通知提醒、学习日历和更多扩展模块。

## 11. Git 约束

- 只修改 Android 分支：`android/migrate`。
- 用户明确说“只修改 Android”时，不要切换到 `main`，不要改 `C:\\Users\\31918\\Desktop\\i&o`。
- 不提交：`node_modules`、`dist`、`output`、`.builder-cache`、`server/data`、APK、Android `.idea`、Gradle daemon 生成文件。
- 提交前至少运行 `npm run build`、`npm run test:server` 和 Android `assembleDebug`。
- 推送命令：`git push origin android/migrate`。

## 12. 待开发模块路线图

本节是后续开发的唯一模块清单。模块按优先级排序；当前只完成设计和接口预留，除非另有任务，不要因为写入路线图就直接实现。

### P0：稳定性、可用性和发布基础

| 模块 | 目标与主要内容 | 数据边界 | 预留位置/接口 | 完成标准 |
| --- | --- | --- | --- | --- |
| Android 真机适配 | 安全区、系统返回键、横竖屏、不同字体、TTS 语言包检查 | 设备本地 | `android-app/.../MainActivity.java`、Android 生命周期适配器 | 至少一台实体机和模拟器完成注册、查询、复习、返回键测试 |
| 首次启动与引导 | 选择语言、每日目标、是否登录、离线模式说明 | 偏好本地保存 | `src/features/onboarding/`、`OnboardingService` | 新用户 3 步内进入首页，跳过后不重复出现 |
| 设置页 | API 地址、发音、每日上限、隐私、数据管理、主题和字体 | 设置本地；服务器地址不含密钥 | `src/features/settings/`、`SettingsService` | 每项设置有默认值、校验、重置和离线行为 |
| 本地备份与迁移 | 导出/导入 List、卡片、复习记录，支持 schema 版本升级 | 默认只在本地文件 | `src/services/backup.ts`、`BackupService` | 导出的 JSON 可校验、恢复，旧版本数据可迁移 |
| 本地提醒 | 到期 List、每日目标和连续学习提醒 | Android 本地通知，不上传学习内容 | `android-app` WorkManager/AlarmManager 桥接、`ReminderService` | 用户可开关和设定时间；离线仍能提醒 |
| 性能与无障碍 | 大词库查询、懒加载、TalkBack、触控尺寸、暗色模式 | 本地 | `src/features/search/`、组件语义属性 | 低端设备查询无明显卡顿；关键控件可读可操作 |
| 生产连接配置 | HTTPS、健康检查、断线重试、会话失效处理 | 只上传账号认证数据 | `src/services/apiClient.ts`、`SyncService` | 错误可解释；生产环境禁止明文 HTTP |

### P1：背词核心闭环

| 模块 | 目标与主要内容 | 数据边界 | 预留位置/接口 | 完成标准 |
| --- | --- | --- | --- | --- |
| B 类句子卡 | 句子、翻译、例句、注解、规范检测、盲听 | 默认本地 | `Card` 扩展、`SentenceCardService` | 可批量添加、编辑、删除，并进入盲听复习 |
| C 类自定义卡 | 单词、短语或句子，自选 A/B 类型，批量导入 | 默认本地 | `CustomCardService`、`CardImportAdapter` | 导入前预览和校验，失败行可导出修正 |
| 词书与文本导入 | CSV/TXT/JSON、外刊文本选词、去重、字段映射 | 词书和卡片本地 | `ImportService`、`src/features/import/` | 10 万行以内可分批导入；重复项有明确处理策略 |
| List 管理 | 用户创建为主，自动生成可接受；排序、标签、收藏、归档、复制、合并、删除 | List 本地 | 已有 `ListService`，补充 `ListRepository` | 不预置强制 List；每个操作可撤销或二次确认 |
| 完整复习引擎 | 四种方案、每日上限、队列、暂停/继续、FSRS 参数和日历 | 复习记录本地 | 已有 `ReviewService`、`review.ts` | 到期队列稳定；切换方案不丢失记录；规则可测试 |
| 错题与薄弱词 | 记录失败原因、最近错误、需加强 List、再次练习 | 本地 | `WeakItemService`、`ReviewEvent` | 能从复习结果生成可编辑的薄弱词 List |
| 离线词典升级 | 双语模糊查询、词性、词根、例句、音频缓存、功能模块搜索 | 词典和音频缓存本地 | `SearchService`、`DictionaryProvider`、`FeatureRegistry` | 无网络仍可查双语词和功能；无结果时提供建议 |

### P2：账号同步和个性化

| 模块 | 目标与主要内容 | 数据边界 | 预留位置/接口 | 完成标准 |
| --- | --- | --- | --- | --- |
| 学习数据同步 | List、卡片、复习事件的可选同步，离线队列和冲突解决 | 仅用户明确开启后上传 | `SyncService`、`server/routes/sync.mjs`、同步事件表 | 可查看同步状态；重复提交幂等；冲突可解释 |
| 账号资料与等级 | 头像、昵称、等级、成就、宠物、连续学习 | 资料和成就服务器保存；详细学习内容仍可本地 | `AccountService`、`CommunityService` | 多设备登录可恢复资料；注销可删除服务器资料 |
| AI 查询与生成 | 词根解释、例句、模糊问答、缺少翻译时生成 | 请求内容最小化上传；结果可缓存本地 | `AiService`、provider adapter、配额策略 | 无密钥时优雅降级；超额、超时和敏感词有提示 |
| 学习统计 | 日/周/月趋势、List 完成率、复习准确率、学习日历 | 默认本地；同步时仅传汇总 | `StatsService`、`dashboard.ts` 扩展 | 指标口径固定，可从事件重算 |

### P3：社区、商业化和运营

| 模块 | 目标与主要内容 | 数据边界 | 预留位置/接口 | 完成标准 |
| --- | --- | --- | --- | --- |
| 社区与共享 List | 发布、收藏、关注、评论、榜单、导入他人 List | 公共内容服务器保存；私有 List 默认不公开 | `CommunityService`、社区 API | 发布前明确隐私；可撤回、举报和拉黑 |
| 内容安全管理 | 关键词屏蔽、举报、审核状态、管理员操作日志 | 服务器处理公共内容 | `ModerationService`、`server/admin/` | 屏蔽规则可配置；举报有状态和审计记录 |
| 学习目标与商业化 | 雅思、六级、旅行日期目标；赞助、广告、感谢名单 | 目标本地；订单/权益服务器保存 | `GoalService`、`BillingService` | 目标可暂停/修改；付费失败不影响离线学习 |
| 广告与反馈 | 规范广告位、广告举报、问题反馈 | 只上传必要事件 | `AdService`、`FeedbackService` | 广告可关闭或标记；举报入口可达 |
| 运维与发布 | 限流、配额、备份、监控、灰度、签名 APK、CI | 服务器日志脱敏 | `server/observability/`、`.github/workflows/` | 可回滚、可追踪错误；正式包可验证来源 |

## 13. 通用实现约束

- 领域接口优先：先在 `src/services/contracts.ts` 定义输入、输出、错误和离线策略，再实现 UI 或后端。
- 本地优先：词典、List、卡片和详细复习事件默认不进入服务器；同步必须由用户主动开启并可关闭。
- 服务器轻量化：服务器只保存账号、会话、同步队列所需的最小数据和公共内容，禁止上传原始密码、长期 bearer token 或不必要的词典副本。
- 可替换提供者：词典、AI、音频、同步和支付都使用 adapter，避免把第三方 SDK 写入页面组件。
- 可测试接口：每个模块提供纯函数或 service contract 测试；UI 测试覆盖主要触控路径和窄屏布局。
- 统一错误：服务返回稳定的错误码和用户可读文案；网络失败必须有离线替代或重试入口。
- UI 规则：移动端以首页摘要和 List 工作区为核心，使用 Material 3 风格的层级、触控目标和底部导航；不复制第三方应用的品牌资源或页面代码。

## 14. 模块完成检查清单

新增模块合并前必须确认：

1. PRD、接口契约和数据归属已经更新。
2. 已说明联网、离线、权限、失败和删除行为。
3. Android 小屏、返回键、无障碍和旋转场景已检查。
4. 本地数据有迁移/导出策略；服务器数据有最小化和注销策略。
5. 关键业务规则有自动化测试，文档命令可复现。
6. `npm run build`、`npm run test:server` 和 Android `assembleDebug` 通过后才提交。

## 15. 推荐下一开发切片

优先完成 P0 的设置页、备份迁移、真机适配和本地提醒，再完成 P1 的 B/C 卡导入与 List 管理。同步、社区、AI 和商业化依赖数据模型稳定及隐私策略，暂不与本地复习闭环混在同一个提交中。
