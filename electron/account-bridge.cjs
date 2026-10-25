const routes = Object.freeze({
  me: ['GET', '/api/auth/me'], register: ['POST', '/api/auth/register'],
  login: ['POST', '/api/auth/login'], logout: ['POST', '/api/auth/logout'],
  profile: ['PATCH', '/api/account/profile'], password: ['POST', '/api/account/password'],
});

/** Token仅存活在主进程内存，不写磁盘、不返回渲染进程。 */
function createAccountBridge(baseUrl) {
  let token = '';
  if (baseUrl) {
    const url = new URL(baseUrl);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('WORDFLOW_API_URL须为HTTPS服务根地址，本地开发可使用HTTP');
    }
  }
  return async (operation, payload) => {
    if (!Object.hasOwn(routes, operation)) return { status: 400, body: { error: '不支持的账号操作' } };
    if (!baseUrl) return { status: 503, body: { error: '尚未配置账号服务，离线学习仍可使用。' } };
    const [method, path] = routes[operation];
    const text = JSON.stringify(payload ?? {});
    if (Buffer.byteLength(text) > 4096) return { status: 413, body: { error: '请求内容过大' } };
    try {
      const response = await fetch(new URL(path, baseUrl), { method,
        headers: { 'Content-Type': 'application/json', 'X-Wordflow-Client': 'desktop', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(method !== 'GET' ? { body: text } : {}), signal: AbortSignal.timeout(operation === 'me' ? 3000 : 15_000), redirect: 'error' });
      const body = await response.json();
      if (response.ok && typeof body.token === 'string') token = body.token;
      if ((operation === 'logout' && response.ok) || (response.status === 401 && !['login', 'password'].includes(operation))) token = '';
      delete body.token;
      return { status: response.status, body };
    } catch { return { status: 503, body: { error: '账号服务连接失败，本地学习仍可使用。' } }; }
  };
}
module.exports = { createAccountBridge };
