const fs = require('fs')
const path = require('path')
const os = require('os')

const TRASH_PATH = path.join(os.homedir(), '.Trash')

let watcher = null
let callback = null

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
          const subResult = getFolderSize(itemPath)
          totalSize += subResult.size
          fileCount += subResult.count
        } else {
          totalSize += stat.size
          fileCount++
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  return { size: totalSize, count: fileCount }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getTrashInfo() {
  const result = getFolderSize(TRASH_PATH)
  return {
    sizeBytes: result.size,
    sizeFormatted: formatBytes(result.size),
    fileCount: result.count,
  }
}

function start(cb) {
  callback = cb

  // Gửi thông tin ban đầu
  try {
    const info = getTrashInfo()
    setTimeout(() => {
      if (callback) callback(info)
    }, 1000)
  } catch {
    // skip
  }

  // Theo dõi thay đổi — dùng polling vì fs.watch có thể bị EPERM trên ~/.Trash
  try {
    watcher = fs.watch(TRASH_PATH, { persistent: false }, (eventType) => {
      if (eventType === 'rename' || eventType === 'change') {
        clearTimeout(watcher._debounce)
        watcher._debounce = setTimeout(() => {
          if (callback) callback(getTrashInfo())
        }, 500)
      }
    })
  } catch (err) {
    console.log('[TrashWatcher] fs.watch unavailable, using polling:', err.message)
    // Fallback: polling mỗi 30 giây
    let lastSize = -1
    watcher = { _pollInterval: setInterval(() => {
      try {
        const info = getTrashInfo()
        if (info.sizeBytes !== lastSize) {
          lastSize = info.sizeBytes
          if (callback) callback(info)
        }
      } catch {}
    }, 30000) }
  }
}

function stop() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

module.exports = { start, stop, getTrashInfo }
