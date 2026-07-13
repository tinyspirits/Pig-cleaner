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
  const result = getFolderSize(TRASH_PATH)
  return {
    sizeBytes: result.size,
    sizeFormatted: formatBytes(result.size),
    fileCount: result.count,
  }
}

async function cleanTrash() {
  const beforeInfo = await getTrashInfo()
  const before = beforeInfo.sizeBytes

  try {
    // Dùng AppleScript để dọn rác (phát âm thanh chuẩn của Mac)
    await execAsync(`osascript -e 'tell application "Finder" to empty trash'`)
    const after = await getTrashInfo()
    return {
      success: true,
      type: 'trash',
      freedBytes: before - after.sizeBytes,
      freedFormatted: formatBytes(Math.max(0, before - after.sizeBytes)),
      message: `Đã dọn ${formatBytes(Math.max(0, before - after.sizeBytes))} rác!`,
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
  const tempDirs = [
    os.tmpdir(),
    path.join(os.homedir(), 'Library', 'Caches'),
  ]

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - SEVEN_DAYS
  let totalFreed = 0
  let errorCount = 0

  for (const dir of tempDirs) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true })
      for (const item of items) {
        if (item.name.startsWith('.')) continue
        const itemPath = path.join(dir, item.name)
        try {
          const stat = fs.statSync(itemPath)
          if (stat.mtimeMs < cutoff) {
            const size = item.isDirectory() ? getFolderSize(itemPath).size : stat.size
            fs.rmSync(itemPath, { recursive: true, force: true })
            totalFreed += size
          }
        } catch {
          errorCount++
        }
      }
    } catch { /* skip */ }
  }

  return {
    success: true,
    type: 'temp',
    freedBytes: totalFreed,
    freedFormatted: formatBytes(totalFreed),
    message: `Đã dọn ${formatBytes(totalFreed)} file tạm!`,
  }
}

async function cleanAll() {
  const trashResult = await cleanTrash()
  const tempResult = await cleanTemp()
  const totalFreed = (trashResult.freedBytes || 0) + (tempResult.freedBytes || 0)

  return {
    success: true,
    type: 'all',
    freedBytes: totalFreed,
    freedFormatted: formatBytes(totalFreed),
    trash: trashResult,
    temp: tempResult,
    message: `Căng da bụng! Đã ăn ${formatBytes(totalFreed)} rác!`,
  }
}

module.exports = { getTrashInfo, cleanTrash, cleanTemp, cleanAll }
