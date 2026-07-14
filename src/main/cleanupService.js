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
    // Có timeout để tránh treo vô hạn (macOS gần đây có bug Finder/AppleScript đôi khi hang)
    const { stdout } = await execAsync(`osascript -e 'tell application "Finder" to return size of trash'`, { timeout: 8000 })
    const size = Number(stdout.trim())
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

async function emptyTrashViaFS() {
  // Xoá trực tiếp từng item trong ~/.Trash bằng Node fs — nhanh, kết quả
  // biết ngay lập tức, không phụ thuộc vào Finder/AppleScript. AppleScript
  // 'empty trash' trên các bản macOS gần đây (vd Tahoe/26) có bug đã biết:
  // đôi khi "báo xong" nhưng Finder vẫn chưa xoá thật (chạy ngầm, bất đồng
  // bộ), hoặc thậm chí bị treo (hang) trong 1 số trường hợp. Xoá trực tiếp
  // qua fs tránh hoàn toàn 2 vấn đề đó.
  // Cần Full Disk Access; nếu không có, readdirSync sẽ throw EPERM và
  // cleanTrash() sẽ tự chuyển sang phương án AppleScript bên dưới.
  const items = fs.readdirSync(TRASH_PATH, { withFileTypes: true })
  let freed = 0
  let remaining = 0
  for (const item of items) {
    if (item.name.startsWith('.')) continue
    const itemPath = path.join(TRASH_PATH, item.name)
    let itemSize = 0
    try {
      const stat = fs.statSync(itemPath)
      itemSize = stat.isDirectory() ? getFolderSize(itemPath).size : stat.size
    } catch { /* không đọc được size, coi như 0 */ }
    try {
      fs.rmSync(itemPath, { recursive: true, force: true })
      freed += itemSize
    } catch {
      // File có thể đang mở/bị khoá — bỏ qua, tính vào phần "còn lại"
      remaining += itemSize
    }
  }
  return { freed, remaining }
}

async function cleanTrash() {
  const beforeInfo = await getTrashInfo()
  const before = beforeInfo.sizeBytes

  if (before === 0) {
    return { success: true, type: 'trash', freedBytes: 0, remainingBytes: 0, freedFormatted: '0 B', message: 'Thùng rác đã trống!' }
  }

  let fsFreed = 0
  let fsUsed = false

  // Cách 1 (ưu tiên): xoá trực tiếp qua filesystem (chỉ xoá được ~/.Trash)
  try {
    const { freed } = await emptyTrashViaFS()
    fsFreed = freed
    fsUsed = true
  } catch (fsErr) {
    console.warn('[cleanupService] Không xoá trực tiếp qua fs được (có thể thiếu Full Disk Access), thử qua AppleScript:', fsErr.message)
  }

  // Kiểm tra lại tổng lượng rác thực tế (bao gồm ổ ngoài/iCloud)
  let globalRemaining = (await getTrashInfo()).sizeBytes

  // Nếu xoá qua fs xong mà không còn gì, trả kết quả luôn
  if (fsUsed && globalRemaining === 0) {
    return {
      success: true,
      type: 'trash',
      freedBytes: fsFreed,
      remainingBytes: 0,
      freedFormatted: formatBytes(fsFreed),
      message: `Đã dọn ${formatBytes(fsFreed)} rác!`,
    }
  }

  if (globalRemaining > 0) {
    console.warn(`[cleanupService] Vẫn còn ${formatBytes(globalRemaining)} rác (có thể ổ ngoài/iCloud hoặc file khoá), fallback sang AppleScript...`)
  }

  // Cách 2 (dự phòng): AppleScript — dọn sạch toàn bộ Trash trên mọi ổ đĩa.
  try {
    await execAsync(`osascript -e 'tell application "Finder" to empty trash'`, { timeout: 8000 })

    let finalRemaining = globalRemaining
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 400))
      finalRemaining = (await getTrashInfo()).sizeBytes
      if (finalRemaining === 0 || finalRemaining < globalRemaining) break
    }
    
    // Kiểm tra lại chắc chắn
    finalRemaining = (await getTrashInfo()).sizeBytes

    const appleScriptFreed = Math.max(0, globalRemaining - finalRemaining)
    const totalFreed = fsFreed + appleScriptFreed

    if (finalRemaining > 0) {
      console.warn(`[cleanupService] Trash vẫn còn ${formatBytes(finalRemaining)} sau khi dọn qua AppleScript (có thể do file bị khoá, cần xác nhận thủ công trong Finder, hoặc thiếu quyền Automation cho Finder trong System Settings → Privacy & Security → Automation)`)
    }

    return {
      success: true,
      type: 'trash',
      freedBytes: totalFreed,
      remainingBytes: finalRemaining,
      freedFormatted: formatBytes(totalFreed),
      message: finalRemaining > 0
        ? `Đã dọn ${formatBytes(totalFreed)}, còn ${formatBytes(finalRemaining)} chưa xoá được!`
        : `Đã dọn ${formatBytes(totalFreed)} rác!`,
    }
  } catch (err) {
    return {
      success: fsUsed ? true : false,
      type: 'trash',
      freedBytes: fsFreed,
      remainingBytes: globalRemaining,
      freedFormatted: formatBytes(fsFreed),
      error: err.message,
      message: fsUsed
        ? `Đã dọn ${formatBytes(fsFreed)} rác, còn ${formatBytes(globalRemaining)} không thể xoá: ${err.message}`
        : 'Không thể dọn rác: ' + err.message + ' — hãy cấp quyền Full Disk Access cho app trong System Settings → Privacy & Security → Full Disk Access.',
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
