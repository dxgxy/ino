const path = require('node:path');
const { spawn } = require('node:child_process');

const tsc = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
const viteCli = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
const run = (file, args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit' });
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`command failed: ${file}`)));
});
(async () => { await run(tsc, ['-b']); await run(viteCli, ['build']); })().catch(error => { console.error(error); process.exit(1); });
