const { contextBridge, ipcRenderer } = require('electron')

// Expose safe API sang Renderer process
contextBridge.exposeInMainWorld('pigAPI', {
  // Mouse events
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('set-ignore-mouse', ignore),

  // Screen & Window
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  setWindowPosition: (x, y) => ipcRenderer.invoke('set-window-position', x, y),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  resizeWindow: (size) => ipcRenderer.invoke('resize-window', size),

  // Cleaning
  cleanTrash: () => ipcRenderer.invoke('clean-trash'),
  cleanTemp: () => ipcRenderer.invoke('clean-temp'),
  cleanAll: () => ipcRenderer.invoke('clean-all'),
  getTrashInfo: () => ipcRenderer.invoke('get-trash-info'),
  getCacheTypes: () => ipcRenderer.invoke('get-cache-types'),
  cleanCache: (ids) => ipcRenderer.invoke('clean-cache', ids),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Permissions
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),

  // Event listeners (Main → Renderer)
  onTrashChanged: (callback) => {
    ipcRenderer.on('trash-changed', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('trash-changed')
  },
  onCleanComplete: (callback) => {
    ipcRenderer.on('clean-complete', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('clean-complete')
  },
  onPigCalledHome: (callback) => {
    ipcRenderer.on('pig-called-home', () => callback())
    return () => ipcRenderer.removeAllListeners('pig-called-home')
  },
  onPermissionStatus: (callback) => {
    ipcRenderer.on('permission-status', (_, hasPermission) => callback(hasPermission))
    return () => ipcRenderer.removeAllListeners('permission-status')
  },
  onShowStats: (callback) => {
    ipcRenderer.on('show-stats', () => callback())
    return () => ipcRenderer.removeAllListeners('show-stats')
  },
  onShowCachePanel: (callback) => {
    ipcRenderer.on('show-cache-panel', () => callback())
    return () => ipcRenderer.removeAllListeners('show-cache-panel')
  },
  onShowSettings: (callback) => {
    ipcRenderer.on('show-settings', () => callback())
    return () => ipcRenderer.removeAllListeners('show-settings')
  },
  onCleanStarted: (callback) => {
    ipcRenderer.on('clean-started', () => callback())
    return () => ipcRenderer.removeAllListeners('clean-started')
  },
})
