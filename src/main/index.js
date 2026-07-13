const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require('electron')
const path = require('path')
const trashWatcher = require('./trashWatcher')
const cleanupService = require('./cleanupService')
const permissions = require('./permissions')

let mainWindow
let tray
let isMouseIgnored = true
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Ẩn khỏi Dock
app.dock.hide()

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: width,
    height: 300,
    x: 0,
    y: Math.floor(height - 300),
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
  // Tray icon đơn giản dùng emoji (16x16)
  const icon = createTrayIconBuffer()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🐷 Gọi heo về góc phải',
      click: () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize
        mainWindow.setBounds({ x: width - 200, y: height - 200, width: 200, height: 200 })
        mainWindow.webContents.send('pig-called-home')
      },
    },
    {
      label: '🗑️ Kiểm tra rác ngay',
      click: async () => {
        const info = await cleanupService.getTrashInfo()
        mainWindow.webContents.send('trash-changed', info)
      },
    },
    {
      label: '🧹 Dọn rác ngay!',
      click: async () => {
        const result = await cleanupService.cleanAll()
        mainWindow.webContents.send('clean-complete', result)
      },
    },
    { type: 'separator' },
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

function createTrayIconBuffer() {
  // Tạo PNG 16x16 đơn giản (pink circle) cho tray
  // Dùng nativeImage.createFromDataURL với PNG base64
  // PNG 16x16 màu hồng đơn giản
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAC5SURBVDiNpdMxCoMwFAbgr0IHwUEoHUQQPIGX6OYFPIJbN+/gIbp5CBcHwUEQBB0s2KGDQyFNJL4kL7+B8PJ9eXlJoijKfd8ffd+PmTFT13XKzKSUUlJK6RhjnOd5UEop5ZxzwDnntdb6sVJKqbUGABARcM5BKQUA4JwDY6ysAUBVVQOAqioAoKoKAKqqAICqKgCgqgoAqKoCAKiqAgCqqgIAqioAoKoKAKiqAgCqqgIAqCoAoKoKAKiqAgCqqgD+9wcA8BYzAAAAABJRU5ErkJggg=='
  return nativeImage.createFromDataURL(`data:image/png;base64,${pngBase64}`)
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

ipcMain.handle('check-permissions', async () => {
  return await permissions.checkFullDiskAccess()
})

ipcMain.handle('resize-window', (_, size) => {
  if (mainWindow) {
    mainWindow.setSize(size, size)
  }
})

app.whenReady().then(async () => {
  createWindow()
  createTray()

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
