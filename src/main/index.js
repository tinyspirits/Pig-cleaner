const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require('electron')
const path = require('path')
const trashWatcher = require('./trashWatcher')
const cleanupService = require('./cleanupService')
const permissions = require('./permissions')
const settingsStore = require('./settings')

let mainWindow
let tray
let autoCleanTimer = null
let isMouseIgnored = true
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Ẩn khỏi Dock
app.dock.hide()

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: width,
    height: 800,
    x: 0,
    y: Math.floor(height - 800),
    // Window trong suốt, không viền, luôn trên đỉnh
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    // Cho phép click xuyên qua phần trong suốt
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Mặc định: ignore mouse (click xuyên qua)
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  // Khởi động trash watcher
  trashWatcher.start((info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trash-changed', info)
    }
  })

  // Cài đặt alwaysOnTop level cao hơn
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
}

function createTray() {
  const iconPath = isDev 
    ? path.join(__dirname, '../../src/renderer/assets/tray-icon.png')
    : path.join(process.resourcesPath, 'assets/tray-icon.png')
    
  tray = new Tray(nativeImage.createFromPath(iconPath))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🐷 Gọi heo về góc phải',
      click: () => {
        mainWindow.webContents.send('pig-called-home')
      },
    },
    {
      label: '🗑️ Kiểm tra rác ngay',
      click: async () => {
        const info = await cleanupService.getTrashInfo()
        mainWindow.webContents.send('trash-checked-manually', info)
      },
    },
    {
      label: '🧹 Dọn thùng rác',
      click: async () => {
        mainWindow.webContents.send('clean-started')
        const result = await cleanupService.cleanTrash()
        mainWindow.webContents.send('clean-complete', result)
      },
    },
    {
      label: '🗂️ Dọn Cache',
      click: () => {
        mainWindow.webContents.send('show-cache-panel')
      },
    },
    {
      label: '🧹 Dọn tất cả',
      click: async () => {
        mainWindow.webContents.send('clean-started')
        const settings = settingsStore.load()
        const trashResult = await cleanupService.cleanTrash()
        const cacheResult = await cleanupService.cleanCache(settings.manualCleanCategories.filter(c => c !== 'trash'))
        const totalFreed = (trashResult.freedBytes || 0) + (cacheResult.freedBytes || 0)

        mainWindow.webContents.send('clean-complete', {
          success: true,
          type: 'all',
          freedBytes: totalFreed,
          freedFormatted: cleanupService.getTrashInfo().sizeFormatted, // It's re-calculated in App.jsx usually, but we can pass dummy string. Actually we can format it.
        })
      },
    },
    { type: 'separator' },
    {
      label: '⚙️ Cài đặt',
      click: () => {
        mainWindow.webContents.send('show-settings')
      },
    },
    {
      label: '📊 Xem thống kê',
      click: () => {
        mainWindow.webContents.send('show-stats')
      },
    },
    { type: 'separator' },
    {
      label: '❌ Thoát',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setToolTip('Heo Ăn Rác 🐷')
  tray.setContextMenu(contextMenu)
}

function setupAutoClean() {
  if (autoCleanTimer) {
    clearInterval(autoCleanTimer)
    autoCleanTimer = null
  }
  const settings = settingsStore.load()
  if (settings.autoCleanInterval > 0) {
    autoCleanTimer = setInterval(async () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clean-started')
      }
      let totalFreed = 0
      if (settings.autoCleanCategories.includes('trash')) {
        const res = await cleanupService.cleanTrash()
        totalFreed += res.freedBytes || 0
      }
      const cacheCats = settings.autoCleanCategories.filter(c => c !== 'trash')
      if (cacheCats.length > 0) {
        const res = await cleanupService.cleanCache(cacheCats)
        totalFreed += res.freedBytes || 0
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clean-complete', { freedBytes: totalFreed })
      }
    }, settings.autoCleanInterval * 60 * 1000)
  }
}

// IPC Handlers
ipcMain.handle('set-ignore-mouse', (_, ignore) => {
  isMouseIgnored = ignore
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  }
})

ipcMain.handle('get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { width, height }
})

ipcMain.handle('set-window-position', (_, x, y) => {
  if (mainWindow) {
    mainWindow.setPosition(Math.round(x), Math.round(y))
  }
})

ipcMain.handle('get-window-position', () => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition()
    return { x, y }
  }
  return { x: 0, y: 0 }
})

ipcMain.handle('clean-trash', async () => {
  return await cleanupService.cleanTrash()
})

ipcMain.handle('clean-temp', async () => {
  return await cleanupService.cleanTemp()
})

ipcMain.handle('clean-all', async () => {
  return await cleanupService.cleanAll()
})

ipcMain.handle('get-trash-info', async () => {
  return await cleanupService.getTrashInfo()
})

ipcMain.handle('get-cache-types', async () => {
  return await cleanupService.getCacheTypes()
})

ipcMain.handle('clean-cache', async (_, categoryIds) => {
  return await cleanupService.cleanCache(categoryIds)
})

ipcMain.handle('check-permissions', async () => {
  return await permissions.checkFullDiskAccess()
})

ipcMain.handle('resize-window', (_, size) => {
  if (mainWindow) {
    mainWindow.setSize(size, size)
  }
})

ipcMain.handle('get-settings', () => {
  return settingsStore.load()
})

ipcMain.handle('save-settings', (_, newSettings) => {
  settingsStore.save(newSettings)
  setupAutoClean()
  return true
})

app.whenReady().then(async () => {
  createWindow()
  createTray()
  setupAutoClean()

  // Kiểm tra permissions sau khi window tạo
  setTimeout(async () => {
    const hasPermission = await permissions.checkFullDiskAccess()
    if (mainWindow) {
      mainWindow.webContents.send('permission-status', hasPermission)
    }
  }, 2000)
})

app.on('window-all-closed', () => {
  // Không thoát khi đóng window — app chạy nền qua Tray
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
