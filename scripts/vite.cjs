const path = require('node:path');
const { spawn } = require('node:child_process');

const viteCli = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteCli, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
