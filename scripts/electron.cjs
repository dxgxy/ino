const path = require('node:path');
const { spawn } = require('node:child_process');

const electronCli = path.join(__dirname, '..', 'node_modules', 'electron', 'cli.js');
const child = spawn(process.execPath, [electronCli, path.join(__dirname, '..')], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
