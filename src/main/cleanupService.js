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

// Lấy dung lượng trống THỰC TẾ của ổ đĩa qua `df` (Unix) — không đi qua Finder nên
// không bị dính bug cache "size of trash báo số ảo". Dùng để đối chiếu/kiểm chứng
// lại con số freedBytes tính từ AppleScript, tránh trường hợp báo 0 KB dù đã dọn thật.
async function getDiskFreeBytes() {
  try {
    if (process.platform === 'win32') return null // Windows đã có Clear-RecycleBin đáng tin cậy riêng
    const { stdout } = await execAsync(`df -k "${os.homedir()}"`, { timeout: 5000 })
    const lines = stdout.trim().split('\n')
    const cols = lines[lines.length - 1].trim().split(/\s+/)
    const availableKB = parseInt(cols[3], 10) // Filesystem 1024-blocks Used Available Capacity Mounted-on
    return isNaN(availableKB) ? null : availableKB * 1024
  } catch {
    return null
  }
}

async function getFolderSize(folderPath) {
  let totalSize = 0
  let fileCount = 0
  try {
    const items = await fs.promises.readdir(folderPath, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue
      const itemPath = path.join(folderPath, item.name)
      try {
        const stat = await fs.promises.stat(itemPath)
        if (stat.isDirectory()) {
          const sub = await getFolderSize(itemPath)
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
  
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync(`powershell -NoProfile -Command "$items = (New-Object -ComObject Shell.Application).NameSpace(10).Items(); $size = 0; foreach($item in $items) { $size += $item.Size }; Write-Output \\"COUNT:$($items.Count) SIZE:$size\\""`, { timeout: 8000 })
      const matchCount = stdout.match(/COUNT:(\d+)/)
      const matchSize = stdout.match(/SIZE:(\d+)/)
      if (matchCount && matchSize) {
        fileCount = parseInt(matchCount[1], 10)
        sizeBytes = parseInt(matchSize[1], 10) || 0
      }
    } catch (err) {
      console.error('[cleanupService] Windows PowerShell failed:', err.message)
    }
    return {
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      fileCount,
    }
  }

  try {
    // Ưu tiên dùng AppleScript để lấy size của Trash vì nó không bị lỗi EPERM (Full Disk Access)
    // CẦN KIỂM TRA SỐ LƯỢNG TRƯỚC: Do macOS có bug thỉnh thoảng `size of trash` báo số ảo (ví dụ 8GB) dù thùng rác trống rỗng.
    const { stdout: countOut } = await execAsync(`osascript -e 'tell application "Finder" to count items of trash'`, { timeout: 8000 })
    const count = Number(countOut.trim())
    
    if (count === 0) {
      sizeBytes = 0
      fileCount = 0
    } else {
      const { stdout } = await execAsync(`osascript -e 'tell application "Finder" to return size of trash'`, { timeout: 8000 })
      const size = Number(stdout.trim())
      if (!isNaN(size)) {
        sizeBytes = size
      } else {
        const result = await getFolderSize(TRASH_PATH)
        sizeBytes = result.size
      }
      fileCount = count
    }
  } catch (err) {
    console.error('[cleanupService] AppleScript failed:', err.message)
    // Fallback về cách đếm folder cũ nếu AppleScript lỗi
    const result = await getFolderSize(TRASH_PATH)
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
const isWin = process.platform === 'win32'
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')

const CACHE_CATEGORIES = [
  {
    id: 'system',
    label: '🖥️ System Cache',
    paths: isWin ? [
      path.join(localAppData, 'Temp'),
      path.join(home, 'AppData', 'Local', 'Microsoft', 'Windows', 'INetCache'),
    ] : [
      path.join(home, 'Library', 'Caches'),
    ],
  },
  {
    id: 'npm',
    label: '📦 npm Cache',
    paths: isWin ? [
      path.join(localAppData, 'npm-cache'),
      path.join(home, '.npm', '_cacache'),
    ] : [
      path.join(home, '.npm', '_cacache'),
      path.join(home, 'Library', 'Caches', 'npm'),
    ],
  },
  {
    id: 'yarn',
    label: '🧶 Yarn Cache',
    paths: isWin ? [
      path.join(localAppData, 'Yarn', 'Cache'),
    ] : [
      path.join(home, 'Library', 'Caches', 'yarn'),
      path.join(home, '.yarn', 'cache'),
    ],
  },
  {
    id: 'pip',
    label: '🐍 pip / Python Cache',
    paths: isWin ? [
      path.join(localAppData, 'pip', 'Cache'),
    ] : [
      path.join(home, 'Library', 'Caches', 'pip'),
      path.join(home, '.cache', 'pip'),
    ],
  },
  {
    id: 'brew',
    label: '🍺 Homebrew Cache',
    paths: isWin ? [] : [
      path.join(home, 'Library', 'Caches', 'Homebrew'),
      '/Library/Caches/Homebrew',
    ],
  },
  {
    id: 'xcode',
    label: '🔨 Xcode DerivedData',
    paths: isWin ? [] : [
      path.join(home, 'Library', 'Developer', 'Xcode', 'DerivedData'),
      path.join(home, 'Library', 'Caches', 'com.apple.dt.Xcode'),
    ],
  },
  {
    id: 'vscode',
    label: '💻 VS Code Cache',
    paths: isWin ? [
      path.join(appData, 'Code', 'Cache'),
      path.join(appData, 'Code', 'CachedData'),
      path.join(appData, 'Code', 'CachedExtensions'),
    ] : [
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
    paths: isWin ? [
      path.join(appData, 'Docker'),
      path.join(localAppData, 'Docker', 'wsl'),
    ] : [
      path.join(home, 'Library', 'Containers', 'com.docker.docker', 'Data', 'vms'),
    ],
  },
  {
    id: 'browser',
    label: '🌐 Browser Cache',
    paths: isWin ? [
      path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
      path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    ] : [
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
          const info = await getFolderSize(p)
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
          const items = await fs.promises.readdir(p, { withFileTypes: true })
          for (const item of items) {
            if (item.name.startsWith('.')) continue
            const itemPath = path.join(p, item.name)
            try {
              const stat = await fs.promises.stat(itemPath)
              if (stat.mtimeMs < cutoff) {
                const size = item.isDirectory() ? (await getFolderSize(itemPath)).size : stat.size
                await fs.promises.rm(itemPath, { recursive: true, force: true })
                freed += size
              }
            } catch { /* skip */ }
          }
        } else {
          const sizeBefore = (await getFolderSize(p)).size
          try {
            // Xóa từng file/folder bên trong thay vì xóa cả thư mục gốc để tránh bị nghẽn ở 1 file bị khóa (locked)
            const items = await fs.promises.readdir(p)
            for (const item of items) {
              try {
                await fs.promises.rm(path.join(p, item), { recursive: true, force: true })
              } catch { /* skip locked file */ }
            }
          } catch { /* skip */ }
          const sizeAfter = (await getFolderSize(p)).size
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
  let freed = 0
  let remaining = 0
  const uid = os.userInfo().uid.toString()
  
  const mainTrashPath = path.join(os.homedir(), '.Trash')
  try {
    await fs.promises.readdir(mainTrashPath)
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES' || err.message.includes('Operation not permitted')) {
      throw new Error('PermissionDenied')
    }
  }

  const trashPaths = [
    mainTrashPath,
    path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/.Trash')
  ]
  
  try {
    const volumes = await fs.promises.readdir('/Volumes')
    for (const vol of volumes) {
      if (vol === 'Macintosh HD' || vol.startsWith('.')) continue
      trashPaths.push(path.join('/Volumes', vol, '.Trashes', uid))
    }
  } catch (err) { }

  for (const tPath of trashPaths) {
    try {
      const items = await fs.promises.readdir(tPath, { withFileTypes: true })
      for (const item of items) {
        if (item.name === '.DS_Store') continue
        const itemPath = path.join(tPath, item.name)
        let itemSize = 0
        try {
          const stat = await fs.promises.stat(itemPath)
          itemSize = stat.isDirectory() ? (await getFolderSize(itemPath)).size : stat.size
        } catch { /* ignore */ }
        
        try {
          await fs.promises.rm(itemPath, { recursive: true, force: true })
          freed += itemSize
        } catch {
          remaining += itemSize
        }
      }
    } catch {
      // Ignore if trash folder doesn't exist or no permission for secondary paths
    }
  }
  return { freed, remaining }
}

async function cleanTrash() {
  const beforeInfo = await getTrashInfo()
  const before = beforeInfo.sizeBytes

  if (before === 0 && beforeInfo.fileCount === 0) {
    return { success: true, type: 'trash', freedBytes: 0, remainingBytes: 0, freedFormatted: '0 B', message: 'Thùng rác đã trống!' }
  }

  if (process.platform === 'win32') {
    try {
      await execAsync(`powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"`, { timeout: 60000 })
      await new Promise(r => setTimeout(r, 1000))
      const finalInfo = await getTrashInfo()
      const freedBytes = Math.max(0, before - finalInfo.sizeBytes)
      return {
        success: true,
        type: 'trash',
        freedBytes: freedBytes,
        remainingBytes: finalInfo.sizeBytes,
        freedFormatted: formatBytes(freedBytes),
        message: finalInfo.sizeBytes > 0 
          ? `Đã dọn ${formatBytes(freedBytes)}, còn lại ${formatBytes(finalInfo.sizeBytes)}!` 
          : `Đã dọn ${formatBytes(freedBytes)} rác!`,
      }
    } catch (err) {
      return {
        success: false,
        type: 'trash',
        freedBytes: 0,
        remainingBytes: before,
        freedFormatted: '0 B',
        error: err.message,
        message: 'Lỗi dọn rác Windows: ' + err.message,
      }
    }
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
  const diskFreeBefore = await getDiskFreeBytes()
  try {
    await execAsync(`osascript -e 'tell application "Finder" to empty trash'`, { timeout: 60000 })

    let finalRemaining = globalRemaining
    let unchangedCount = 0
    for (let i = 0; i < 60; i++) { // Wait up to 30 seconds
      await new Promise(resolve => setTimeout(resolve, 500))
      const currentTrash = await getTrashInfo()
      const currentRemaining = currentTrash.sizeBytes
      
      if (currentRemaining === 0 && currentTrash.fileCount === 0) {
        finalRemaining = 0
        break
      }
      
      if (currentRemaining === finalRemaining) {
        unchangedCount++
        // If it hasn't changed for 10 iterations (5 seconds) and is less than before, we assume it's done.
        // Or if it hasn't changed for 20 iterations (10 seconds) overall.
        if (unchangedCount > 20) break
      } else {
        unchangedCount = 0
        finalRemaining = currentRemaining
      }
    }

    const appleScriptFreed = Math.max(0, globalRemaining - finalRemaining)
    let totalFreed = fsFreed + appleScriptFreed

    // Đối chiếu với dung lượng ổ đĩa thực (không qua Finder). Nếu Finder báo cache lỗi
    // (freed tính ra thấp hơn nhiều so với thực tế đã trống thêm trên ổ đĩa), tin theo ổ đĩa.
    if (diskFreeBefore !== null) {
      const diskFreeAfter = await getDiskFreeBytes()
      if (diskFreeAfter !== null) {
        const diskDelta = diskFreeAfter - diskFreeBefore
        // Chỉ tin theo ổ đĩa khi chênh lệch rõ ràng hơn hẳn (>1MB) so với số đã tính,
        // để tránh nhiễu do file khác đang được ghi/xoá song song ngoài ý muốn.
        if (diskDelta > totalFreed + 1024 * 1024) {
          console.warn(`[cleanupService] Finder báo freed=${formatBytes(totalFreed)} nhưng ổ đĩa trống ra thêm ${formatBytes(diskDelta)} -> dùng số liệu ổ đĩa (khả năng Finder bị cache lỗi 'size of trash').`)
          totalFreed = Math.min(diskDelta, before)
        }
      }
    }

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
