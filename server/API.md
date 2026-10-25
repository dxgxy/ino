# 账号接口说明

默认服务地址：`http://127.0.0.1:8787`（仅本机开发）。正式使用HTTPS反代域名。
所有写入必须为 `Content-Type: application/json`，最大4096字节。未知字段返回400，未知接口返回404。

| 方法 | 路径 | 输入 | 成功响应 |
| --- | --- | --- | --- |
| GET | /api/health | 无 | `{ok:true}` |
| POST | /api/auth/register | username,password,nickname | 201，user与会话 |
| POST | /api/auth/login | username,password | 200，user与会话 |
| GET | /api/auth/me | 有效会话 | 200，user |
| POST | /api/auth/logout | `{}` | 200，撤销当前会话 |
| PATCH | /api/account/profile | nickname,dailyGoal,avatarColor | 200，更新后的user |
| POST | /api/account/password | currentPassword,newPassword | 200，撤销原会话并签发新会话 |

`user`仅含id、username、nickname、dailyGoal、avatarColor、createdAt，不含哈希或令牌。
username为3–32位ASCII字母数字下划线，不区分大小写；密码10–128字符；昵称1–24字符；每日目标5–200；配色forest/ocean/sunset/violet。
数据库不存密码原文，使用独立随机盐的scrypt哈希。每账号最多5条有效会话，7天到期。

网页：写请求Origin必须与PUBLIC_ORIGIN完全一致；会话通过HttpOnly/SameSite=Strict/生产Secure的Cookie处理。无需且不允许由前端localStorage管理登录令牌。
桌面：仅主进程发送 `X-Wordflow-Client: desktop`、不带Origin；登录返回token，由主进程内存保存，其后使用Bearer发送。该标记不是授权凭据，服务器仍校验密码/令牌；桌面渲染进程不能看到token。重定向不会被跟随。
服务器不启用跨域CORS，因此网页前端必须与API同源，开发通过Vite代理。

错误响应为 `{error:说明}`：400参数/当前密码错误，401未登录或账号密码错误，403来源不允许，409账号冲突，413请求过大，415格式错误，429限流，503繁忙。
修改资料依据会话user_id定位，不接受请求体中的用户ID，不能修改其他账号。

生产域名与Nginx配置、资源限制、备份步骤见deploy/README.md。
