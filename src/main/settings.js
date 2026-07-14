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
}

function load() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
      return { ...DEFAULTS, ...JSON.parse(raw) }
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

function save(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8')
  } catch { /* ignore */ }
}

module.exports = { load, save, DEFAULTS }
