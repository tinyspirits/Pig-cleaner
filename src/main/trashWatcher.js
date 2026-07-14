const fs = require('fs')
const path = require('path')
const os = require('os')

const cleanupService = require('./cleanupService')

const TRASH_PATH = path.join(os.homedir(), '.Trash')

let watcher = null
let callback = null

function start(cb) {
  callback = cb

  // Gửi thông tin ban đầu
  try {
    cleanupService.getTrashInfo().then(info => {
      setTimeout(() => {
        if (callback) callback(info)
      }, 1000)
    })
  } catch {
    // skip
  }

  // Theo dõi thay đổi — dùng polling vì fs.watch có thể bị EPERM trên ~/.Trash
  try {
    watcher = fs.watch(TRASH_PATH, { persistent: false }, (eventType) => {
      if (eventType === 'rename' || eventType === 'change') {
        clearTimeout(watcher._debounce)
        watcher._debounce = setTimeout(() => {
          cleanupService.getTrashInfo().then(info => {
            if (callback) callback(info)
          })
        }, 500)
      }
    })
  } catch (err) {
    // Fallback: polling mỗi 30 giây (không in log lỗi EPERM ra để tránh gây nhầm lẫn)
    let lastSize = -1
    watcher = { _pollInterval: setInterval(() => {
      try {
        cleanupService.getTrashInfo().then(info => {
          if (info.sizeBytes !== lastSize) {
            lastSize = info.sizeBytes
            if (callback) callback(info)
          }
        })
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

module.exports = { start, stop }
