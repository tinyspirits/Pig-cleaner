const i18n = require('i18next')
const path = require('path')
const fs = require('fs')

// We will load the translation files manually since electron packager might bundle them differently
function loadLocale(lng) {
  try {
    const localePath = path.join(__dirname, `../locales/${lng}/translation.json`)
    if (fs.existsSync(localePath)) {
      return JSON.parse(fs.readFileSync(localePath, 'utf8'))
    }
    // Try to load from resources if packaged
    const packagedPath = path.join(process.resourcesPath, `app.asar/src/locales/${lng}/translation.json`)
    if (fs.existsSync(packagedPath)) {
      return JSON.parse(fs.readFileSync(packagedPath, 'utf8'))
    }
  } catch (err) {
    console.error(`Failed to load locale ${lng}:`, err)
  }
  return {}
}

const resources = {
  en: { translation: loadLocale('en') },
  vi: { translation: loadLocale('vi') },
  ja: { translation: loadLocale('ja') }
}

i18n.init({
  resources,
  lng: 'en', // Default will be overwritten by settings
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

module.exports = i18n
