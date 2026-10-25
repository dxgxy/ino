import { mkdir, copyFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const stage = path.join(root, 'output/server-release');
const files = ['server/index.mjs', 'server/database.mjs', 'server/security.mjs', 'server/schema.sql', 'server/API.md', 'deploy/README.md', 'deploy/nginx-api.conf', 'deploy/wordflow-api.service', 'deploy/wordflow-api.env.example'];
// 使用白名单构建：数据库、密钥、词库、桌面依赖和测试数据均不会进入部署包。
for (const file of files) {
  await mkdir(path.dirname(path.join(stage, file)), { recursive: true });
  await copyFile(path.join(root, file), path.join(stage, file));
}
const archive = path.join(root, 'output/wordflow-api.tar.gz');
const result = spawnSync('tar', ['-czf', archive, '-C', stage, ...files], { stdio: 'inherit', shell: false });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Backend package: ${archive} (${(await stat(archive)).size} bytes)`);

