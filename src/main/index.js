const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, powerMonitor } = require('electron')
const path = require('path')
const trashWatcher = require('./trashWatcher')
const cleanupService = require('./cleanupService')
const permissions = require('./permissions')
const settingsStore = require('./settings')
const weatherService = require('./weatherService')
const i18n = require('./i18n')

let mainWindow
let tray
let autoCleanTimer = null
let isMouseIgnored = true
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Ẩn khỏi Dock (chỉ trên macOS)
if (process.platform === 'darwin') {
  app.dock.hide()
}

function createWindow() {
  const { width, height, x, y } = screen.getPrimaryDisplay().workArea

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
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

  const settings = settingsStore.load()
  if (settings.displayMode === 'desktop') {
    mainWindow.setAlwaysOnTop(false)
  } else {
    // Cài đặt alwaysOnTop level cao hơn
    mainWindow.setAlwaysOnTop(true, 'floating')
  }
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
}

function buildTrayMenu() {
  const w = weatherService.getCurrent()
  const settings = settingsStore.load()
  const isDuck = settings.petType === 'duck'
  const weatherLabel = w.description || i18n.t('weather.loading')
  const tempLabel = w.temperature !== null && w.temperature !== undefined ? ` (${Math.round(w.temperature)}°C)` : ''
  const upcomingLabel = w.upcomingCondition ? `${i18n.t('weather.upcoming')}${
    {
      rain: i18n.t('weather.rainShort'),
      thunderstorm: i18n.t('weather.stormShort'),
      drizzle: i18n.t('weather.drizzleShort'),
      snow: i18n.t('weather.snowShort')
    }[w.upcomingCondition] || ''
  }` : ''

  const cityLabel = w.city ? ` (${w.city})` : ''
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `🌤️ ${weatherLabel}${tempLabel}${cityLabel}${upcomingLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isDuck ? i18n.t('tray.callDuck', '🦆 Gọi vịt về góc phải') : i18n.t('tray.callPig'),
      click: () => {
        mainWindow.webContents.send('pig-called-home')
      },
    },
    {
      label: i18n.t('tray.checkTrash'),
      click: async () => {
        const info = await cleanupService.getTrashInfo()
        mainWindow.webContents.send('trash-checked-manually', info)
      },
    },
    {
      label: i18n.t('tray.cleanTrash'),
      click: async () => {
        mainWindow.webContents.send('clean-started')
        const result = await cleanupService.cleanTrash()
        mainWindow.webContents.send('clean-complete', result)
      },
    },
    {
      label: i18n.t('tray.cleanCache'),
      click: () => {
        mainWindow.webContents.send('show-cache-panel')
      },
    },
    {
      label: i18n.t('tray.cleanAll'),
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
          trash: trashResult,
        })
      },
    },
    { type: 'separator' },
    {
      label: i18n.t('tray.settings'),
      click: () => {
        mainWindow.webContents.send('show-settings')
      },
    },
    {
      label: i18n.t('tray.stats'),
      click: () => {
        mainWindow.webContents.send('show-stats')
      },
    },
    { type: 'separator' },
    {
      label: i18n.t('tray.quit'),
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setToolTip(isDuck ? i18n.t('tray.tooltipDuck', 'Vịt Dọn Rác 🦆') : i18n.t('tray.tooltip'))
  tray.setContextMenu(contextMenu)
}

function createTray() {
  const settings = settingsStore.load()
  const isDuck = settings.petType === 'duck'
  
  const iconName = isDuck ? 'duck-tray-icon.png' : 'tray-icon.png'
  const iconPath = isDev
    ? path.join(__dirname, `../../src/renderer/assets/${iconName}`)
    : path.join(process.resourcesPath, `assets/${iconName}`)

  let image = nativeImage.createFromPath(iconPath)
  // Resize to standard macOS tray height (18px) and preserve aspect ratio
  image = image.resize({ height: 18 })
  
  tray = new Tray(image)
  buildTrayMenu()
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
  const prev = settingsStore.load()
  settingsStore.save(newSettings)
  setupAutoClean()

  if (newSettings.language && newSettings.language !== prev.language) {
    i18n.changeLanguage(newSettings.language)
  }
  
  // Update tray if language or petType changed
  if ((newSettings.language !== prev.language) || (newSettings.petType !== prev.petType)) {
    if (tray && !tray.isDestroyed()) {
      const isDuck = newSettings.petType === 'duck'
      const iconName = isDuck ? 'duck-tray-icon.png' : 'tray-icon.png'
      const iconPath = isDev
        ? path.join(__dirname, `../../src/renderer/assets/${iconName}`)
        : path.join(process.resourcesPath, `assets/${iconName}`)
      
      let image = nativeImage.createFromPath(iconPath)
      image = image.resize({ height: 18 })
      tray.setImage(image)
      
      buildTrayMenu()
    }
  }

  // Nếu vị trí thời tiết thay đổi, áp dụng ngay cho weatherService
  const locChanged = JSON.stringify(newSettings.weatherLocation) !== JSON.stringify(prev.weatherLocation)
  if (newSettings.weatherLocation !== undefined && locChanged) {
    if (newSettings.weatherLocation) {
      weatherService.setManualLocation(newSettings.weatherLocation)
    } else {
      weatherService.clearManualLocation()
    }
  }

  if (mainWindow) {
    if (newSettings.displayMode === 'desktop') {
      mainWindow.setAlwaysOnTop(false)
    } else {
      mainWindow.setAlwaysOnTop(true, 'floating')
    }
  }

  // Bật/tắt khởi động cùng hệ điều hành (macOS/Windows)
  if (newSettings.openAtLogin !== undefined && newSettings.openAtLogin !== prev.openAtLogin) {
    try {
      app.setLoginItemSettings({ openAtLogin: !!newSettings.openAtLogin })
    } catch { /* Linux hoặc môi trường không hỗ trợ - bỏ qua */ }
  }

  return true
})

ipcMain.handle('get-weather', () => {
  return weatherService.getCurrent()
})

ipcMain.handle('search-location', async (_, query) => {
  return await weatherService.searchLocation(query)
})

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.exit(0)
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus the main window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      // Optional: show pig visual feedback
      mainWindow.webContents.send('pig-called-home')
    }
  })

  app.whenReady().then(async () => {
    const savedSettingsInit = settingsStore.load()
    if (savedSettingsInit.language) {
      i18n.changeLanguage(savedSettingsInit.language)
    }

    // Áp dụng cài đặt khởi động cùng hệ điều hành (macOS/Windows) đã lưu trước đó
    try {
      app.setLoginItemSettings({ openAtLogin: !!savedSettingsInit.openAtLogin })
    } catch { /* Linux hoặc môi trường không hỗ trợ - bỏ qua */ }

    createWindow()
    createTray()
    setupAutoClean()

  // Tự động thay đổi kích thước cửa sổ khi thanh Dock thay đổi trạng thái (hiện/ẩn)
  screen.on('display-metrics-changed', (event, display, changedMetrics) => {
    if (mainWindow && !mainWindow.isDestroyed() && changedMetrics.includes('workArea')) {
      const { width, height, x, y } = display.workArea
      mainWindow.setBounds({ width, height, x, y })
    }
  })

  // Áp dụng vị trí thời tiết đã lưu (nếu có) trước khi bắt đầu weather service
  const savedSettings = settingsStore.load()
  if (savedSettings.weatherLocation) {
    weatherService.setManualLocation(savedSettings.weatherLocation)
  }

  // Khởi động weather service
  weatherService.start((weatherData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('weather-update', weatherData)
    }
    // Cập nhật tray menu với thời tiết mới
    if (tray && !tray.isDestroyed()) buildTrayMenu()
  })

  // Kiểm tra permissions sau khi window tạo
  setTimeout(async () => {
    const hasPermission = await permissions.checkFullDiskAccess()
    if (mainWindow) {
      mainWindow.webContents.send('permission-status', hasPermission)
    }
  }, 2000)

  powerMonitor.on('suspend', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app-suspend')
  })
  powerMonitor.on('resume', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app-resume')
  })
  powerMonitor.on('lock-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app-suspend')
  })
  powerMonitor.on('unlock-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app-resume')
  })
})

app.on('window-all-closed', () => {
  // Không thoát khi đóng window — app chạy nền qua Tray
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
} // Close else block for single instance lock
