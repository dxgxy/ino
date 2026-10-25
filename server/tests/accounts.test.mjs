import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createApi } from '../index.mjs';

const require = createRequire(import.meta.url);
const { createAccountBridge } = require('../../electron/account-bridge.cjs');
const origin = 'http://127.0.0.1:5173';
const password = 'RealTestPassword-2026';

async function start(config = {}) {
  const api = await createApi({ origin, ...config });
  await new Promise(resolve => api.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${api.server.address().port}`;
  const call = async (method, path, body, headers = {}) => {
    const response = await fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie'), headers: response.headers };
  };
  return { ...api, base, call };
}

test('real SQLite account lifecycle, ownership, minimal storage, and restart', async t => {
  mkdirSync('output/server-tests', { recursive: true });
  const filename = `output/server-tests/${randomUUID()}.sqlite`;
  const api = await start({ database: filename });
  let closed = false;
  t.after(async () => { if (!closed) await api.close(); });
  const call = api.call;
  const a = await call('POST', '/api/auth/register', { username: 'student_a', nickname: '小帆', password });
  assert.equal(a.status, 201);
  assert.ok(a.cookie.includes('HttpOnly') && a.cookie.includes('SameSite=Strict'));
  assert.equal(a.body.token, undefined, 'browser must never receive a bearer token');
  assert.equal(a.body.user.password_hash, undefined);
  const cookieA = a.cookie.split(';')[0];
  const b = await call('POST', '/api/auth/register', { username: 'student_b', nickname: '同学乙', password });
  const cookieB = b.cookie.split(';')[0];
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('GET', '/api/auth/me', undefined, { Cookie: cookieA })).body.user.nickname, '小帆');
  assert.equal((await call('POST', '/api/auth/login', { username: 'student_a', password: 'IncorrectPassword' })).status, 401);
  assert.equal((await call('POST', '/api/auth/register', { username: 'STUDENT_A', nickname: '重复', password })).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { username: 'weak_user', nickname: '弱密码', password: '123' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { username: 'payload_user', nickname: '不上传', password, cards: [1] })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { username: 'limited', nickname: '限流', password })).status, 429);
  assert.equal((await call('POST', '/api/auth/login', { username: 'student_a', password }, { Origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await call('PATCH', '/api/account/profile', { nickname: '已更新', dailyGoal: 35, avatarColor: 'ocean' }, { Cookie: cookieA })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', undefined, { Cookie: cookieB })).body.user.nickname, '同学乙');
  assert.equal((await call('PATCH', '/api/account/profile', { nickname: '越权', dailyGoal: 20, avatarColor: 'forest', id: b.body.user.id }, { Cookie: cookieA })).status, 400);
  assert.equal((await call('POST', '/api/lists', { cards: [] }, { Cookie: cookieA })).status, 404);
  assert.equal((await call('PATCH', '/api/account/profile', 'x'.repeat(5000), { Cookie: cookieA })).status, 413);
  assert.equal((await call('POST', '/api/auth/login', '{')).status, 400);

  const bridge = createAccountBridge(api.base);
  const native = await bridge('login', { username: 'student_a', password });
  assert.equal(native.status, 200); assert.equal(native.body.token, undefined);
  assert.equal((await bridge('me')).body.user.nickname, '已更新');
  assert.equal((await bridge('password', { currentPassword: 'WrongCurrentPassword', newPassword: 'UpdatedPassword-2026' })).status, 400);
  assert.equal((await bridge('me')).status, 200, 'wrong current password must not destroy a valid native session');
  assert.equal((await bridge('arbitrary-route')).status, 400);
  const changed = await bridge('password', { currentPassword: password, newPassword: 'UpdatedPassword-2026' });
  assert.equal(changed.status, 200);
  assert.equal((await call('GET', '/api/auth/me', undefined, { Cookie: cookieA })).status, 401, 'password change revokes old browser session');
  assert.equal((await bridge('me')).status, 200, 'native bridge must rotate its token');
  assert.equal((await call('POST', '/api/auth/login', { username: 'student_a', password })).status, 401);
  assert.equal((await call('GET', '/api/auth/me', undefined, { Cookie: cookieB })).status, 200);
  const row = api.db.prepare('SELECT * FROM users WHERE username=?').get('student_a');
  assert.ok(row.password_hash.startsWith('scrypt$32768$8$3$'));
  assert.ok(!row.password_hash.includes('UpdatedPassword'));
  assert.deepEqual(api.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => row.name), ['sessions', 'users']);
  await bridge('logout'); assert.equal((await bridge('me')).status, 401);
  await api.close(); closed = true;

  const reopened = await start({ database: filename });
  t.after(() => reopened.close());
  const login = await reopened.call('POST', '/api/auth/login', { username: 'student_a', password: 'UpdatedPassword-2026' });
  assert.equal(login.status, 200); assert.equal(login.body.user.dailyGoal, 35);
  for (let i = 0; i < 7; i++) await reopened.call('POST', '/api/auth/login', { username: 'student_a', password: 'UpdatedPassword-2026' });
  assert.equal(reopened.db.prepare('SELECT count(*) total FROM sessions WHERE user_id=?').get(a.body.user.id).total, 5);
  const storedSession = reopened.db.prepare('SELECT token_hash FROM sessions LIMIT 1').get();
  assert.match(storedSession.token_hash, /^[a-f0-9]{64}$/);
  console.log(`SQLite main file ${statSync(filename).size} bytes; process RSS ${Math.round(process.memoryUsage().rss / 1048576)} MiB after auth tests`);
});

test('production config rejects HTTP and issues Secure cookies behind HTTPS proxy', async t => {
  await assert.rejects(() => createApi({ production: true, origin: 'http://example.invalid', database: ':memory:' }));
  const api = await start({ production: true, origin: 'https://account.example.invalid', database: ':memory:' });
  t.after(() => api.close());
  const registered = await api.call('POST', '/api/auth/register', { username: 'prod_user', nickname: '生产检查', password }, { Origin: 'https://account.example.invalid' });
  assert.equal(registered.status, 201); assert.ok(registered.cookie.includes('; Secure'));
  assert.throws(() => createAccountBridge('http://8.130.9.172'), /HTTPS/);
});


test('Android WebView bearer registration persists to SQLite', async t => {
  const api = await start({ database: ':memory:' });
  t.after(() => api.close());
  const android = async (method, path, body, token = '') => {
    const response = await fetch(api.base + path, { method, headers: { Origin: 'https://appassets.androidplatform.net', 'Content-Type': 'application/json', 'X-Wordflow-Client': 'android', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const preflight = await fetch(api.base + '/api/auth/register', { method: 'OPTIONS', headers: { Origin: 'https://appassets.androidplatform.net', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-wordflow-client' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  const registered = await android('POST', '/api/auth/register', { username: 'android_user', nickname: '安卓同学', password });
  assert.equal(registered.status, 201);
  assert.ok(registered.body.token);
  assert.equal(registered.body.user.nickname, '安卓同学');
  const me = await android('GET', '/api/auth/me', undefined, registered.body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, 'android_user');
  const row = api.db.prepare('SELECT username,nickname,password_hash FROM users WHERE username=?').get('android_user');
  assert.equal(row.nickname, '安卓同学');
  assert.ok(row.password_hash.startsWith('scrypt$32768$8$3$'));
  assert.equal(api.db.prepare('SELECT count(*) total FROM sessions WHERE user_id=(SELECT id FROM users WHERE username=?)').get('android_user').total, 1);
});
