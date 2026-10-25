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
