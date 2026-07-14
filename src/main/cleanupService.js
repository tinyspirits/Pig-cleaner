const fs = require('fs')
const path = require('path')
const os = require('os')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

const TRASH_PATH = path.join(os.homedir(), '.Trash')

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFolderSize(folderPath) {
  let totalSize = 0
  let fileCount = 0
  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue
      const itemPath = path.join(folderPath, item.name)
      try {
        const stat = fs.statSync(itemPath)
        if (stat.isDirectory()) {
          const sub = getFolderSize(itemPath)
          totalSize += sub.size
          fileCount += sub.count
        } else {
          totalSize += stat.size
          fileCount++
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return { size: totalSize, count: fileCount }
}

async function getTrashInfo() {
  let sizeBytes = 0
  let fileCount = 0
  
  try {
    // Ưu tiên dùng AppleScript để lấy size của Trash vì nó không bị lỗi EPERM (Full Disk Access)
    const { stdout } = await execAsync(`osascript -e 'tell application "Finder" to return size of trash'`)
    const size = parseInt(stdout.trim(), 10)
    if (!isNaN(size)) {
      sizeBytes = size
    } else {
      // Fallback: Nếu Finder trả về "missing value" (nghĩa là trống rỗng)
      sizeBytes = 0
    }
  } catch (err) {
    console.error('[cleanupService] AppleScript failed:', err.message)
    // Fallback về cách đếm folder cũ nếu AppleScript lỗi
    const result = getFolderSize(TRASH_PATH)
    sizeBytes = result.size
    fileCount = result.count
  }

  return {
    sizeBytes,
    sizeFormatted: formatBytes(sizeBytes),
    fileCount,
  }
}

// ─── Cache categories ─────────────────────────────────────────────────────────
const home = os.homedir()

const CACHE_CATEGORIES = [
  {
    id: 'system',
    label: '🖥️ System Cache',
    paths: [
      path.join(home, 'Library', 'Caches'),
    ],
  },
  {
    id: 'npm',
    label: '📦 npm Cache',
    paths: [
      path.join(home, '.npm', '_cacache'),
      path.join(home, 'Library', 'Caches', 'npm'),
    ],
  },
  {
    id: 'yarn',
    label: '🧶 Yarn Cache',
    paths: [
      path.join(home, 'Library', 'Caches', 'yarn'),
      path.join(home, '.yarn', 'cache'),
    ],
  },
  {
    id: 'pip',
    label: '🐍 pip / Python Cache',
    paths: [
      path.join(home, 'Library', 'Caches', 'pip'),
      path.join(home, '.cache', 'pip'),
    ],
  },
  {
    id: 'brew',
    label: '🍺 Homebrew Cache',
    paths: [
      path.join(home, 'Library', 'Caches', 'Homebrew'),
      '/Library/Caches/Homebrew',
    ],
  },
  {
    id: 'xcode',
    label: '🔨 Xcode DerivedData',
    paths: [
      path.join(home, 'Library', 'Developer', 'Xcode', 'DerivedData'),
      path.join(home, 'Library', 'Caches', 'com.apple.dt.Xcode'),
    ],
  },
  {
    id: 'vscode',
    label: '💻 VS Code Cache',
    paths: [
      path.join(home, 'Library', 'Application Support', 'Code', 'Cache'),
      path.join(home, 'Library', 'Application Support', 'Code', 'CachedData'),
      path.join(home, 'Library', 'Application Support', 'Code', 'CachedExtensions'),
    ],
  },
  {
    id: 'gradle',
    label: '🐘 Gradle Cache',
    paths: [
      path.join(home, '.gradle', 'caches'),
    ],
  },
  {
    id: 'docker',
    label: '🐳 Docker Cache',
    paths: [
      path.join(home, 'Library', 'Containers', 'com.docker.docker', 'Data', 'vms'),
    ],
  },
  {
    id: 'browser',
    label: '🌐 Browser Cache',
    paths: [
      path.join(home, 'Library', 'Caches', 'Google', 'Chrome'),
      path.join(home, 'Library', 'Containers', 'com.apple.Safari', 'Data', 'Library', 'Caches', 'com.apple.Safari'),
      path.join(home, 'Library', 'Caches', 'Firefox'),
    ],
  },
  {
    id: 'temp',
    label: '🗂️ Temp Files',
    paths: [
      os.tmpdir(),
    ],
  },
]

async function getCacheTypes() {
  const result = []
  for (const cat of CACHE_CATEGORIES) {
    let totalSize = 0
    let totalCount = 0
    for (const p of cat.paths) {
      try {
        if (fs.existsSync(p)) {
          const info = getFolderSize(p)
          totalSize += info.size
          totalCount += info.count
        }
      } catch { /* skip */ }
    }
    result.push({
      id: cat.id,
      label: cat.label,
      sizeBytes: totalSize,
      sizeFormatted: formatBytes(totalSize),
      fileCount: totalCount,
      exists: totalSize > 0,
    })
  }
  return result
}

async function cleanCache(categoryIds) {
  const ids = categoryIds || CACHE_CATEGORIES.map(c => c.id)
  let totalFreed = 0
  const details = []

  for (const id of ids) {
    const cat = CACHE_CATEGORIES.find(c => c.id === id)
    if (!cat) continue

    let freed = 0
    for (const p of cat.paths) {
      try {
        if (!fs.existsSync(p)) continue
        if (id === 'temp') {
          // Temp: chỉ xoá file cũ hơn 7 ngày
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
          const items = fs.readdirSync(p, { withFileTypes: true })
          for (const item of items) {
            if (item.name.startsWith('.')) continue
            const itemPath = path.join(p, item.name)
            try {
              const stat = fs.statSync(itemPath)
              if (stat.mtimeMs < cutoff) {
                const size = item.isDirectory() ? getFolderSize(itemPath).size : stat.size
                fs.rmSync(itemPath, { recursive: true, force: true })
                freed += size
              }
            } catch { /* skip */ }
          }
        } else {
          const sizeBefore = getFolderSize(p).size
          try {
            // Xóa từng file/folder bên trong thay vì xóa cả thư mục gốc để tránh bị nghẽn ở 1 file bị khóa (locked)
            const items = fs.readdirSync(p)
            for (const item of items) {
              try {
                fs.rmSync(path.join(p, item), { recursive: true, force: true })
              } catch { /* skip locked file */ }
            }
          } catch { /* skip */ }
          const sizeAfter = getFolderSize(p).size
          freed += (sizeBefore - sizeAfter)
        }
      } catch { /* skip */ }
    }

    totalFreed += freed
    details.push({ id: cat.id, label: cat.label, freedBytes: freed, freedFormatted: formatBytes(freed) })
  }

  return {
    success: true,
    type: 'cache',
    freedBytes: totalFreed,
    freedFormatted: formatBytes(totalFreed),
    details,
    message: `Đã dọn ${formatBytes(totalFreed)} cache!`,
  }
}

async function cleanTrash() {
  const beforeInfo = await getTrashInfo()
  const before = beforeInfo.sizeBytes

  try {
    // Dùng AppleScript để dọn rác (phát âm thanh chuẩn của Mac)
    // Lệnh này sẽ chờ người dùng confirm (nếu có bật cảnh báo)
    await execAsync(`osascript -e 'tell application "Finder" to empty trash'`)
    
    // Nếu AppleScript chạy thành công (người dùng bấm OK và không có lỗi),
    // Finder sẽ dọn rác dưới nền. Chúng ta có thể tự tin cho rằng toàn bộ số rác "before" đã được dọn.
    // Không nên gọi getTrashInfo() ngay lập tức vì Finder có thể chưa update xong dung lượng.
    return {
      success: true,
      type: 'trash',
      freedBytes: before,
      freedFormatted: formatBytes(before),
      message: `Đã dọn ${formatBytes(before)} rác!`,
    }
  } catch (err) {
    // Fallback: xóa thủ công
    try {
      const items = fs.readdirSync(TRASH_PATH)
      let freed = 0
      for (const item of items) {
        if (item.startsWith('.')) continue
        const itemPath = path.join(TRASH_PATH, item)
        try {
          const stat = getFolderSize(itemPath)
          freed += stat.size
          fs.rmSync(itemPath, { recursive: true, force: true })
        } catch { /* skip */ }
      }
      return {
        success: true,
        type: 'trash',
        freedBytes: freed,
        freedFormatted: formatBytes(freed),
        message: `Đã dọn ${formatBytes(freed)} rác!`,
      }
    } catch (err2) {
      return { success: false, type: 'trash', error: err2.message, message: 'Không thể dọn rác: ' + err2.message }
    }
  }
}

async function cleanTemp() {
  return await cleanCache(['temp'])
}

async function cleanAll() {
  const trashResult = await cleanTrash()
  const cacheResult = await cleanCache()
  const totalFreed = (trashResult.freedBytes || 0) + (cacheResult.freedBytes || 0)

  return {
    success: true,
    type: 'all',
    freedBytes: totalFreed,
    freedFormatted: formatBytes(totalFreed),
    trash: trashResult,
    cache: cacheResult,
    message: `Căng da bụng! Đã ăn ${formatBytes(totalFreed)} rác!`,
  }
}

module.exports = { getTrashInfo, cleanTrash, cleanTemp, cleanAll, getCacheTypes, cleanCache }
