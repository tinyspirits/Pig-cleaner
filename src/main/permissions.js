const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function checkFullDiskAccess() {
  try {
    // Thử đọc file trong Library/Caches để kiểm tra quyền
    const { stdout } = await execAsync('ls ~/Library/Caches 2>&1')
    return { hasAccess: true, message: 'Đã có quyền Full Disk Access' }
  } catch (err) {
    if (err.message.includes('Operation not permitted') || err.message.includes('Permission denied')) {
      return {
        hasAccess: false,
        message: 'Cần cấp quyền Full Disk Access',
        guide: 'Vào System Settings → Privacy & Security → Full Disk Access → Bật cho Pig Cleaner',
      }
    }
    // Nếu lỗi khác, giả sử có quyền
    return { hasAccess: true, message: 'OK' }
  }
}

module.exports = { checkFullDiskAccess }
