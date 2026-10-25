const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function start(file, args = []) {
  const child = spawn(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
  return child;
}
function reachable(url) {
  return new Promise(resolve => {
    const req = http.get(url, response => { response.resume(); resolve(response.statusCode === 200); });
    req.setTimeout(1000, () => req.destroy());
    req.on('error', () => resolve(false));
  });
}
async function ready(url) {
  const until = Date.now() + 15000;
  while (!stopping && Date.now() < until) {
    if (await reachable(url)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`启动失败：${url}`);
}
(async () => {
  // 仅本地账号服务默认自动启动；使用远端HTTPS服务时无需占用本机后端。
  if (!process.env.WORDFLOW_API_URL) {
    if (!await reachable('http://127.0.0.1:8787/api/health')) start(path.join(root, 'server/index.mjs'));
    await ready('http://127.0.0.1:8787/api/health');
  }
  start(path.join(root, 'node_modules/vite/bin/vite.js'), ['--host', '127.0.0.1', '--port', '5173', '--strictPort']);
  await ready('http://127.0.0.1:5173');
  if (!stopping) start(path.join(root, 'node_modules/electron/cli.js'), [root]);
})().catch(error => { console.error(error.message); stop(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
