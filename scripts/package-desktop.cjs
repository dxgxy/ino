const path = require('node:path');
const { spawnSync } = require('node:child_process');
// 直接使用 Node 调用工具，避免 Windows .cmd 在含 & 的目录中解析失败。
for (const [script, args] of [
  ['scripts/build.cjs', []],
  ['node_modules/electron-builder/cli.js', ['--win', 'nsis', 'portable']],
]) {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '..', script), ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
