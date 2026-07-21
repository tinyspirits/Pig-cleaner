import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const isElectron = typeof window !== 'undefined' && window.pigAPI

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Tắt' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '1 tiếng' },
  { value: 120, label: '2 tiếng' },
  { value: 360, label: '6 tiếng' },
]

export default function SettingsPanel({ onClose, pigScale = 1.0, onChangePigScale }) {
  const { t, i18n } = useTranslation()
  // Chốt lại mốc tối đa NGAY LÚC MỞ panel - kéo chỉ được nhỏ hơn/bằng size hiện tại
  // lúc mở, không cho kéo vượt quá (tránh dùng thanh trượt để "gian lận" làm to thêm).
  const [maxScale] = useState(() => Math.max(pigScale, 0.01))
  const [scaleInput, setScaleInput] = useState(pigScale)
  const [settings, setSettings] = useState({
    autoCleanInterval: 0,
    autoCleanCategories: ['trash', 'temp'],
    displayMode: 'always-on-top',
    cameraFollowsPig: true,
    weatherEffects: true,
    weatherAlerts: true,
    weatherLocation: null,
    poolMode: false,
    soundEnabled: false,
    language: i18n.language || 'en',
    openAtLogin: false,
  })
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState([])
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [autoCity, setAutoCity] = useState(null)
  const [initialLanguage] = useState(i18n.language)
  const petLabel = t(settings.petType === 'duck' ? 'settingsPanel.duck' : 'settingsPanel.pig')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    if (isElectron) {
      const savedSettings = await window.pigAPI.getSettings()
      setSettings(savedSettings)
      
      const cats = await window.pigAPI.getCacheTypes()
      // Add trash manually as it's handled differently
      setCategories([{ id: 'trash', label: '🗑️ Thùng rác' }, ...cats])

      const weather = await window.pigAPI.getWeather()
      if (weather && weather.city) {
        setAutoCity(weather.city)
      }
    } else {
      // Mock data
      setSettings({
        autoCleanInterval: 60,
        autoCleanCategories: ['trash', 'system', 'temp']
      })
      setCategories([
        { id: 'trash', label: '🗑️ Thùng rác' },
        { id: 'system', label: '🖥️ System Cache' },
        { id: 'temp', label: '🗂️ Temp Files' },
        { id: 'npm', label: '📦 npm Cache' },
        { id: 'browser', label: '🌐 Browser Cache' },
      ])
    }
  }

  const handleToggleCategory = (id) => {
    setSettings(prev => {
      const autoCleanCategories = prev.autoCleanCategories.includes(id)
        ? prev.autoCleanCategories.filter(c => c !== id)
        : [...prev.autoCleanCategories, id]
      return { ...prev, autoCleanCategories }
    })
  }

  const handleSearchLocation = async () => {
    if (!locationQuery.trim()) return
    setSearchingLocation(true)
    setLocationResults([])
    if (isElectron) {
      const results = await window.pigAPI.searchLocation(locationQuery)
      setLocationResults(results)
    }
    setSearchingLocation(false)
  }

  const handleSelectLocation = (loc) => {
    setSettings(prev => ({ ...prev, weatherLocation: { lat: loc.lat, lon: loc.lon, city: loc.label } }))
    setLocationResults([])
    setLocationQuery('')
  }

  const handleUseAutoLocation = () => {
    setSettings(prev => ({ ...prev, weatherLocation: null }))
    setLocationResults([])
    setLocationQuery('')
  }

  const handleSave = async () => {
    setSaving(true)
    if (isElectron) {
      // QUAN TRỌNG: loại bỏ pigScale khỏi payload lưu ở đây. `settings.pigScale` là bản
      // chụp lúc MỞ panel (không được cập nhật khi kéo slider), nếu gửi nguyên sẽ ĐÈ lên
      // giá trị đúng đã được setPigScaleAndSave() lưu riêng ngay lúc kéo -> heo bị "trở to
      // trở lại" sau khi bấm Lưu (bug đã báo).
      const { pigScale: _staleIgnored, ...settingsToSave } = settings
      await window.pigAPI.saveSettings(settingsToSave)
    }
    setSaving(false)
    onClose()
  }

  const handleCancel = () => {
    if (settings.language !== initialLanguage) {
      i18n.changeLanguage(initialLanguage)
    }
    onClose()
  }

  return (
    <div className="cache-panel-overlay" onClick={handleCancel}>
      <div className="cache-panel" onClick={e => e.stopPropagation()}>
        <div className="cache-panel-header">
          <span>{t('settingsPanel.title', { pet: petLabel })}</span>
          <button className="cache-close-btn" onClick={handleCancel}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <div className="settings-section-title">🌐 {t('settingsPanel.language')}</div>
            <select 
              className="settings-select"
              value={settings.language || 'en'}
              onChange={e => {
                const newLang = e.target.value
                setSettings(prev => ({ ...prev, language: newLang }))
                i18n.changeLanguage(newLang)
              }}
            >
              <option value="en">{t('settingsPanel.english')}</option>
              <option value="vi">{t('settingsPanel.vietnamese')}</option>
              <option value="ja">{t('settingsPanel.japanese')}</option>
            </select>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">🐾 {t('settingsPanel.petType', 'Pet Type')}</div>
            <select 
              className="settings-select"
              value={settings.petType || 'pig'}
              onChange={e => setSettings(prev => ({ ...prev, petType: e.target.value }))}
            >
              <option value="pig">{t('settingsPanel.pig', 'Heo (Pig)')}</option>
              <option value="duck">{t('settingsPanel.duck', 'Vịt (Duck)')}</option>
            </select>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">🔊 {t('settingsPanel.sound', 'Âm thanh (Sound)')}</div>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.soundEnabled === true}
                onChange={e => setSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
              />
              <span className="cache-item-label">{t('settingsPanel.soundEnabled', 'Bật tiếng kêu khi dọn rác (Enable sound on clean)')}</span>
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">🕒 {t('settingsPanel.autoClean')}</div>
            <select 
              className="settings-select"
              value={settings.autoCleanInterval}
              onChange={e => setSettings(prev => ({ ...prev, autoCleanInterval: parseInt(e.target.value) }))}
            >
              <option value={0}>{t('settingsPanel.never')}</option>
              <option value={30}>{t('settingsPanel.every30m')}</option>
              <option value={60}>{t('settingsPanel.every1h')}</option>
              <option value={120}>{t('settingsPanel.every2h')}</option>
              <option value={240}>{t('settingsPanel.every4h')}</option>
              <option value={480}>{t('settingsPanel.every8h')}</option>
            </select>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">📏 {t('settingsPanel.pigSize', 'Kích thước')}</div>
            <input
              type="range"
              className="settings-select"
              min={0}
              max={maxScale}
              step={0.01}
              value={Math.min(scaleInput, maxScale)}
              onChange={e => {
                const val = parseFloat(e.target.value)
                setScaleInput(val)
                onChangePigScale?.(val)
              }}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px', textAlign: 'center' }}>
              {Math.round((Math.min(scaleInput, maxScale) / maxScale) * 100)}%
              {' '}(scale x{Math.min(scaleInput, maxScale).toFixed(2)})
              {' '}({t('settingsPanel.pigSizeHint', 'chỉ có thể thu nhỏ, không thể vượt quá kích thước hiện tại')})
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">🖥️ {t('settingsPanel.displayMode')}</div>
            <select 
              className="settings-select"
              value={settings.displayMode || 'always-on-top'}
              onChange={e => setSettings(prev => ({ ...prev, displayMode: e.target.value }))}
            >
              <option value="always-on-top">{t('settingsPanel.alwaysOnTop')}</option>
              <option value="desktop">{t('settingsPanel.desktopOnly')}</option>
            </select>
          </div>

          {isElectron && (
            <div className="settings-section">
              <div className="settings-section-title">🚀 {t('settingsPanel.startup')}</div>
              <label className="cache-item">
                <input
                  type="checkbox"
                  checked={settings.openAtLogin === true}
                  onChange={e => setSettings(prev => ({ ...prev, openAtLogin: e.target.checked }))}
                />
                <span className="cache-item-label">
                  {t('settingsPanel.openAtLogin')}
                </span>
              </label>
            </div>
          )}

          <div className="settings-section">
            <div className="settings-section-title">🗂️ {t('settingsPanel.cleanItemsList', 'Clean these items')}</div>
            <div className="cache-list" style={{ maxHeight: '200px' }}>
              {categories.map(cat => (
                <label key={cat.id} className="cache-item">
                  <input
                    type="checkbox"
                    checked={settings.autoCleanCategories.includes(cat.id)}
                    onChange={() => handleToggleCategory(cat.id)}
                  />
                  <span className="cache-item-label">{t(`cacheCategories.${cat.id}`, cat.label)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">📍 {t('settingsPanel.weatherLocation', 'Weather location')}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              {t('settingsPanel.currentLocation', 'Current')}: {settings.weatherLocation
                ? `${settings.weatherLocation.city} (${t('settingsPanel.manual', 'manual')})`
                : `${t('settingsPanel.autoIP', 'Auto by IP')} (${autoCity || t('settingsPanel.loading', 'loading...')})`}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="settings-select"
                style={{ flex: 1 }}
                placeholder={t('settingsPanel.enterCity', 'Enter city name...')}
                value={locationQuery}
                onChange={e => setLocationQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchLocation()}
              />
              <button
                className="cache-clean-btn"
                style={{ width: 'auto', padding: '0 14px' }}
                onClick={handleSearchLocation}
                disabled={searchingLocation}
              >
                {searchingLocation ? '...' : t('settingsPanel.search', 'Search')}
              </button>
            </div>
            {locationResults.length > 0 && (
              <div className="cache-list" style={{ maxHeight: '150px', marginTop: '6px' }}>
                {locationResults.map((loc, i) => (
                  <div
                    key={i}
                    className="cache-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSelectLocation(loc)}
                  >
                    <span className="cache-item-label">📍 {loc.label}</span>
                  </div>
                ))}
              </div>
            )}
            {settings.weatherLocation && (
              <button
                className="cache-clean-btn"
                style={{ marginTop: '6px', background: '#999' }}
                onClick={handleUseAutoLocation}
              >
                {t('settingsPanel.useAutoLocation', 'Use automatic location (IP)')}
              </button>
            )}
          </div>

          <div className="settings-section">
            <div className="settings-section-title">☁️ {t('settingsPanel.effects')}</div>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.cameraFollowsPig !== false}
                onChange={e => setSettings(prev => ({ ...prev, cameraFollowsPig: e.target.checked }))}
              />
              <span className="cache-item-label">{t('settingsPanel.cameraFollow', { pet: petLabel })}</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.weatherEffects !== false}
                onChange={e => setSettings(prev => ({ ...prev, weatherEffects: e.target.checked }))}
              />
              <span className="cache-item-label">{t('settingsPanel.realisticWeather')}</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.weatherAlerts !== false}
                onChange={e => setSettings(prev => ({ ...prev, weatherAlerts: e.target.checked }))}
              />
              <span className="cache-item-label">{t('settingsPanel.weatherReaction', { pet: petLabel })}</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.poolMode === true}
                onChange={e => setSettings(prev => ({ ...prev, poolMode: e.target.checked }))}
              />
              <span className="cache-item-label">{t('settingsPanel.pool')}</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.unlimitedPigSize === true}
                onChange={e => setSettings(prev => ({ ...prev, unlimitedPigSize: e.target.checked }))}
              />
              <span className="cache-item-label">{t('settingsPanel.unlimitedPigSize', { pet: petLabel, defaultValue: 'Pig grows unlimitedly when eating trash' })}</span>
            </label>
          </div>
        </div>

        <button className="cache-clean-btn" onClick={handleSave} disabled={saving}>
          {saving ? '...' : t('cachePanel.saveAndClose', 'Save & Close')} 
        </button>
      </div>
    </div>
  )
}
