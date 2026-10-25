const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const { createAccountBridge } = require('./account-bridge.cjs');

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'xx大人 · WordFlow',
    backgroundColor: '#f6f8f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发期加载 Vite，打包后加载 dist，保持同一套 React UI。
  if (isDev) window.loadURL('http://127.0.0.1:5173');
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
  const requestAccount = createAccountBridge(process.env.WORDFLOW_API_URL || (isDev ? 'http://127.0.0.1:8787' : ''));
  ipcMain.removeHandler('account:request');
  ipcMain.handle('account:request', (event, operation, payload) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('不允许的调用来源');
    return requestAccount(operation, payload);
  });
  window.webContents.on('will-navigate', (event) => { event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
