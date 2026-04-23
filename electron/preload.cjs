const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isDesktop: true,
    notify: async ({ title, body }) => ipcRenderer.invoke('desktop:notify', { title, body }),
});
