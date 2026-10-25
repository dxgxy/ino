# 小服务器部署说明

目标机器：截图中的宝塔Linux实例，2 vCPU / 2 GiB / 40 GiB磁盘。
此配置不连接或修改现有服务器，需要在宝塔/SSH中由服务器管理员执行。

## 数据边界

服务器仅保存 `users`（账号、scrypt密码哈希、昵称、每日目标、头像配色、创建时间）与 `sessions`（令牌SHA256、用户ID、到期时间）。
没有词典、List、卡片、复习明细、音频、头像上传、聊天或行为日志接口。
IP限流计数只在内存中，最多4096项，过期清理。每账号最多5条会话，最长7天。

客户端自带词库和发音能力。访客、不同账号的学习记录在本机独立分区；登录不会自动合并访客内容，也不会提供跨设备学习记录同步。
网页使用HttpOnly/SameSite会话Cookie；桌面令牌仅保存在主进程内存，关闭桌面应用后需要重新登录。
离线缓存的昵称仅供展示和定位本机数据，不授予服务端权限。

## 本机运行

要求Node.js 22.14+，推荐在服务器使用当前受维护的Node.js 24 LTS。
Node内置SQLite在22版本会输出实验性功能提示，本项目在22.14.0运行通过。
本后端没有npm运行依赖，服务器无需 npm install，更无需上传前端 node_modules。

项目根目录执行 `npm run server`，启动账号API。另开终端执行 `npm run dev:web`。
浏览器访问 `http://127.0.0.1:5173`，进入“登录 / 注册”。不要改成 localhost，否则需同步修改 PUBLIC_ORIGIN。
`npm run dev` 会自动启动/复用本地API并打开桌面应用。
数据库默认在 `server/data/wordflow.sqlite`。开发默认监听环回地址，不开放公网端口。

## 生产上传

1. 本机执行 `npm run package:server`。将生成的 `output/wordflow-api.tar.gz` 上传到服务器，解压至 `/opt/wordflow-api`。
2. 安装受维护的Node 24 LTS；用 `command -v node` 确认路径，并修改 `deploy/wordflow-api.service` 的 ExecStart。若宝塔将Node装在root家目录，请将运行时放到普通系统目录，以适配 ProtectHome。
3. 新建系统运行用户（按发行版使用 useradd 或等效命令）：

```sh
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin wordflow
sudo mkdir -p /var/lib/wordflow
sudo chown wordflow:wordflow /var/lib/wordflow
sudo chmod 700 /var/lib/wordflow
sudo cp /opt/wordflow-api/deploy/wordflow-api.env.example /etc/wordflow-api.env
sudo chmod 600 /etc/wordflow-api.env
```

4. 修改 `/etc/wordflow-api.env`：PUBLIC_ORIGIN设为已配置SSL的真实域名，例如 `https://words.example.com`。不要保留示例域名，也不要配置明文公网IP。图片里的8.130.9.172只表示主机地址，不能代替HTTPS域名。
5. 将service文件中的Node路径改正确后安装服务：

```sh
sudo cp /opt/wordflow-api/deploy/wordflow-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wordflow-api
sudo systemctl status wordflow-api
curl http://127.0.0.1:8787/api/health
```

6. 宝塔中使用已有的Nginx站点与SSL，将 `nginx-api.conf` 中 location 块加入该站点配置；测试Nginx配置后重载。保持8787端口仅限本机，不需要在安全组开放。不要安装第二套Nginx、MySQL或Redis。
7. 本地桌面客户端连接该账号服务：在启动前设置 `WORDFLOW_API_URL=https://真实域名`，再 `npm run dev`。网页部署则让前端页面与 `/api` 位于同一个HTTPS域名。

生产后端包不含词典或前端页面。若选择网页访问，需要另将本地构建的 `dist` 放到Nginx站点目录；这种模式会使用静态资源带宽。桌面模式不需要服务器托管词库。

## 资源与维护

单进程Node + SQLite，无ORM、Redis、MySQL、容器或服务端TTS。
SQLite页缓存4MiB，WAL保留上限1MiB；正常检查点由SQLite自动管理。每次密码计算约32MiB，最多2个并发；忙时503，不排无界队列。
systemd限制堆96MiB、进程总内存256MiB，防止挤占整机。该上限包含保护策略，不是实际使用量承诺；上线后应查看真实实例指标再调整。
本机22.14.0集成测试（2账号/多次登录）数据库主文件32KiB，测试进程RSS约62MiB；不代表生产负载测试。

备份不要在运行中只复制 .sqlite 而忽略WAL。使用 SQLite在线备份命令，或在维护窗口停服务后复制数据库，再启动服务。示例：

```sh
sudo systemctl stop wordflow-api
sudo install -d -m 700 /var/backups/wordflow
sudo cp /var/lib/wordflow/wordflow.sqlite /var/backups/wordflow/wordflow.sqlite.bak
sudo chmod 600 /var/backups/wordflow/wordflow.sqlite.bak
sudo systemctl start wordflow-api
```

备份含账号哈希，放在站点目录之外，定期下载到自己的安全设备；本机最多保留7份，不将备份上传到公开仓库。
建议只保留有限journal日志，避免与宝塔已有日志一起长期占盘。此API不记录密码、原始令牌或请求体。
注册默认每IP每小时最多5次，登录/注册合计每15分钟30次，同一账号15次；大量用户同一出口IP时应根据真实使用再调整限流。

## 验证命令

`npm run test:server` 覆盖真实SQLite持久化、密码哈希、账号隔离、会话撤销、输入限制、来源校验、限流和桌面桥接。
`npm run check:library` 与 `npm run build` 验证客户端。上线前还应通过真实HTTPS域名验证Cookie和反向代理配置。
