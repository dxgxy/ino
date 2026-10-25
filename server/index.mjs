import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, publicUser, transaction } from './database.mjs';
import { ApiError, createLimiter, hashPassword, newToken, tokenHash, validatePassword, validateProfile, validateUsername, verifyPassword } from './security.mjs';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'wordflow_session';
const routes = new Set(['GET /api/health', 'GET /api/auth/me', 'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'PATCH /api/account/profile', 'POST /api/account/password']);

function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw new ApiError(415, '请求必须为JSON');
  return new Promise((resolveBody, reject) => {
    let size = 0; const chunks = []; let excessive = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 4096) { excessive = true; chunks.length = 0; reject(new ApiError(413, '请求内容过大')); }
      else if (!excessive) chunks.push(chunk);
    });
    req.on('end', () => {
      if (excessive) return;
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolveBody(value);
      } catch { reject(new ApiError(400, 'JSON格式错误')); }
    });
    req.on('error', reject);
  });
}
function checkFields(body, allowed) {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new ApiError(400, '请求包含不支持的字段');
}

/** 可嵌入测试；正式部署直接运行本文件，不加载前端包或词库。 */
export async function createApi(config = {}) {
  const production = config.production ?? process.env.NODE_ENV === 'production';
  const origin = config.origin ?? process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5173';
  if (production && !/^https:\/\//.test(origin)) throw new Error('生产环境必须设置HTTPS PUBLIC_ORIGIN');
  const trustProxy = config.trustProxy ?? process.env.TRUST_PROXY === '1';
  const db = openDatabase(config.database ?? process.env.DATABASE_PATH ?? resolve('server/data/wordflow.sqlite'));
  const limiter = createLimiter();
  // 未知账号也执行相同成本的校验，避免通过计算时间探测账号。
  const dummyHash = await hashPassword(newToken());
  const prune = () => { db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now()); limiter.cleanup(); };
  prune();
  const timer = setInterval(prune, 15 * 60 * 1000); timer.unref();
  const cookie = (token, clear = false) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${clear ? 0 : SESSION_MS / 1000}${production ? '; Secure' : ''}`;
  const findUser = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const createSession = userId => {
    const token = newToken(); const now = Date.now();
    db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(tokenHash(token), userId, now, now + SESSION_MS);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC,rowid DESC LIMIT 5)').run(userId, userId);
    return token;
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { if (!res.writableEnded) { res.writeHead(status); res.end(JSON.stringify(body)); } };
    try {
      const path = new URL(req.url, 'http://local').pathname;
      const route = `${req.method} ${path}`;
      const clientType = String(req.headers['x-wordflow-client'] ?? '');
      const requestOrigin = String(req.headers.origin ?? '');
      const androidOrigin = requestOrigin === 'https://appassets.androidplatform.net';
      const android = clientType === 'android' && androidOrigin;
      if (androidOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Wordflow-Client, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') {
          const method = String(req.headers['access-control-request-method'] ?? '');
          const headers = String(req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
          if (!['GET', 'POST', 'PATCH'].includes(method) || headers.some(h => !['content-type', 'x-wordflow-client', 'authorization'].includes(h))) throw new ApiError(403, '不支持的跨域请求');
          if (!routes.has(`${method} ${path}`)) throw new ApiError(404, '接口不存在');
          return reply(204, {});
        }
      }
      if (!routes.has(route)) { req.resume(); throw new ApiError(404, '接口不存在'); }
      const peer = req.socket.remoteAddress ?? '';
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
      // 仅信任本机Nginx覆盖的X-Real-IP，不信任公网直传头。
      const clientIp = trustProxy && loopback ? String(req.headers['x-real-ip'] ?? peer).slice(0, 64) : peer;
      limiter.hit(`all:${clientIp}`, 180, 60_000);
      const desktop = (clientType === 'desktop' && !req.headers.origin) || android;
      if (!android && req.headers.origin && req.headers.origin !== origin) throw new ApiError(403, '不允许的请求来源');
      if (!['GET', 'HEAD'].includes(req.method) && !desktop && req.headers.origin !== origin) throw new ApiError(403, '请从应用页面发起请求');
      if (!android && req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, '不允许的请求来源');
      if (route === 'GET /api/health') return reply(200, { ok: true });
      const rawToken = desktop ? String(req.headers.authorization ?? '').replace(/^Bearer /, '') : (req.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      const session = rawToken && rawToken.length <= 100 ? db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(rawToken), Date.now()) : undefined;
      const requireUser = () => { if (!session) throw new ApiError(401, '请先登录'); return findUser(session.user_id); };
      if (route === 'GET /api/auth/me') return reply(200, { user: publicUser(requireUser()) });
      // 登录与注册必须在昂贵哈希运算前限流。
      if (path === '/api/auth/login' || path === '/api/auth/register') limiter.hit(`auth:${clientIp}`, 30, 15 * 60_000);
      if (path === '/api/auth/register') limiter.hit(`register:${clientIp}`, 5, 60 * 60_000);
      const body = await readJson(req);
      const sendSession = (status, row, token) => {
        if (!desktop) res.setHeader('Set-Cookie', cookie(token));
        return reply(status, { user: publicUser(row), ...(desktop ? { token } : {}) });
      };
      if (route === 'POST /api/auth/register') {
        checkFields(body, ['username', 'password', 'nickname']);
        const username = validateUsername(body.username);
        const password = validatePassword(body.password);
        const profile = validateProfile({ nickname: body.nickname, dailyGoal: 20, avatarColor: 'forest' });
        const passwordHash = await hashPassword(password);
        const id = randomUUID();
        try {
          const token = transaction(db, () => {
            if (db.prepare('SELECT count(*) total FROM users').get().total >= 10000) throw new ApiError(503, '注册容量已满，请联系管理员');
            db.prepare('INSERT INTO users(id,username,password_hash,nickname,created_at) VALUES(?,?,?,?,?)').run(id, username, passwordHash, profile.nickname, Date.now());
            return createSession(id);
          });
          return sendSession(201, findUser(id), token);
        } catch (error) {
          if (error.message?.includes('UNIQUE constraint failed')) throw new ApiError(409, '该账号不可用，请换一个');
          throw error;
        }
      }
      if (route === 'POST /api/auth/login') {
        checkFields(body, ['username', 'password']);
        const username = validateUsername(body.username); const password = validatePassword(body.password);
        limiter.hit(`user:${username}`, 15, 15 * 60_000);
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        const valid = await verifyPassword(password, user?.password_hash ?? dummyHash);
        if (!valid || !user || findUser(user.id)?.password_hash !== user.password_hash) throw new ApiError(401, '账号或密码不正确');
        prune();
        const token = transaction(db, () => createSession(user.id));
        return sendSession(200, user, token);
      }
      const user = requireUser();
      if (route === 'POST /api/auth/logout') {
        checkFields(body, []);
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
        if (!desktop) res.setHeader('Set-Cookie', cookie('', true));
        return reply(200, { ok: true });
      }
      if (route === 'PATCH /api/account/profile') {
        checkFields(body, ['nickname', 'dailyGoal', 'avatarColor']);
        const profile = validateProfile(body);
        db.prepare('UPDATE users SET nickname=?,daily_goal=?,avatar_color=? WHERE id=?').run(profile.nickname, profile.dailyGoal, profile.avatarColor, user.id);
        return reply(200, { user: publicUser(findUser(user.id)) });
      }
      if (route === 'POST /api/account/password') {
        checkFields(body, ['currentPassword', 'newPassword']);
        limiter.hit(`password:${user.id}`, 5, 15 * 60_000);
        const current = validatePassword(body.currentPassword); const next = validatePassword(body.newPassword);
        if (!await verifyPassword(current, user.password_hash)) throw new ApiError(400, '当前密码不正确');
        const nextHash = await hashPassword(next);
        const token = transaction(db, () => {
          const changed = db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?').run(nextHash, user.id, user.password_hash);
          if (changed.changes !== 1) throw new ApiError(409, '密码已改变，请重新登录');
          db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
          return createSession(user.id);
        });
        return sendSession(200, findUser(user.id), token);
      }
    } catch (error) {
      // 不输出账号、密码、令牌或完整请求体。
      if (!(error instanceof ApiError)) console.error('Account API request failed');
      if (error.status === 429 || error.status === 503) res.setHeader('Retry-After', '60');
      reply(error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : '服务暂时不可用' });
    }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5_000;
  server.maxConnections = 100;
  return { server, db, close: async () => { clearInterval(timer); await new Promise(resolveClose => server.close(resolveClose)); db.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const api = await createApi();
  const host = process.env.HOST ?? '127.0.0.1'; const port = Number(process.env.PORT ?? 8787);
  api.server.listen(port, host, () => console.log(`WordFlow account API: http://${host}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await api.close(); process.exit(0); });
}
