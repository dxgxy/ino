# WordFlow xx大人

离线优先的 Windows 桌面背词应用。项目以用户创建的 List 为核心，内置 ECDICT 词库，支持多种复习模式、发音、账号中心和轻量账号后端。

## 当前功能

- **List 管理**：首次启动不创建默认 List；用户可以创建空 List、从词书选词、按范围自动分组、重命名、调整顺序、删除和移除卡片。
- **本地词库**：内置 8,560 个去重词条，分为四级、六级、雅思和常用英语资料；词库不自动创建学习任务。
- **查词与导入**：优先查本地词库，未命中时请求 Free Dictionary API；查询结果可以直接加入当前 List。
- **卡片详情**：英文、中文释义、英文解释、音标、词形、例句、标签、来源和音频地址；本地或系统语音可离线降级。
- **四种复习方案**：隐藏含义、只听发音、含义拼写、含义识词。作答后播放发音并展示完整卡片，用户确认是否符合预期后才写入复习结果。
- **记忆进度**：界面使用“今日巩固度”和“长期记忆度”两个名称。每个 List 的每张卡片独立记录；今日巩固度按天重置，长期记忆度按时间衰减。
- **复习设置**：每个 List 可设置长期记忆度初值、今日巩固度达标值、每词每日尝试上限和归档阈值。达到阈值的卡片归档，可恢复。
- **账号中心**：注册、登录、查看/修改昵称、每日目标、头像配色、修改密码和退出登录。账号数据由独立 Node + SQLite API 保存。
- **离线边界**：词典、List、卡片、复习记录都保存在当前浏览器/Electron 数据区；服务器不保存学习明细。

## 快速开始

```bat
cd /d D:\ino
npm install
npm run dev
```

`npm run dev` 会启动本地账号 API、Vite 和 Electron。只运行网页：

```bat
npm run dev:web
```

访问 `http://127.0.0.1:5173`。只运行账号 API：

```bat
npm run server
```

健康检查：

```bat
curl http://127.0.0.1:8787/api/health
```

## Windows 打包

```bat
cd /d D:\ino
npm run dist:win
```

默认产物写入 `D:\ino\output\release`，包含 NSIS 安装版和 x64 便携版。打包器下载失败时可设置 Electron 镜像；详见 `docs/DEVELOPMENT.md`。

## 验证

```bat
npm run build
npm run check:library
node scripts/check-review.mjs
npm run test:server
```

## 文档索引

- `docs/FEATURES.md`：当前功能、用户流程和数据边界。
- `docs/DEVELOPMENT.md`：目录、开发、测试、打包和故障排查。
- `PRD.md`：产品范围、MVP 和后续模块。
- `TECH_DESIGN.md`：架构、接口、存储和安全设计。
- `REVIEW_DESIGN.md`：四种复习方案、今日巩固度/长期记忆度规则和 FSRS 边界。
- `server/API.md`：账号 API。
- `deploy/README.md`：2 vCPU / 2 GiB 小服务器部署说明。
- `THIRD_PARTY_NOTICES.md`：词库与第三方来源和许可证。

## 数据与隐私

客户端学习数据默认不上传。账号后端只保存必要的账号资料、密码哈希和会话；原始密码、学习卡片、List、复习明细、词库、音频和本地数据库不会提交到 Git。请勿将 `server/data/wordflow.sqlite` 或任何 `.env` 文件上传。
