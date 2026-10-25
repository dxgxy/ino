const { contextBridge, ipcRenderer } = require('electron');

// 仅暴露稳定的桌面能力入口，业务数据仍通过服务接口/本地存储管理。
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  isDesktop: true,
  accountRequest: (operation, payload) => ipcRenderer.invoke('account:request', operation, payload),
});
