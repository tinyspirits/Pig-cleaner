/**
 * settings.js - Persistent settings using electron-store (plain JSON fallback)
 */
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const SETTINGS_PATH = path.join(app.getPath('userData'), 'pig-settings.json')

const DEFAULTS = {
  // Auto-clean interval in minutes (0 = disabled)
  autoCleanInterval: 0,
  // Which cache categories to include in auto-clean
  autoCleanCategories: ['trash', 'temp', 'npm', 'yarn'],
  // Which categories to include when user manually triggers "clean all"
  manualCleanCategories: ['trash', 'system', 'temp', 'npm', 'yarn', 'brew'],
  // Persistent pig state
  pigBaseScale: 1.0,    // do slider set (0.05-1.0), kích thước nền
  pigEatenScale: 0.0,   // tăng khi ăn rác, giảm dần về 0 theo thời gian
  pigScale: 1.0,        // legacy - dùng để migrate, thực tế = pigBaseScale + pigEatenScale
  totalEaten: 0,
  // Display mode: 'always-on-top' or 'desktop'
  displayMode: 'always-on-top',
  // Camera follows pig to the sky
  cameraFollowsPig: true,
  // Pig size limit
  unlimitedPigSize: false,
  neverGrow: false,
  // Weather
  weatherEffects: true,   // Hiệu ứng mưa, gió, sét
  weatherAlerts: true,    // Heo phản ứng theo thời tiết (kêu nóng, lạnh, cảnh báo)
  // Vị trí thời tiết: null = tự động theo IP, hoặc { lat, lon, city } do người dùng chọn
  weatherLocation: null,
  // pool mode
  poolMode: false,
  // Ngôn ngữ
  language: 'en',
  // Pet type (pig or duck)
  petType: 'pig',
  // Follower piglets array
  followers: [],
  // Tự khởi động cùng hệ điều hành (Windows/macOS)
  openAtLogin: false,
  // Âm thanh tuỳ chỉnh theo từng loại thú cưng
  petSounds: {
    pig: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
    duck: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
    dog: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
    custom: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
  },
  // Custom character animation frames & settings
  customCharacter: {
    idle: { frames: [], fps: 2, loop: true },
    walking: { frames: [], fps: 6, loop: true },
    sniffing: { frames: [], fps: 2, loop: true },
    eating: { frames: [], fps: 6, loop: true },
    full: { frames: [], fps: 2, loop: true },
    sleeping: { frames: [], fps: 1.5, loop: true },
    scared: { frames: [], fps: 1, loop: true },
    drag_held: { frames: [], fps: 1, loop: false },
    drag_falling: { frames: [], fps: 1, loop: false },
    drag_landed: { frames: [], fps: 1, loop: false },
    diving_float: { frames: [], fps: 1, loop: true },
    diving_down: { frames: [], fps: 6, loop: true },
    diving_up: { frames: [], fps: 1, loop: true },
    diving_bottom: { frames: [], fps: 6, loop: true },
    drowning: { frames: [], fps: 6, loop: true },
    drowning_sink: { frames: [], fps: 1, loop: false },
    drowning_bottom: { frames: [], fps: 1, loop: false },
    struggling: { frames: [], fps: 6, loop: true },
  },
}

function load() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
      const parsed = JSON.parse(raw)
      return { 
        ...DEFAULTS, 
        ...parsed,
        petSounds: {
          ...DEFAULTS.petSounds,
          ...(parsed.petSounds || {})
        }
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

function save(settings) {
  try {
    const current = load()
    const merged = { ...current, ...settings }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf8')
  } catch { /* ignore */ }
}

module.exports = { load, save, DEFAULTS }
