import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { playLocalAudio } from '../utils/playLocalAudio'
import CustomCharacterPanel from './CustomCharacterPanel'

const isElectron = typeof window !== 'undefined' && window.pigAPI

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Tắt' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '1 tiếng' },
  { value: 120, label: '2 tiếng' },
  { value: 360, label: '6 tiếng' },
]

export default function SettingsPanel({ onClose, pigScale = 1.0, pigEatenScale = 0, onChangePigScale, onResetPigScale, onSpawnPiglet, onClearPiglets }) {
  const { t, i18n } = useTranslation()
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
    petSounds: {
      pig: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
      duck: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
      dog: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
      custom: { eating: null, birdCatch: null, random: null, swimming: null, scared: null },
    },
  })
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState([])
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [showCustomConfig, setShowCustomConfig] = useState(false)
  const [autoCity, setAutoCity] = useState(null)
  const [initialLanguage] = useState(i18n.language)
  const petLabel = t(settings.petType === 'duck' ? 'settingsPanel.duck' : (settings.petType === 'dog' ? 'settingsPanel.dog' : 'settingsPanel.pig'))

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

  const handleSelectSound = async (petType, soundKey) => {
    if (!isElectron || !window.pigAPI.selectSoundFile) return
    const filePath = await window.pigAPI.selectSoundFile()
    if (!filePath) return
    setSettings(prev => ({
      ...prev,
      petSounds: {
        ...prev.petSounds,
        [petType]: { ...(prev.petSounds?.[petType] || {}), [soundKey]: filePath }
      }
    }))
  }

  const handleClearSound = (petType, soundKey) => {
    setSettings(prev => ({
      ...prev,
      petSounds: {
        ...prev.petSounds,
        [petType]: { ...(prev.petSounds?.[petType] || {}), [soundKey]: null }
      }
    }))
  }

  const handlePlaySound = async (filePath) => {
    await playLocalAudio(filePath)
  }

  const handleSave = async () => {
    setSaving(true)
    if (isElectron) {
      // QUAN TRỌNG: loại bỏ pigScale, pigBaseScale, pigEatenScale khỏi payload lưu ở đây.
      // Đây là bản chụp lúc MỞ panel (không được cập nhật khi kéo slider), nếu gửi nguyên
      // sẽ ĐÈ lên giá trị đúng đã được setPigScaleAndSave() lưu riêng ngay lúc kéo.
      // Tương tự, loại bỏ followers, followersCount, totalEaten vì chúng có thể đã thay đổi ở ngoài (spawn baby)
      const { pigScale: _s1, pigBaseScale: _s2, pigEatenScale: _s3, followers: _s4, followersCount: _s5, totalEaten: _s6, ...settingsToSave } = settings
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

        <div className="settings-content" style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'flex-start' }}>

          {/* ── CỘT TRÁI: Kích thước + Hiệu ứng ── */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>

            <div className="settings-section">
              <div className="settings-section-title">📏 {t('settingsPanel.pigSize', 'Kích thước')}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#fff' }}>
                {t('settingsPanel.baseSize', 'Kích thước nền')}:
                {' '}<span style={{ color: '#f0c' }}>{Math.round(scaleInput * 100)}%</span>
                {scaleInput < 1.0 && <span style={{ color: '#ccc', fontSize: '12px' }}> — {t('settingsPanel.smallerThanDefault', 'nhỏ hơn mặc định')}</span>}
                {scaleInput >= 1.0 && <span style={{ color: '#8f8', fontSize: '12px' }}> — {t('settingsPanel.isDefault', 'mặc định')}</span>}
              </div>
              <input
                type="range"
                className="settings-select"
                min={0.05}
                max={1.0}
                step={0.05}
                value={Math.min(scaleInput, 1.0)}
                onChange={e => {
                  const val = parseFloat(e.target.value)
                  setScaleInput(val)
                  onChangePigScale?.(val)
                }}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.5, marginTop: '2px' }}>
                <span>5% ({t('settingsPanel.smallest', 'nhỏ nhất')})</span>
                <span style={{ fontWeight: 'bold', opacity: 1 }}>100% ({t('settingsPanel.default', 'mặc định')})</span>
              </div>
              {pigEatenScale > 0.001 && (
                <div style={{ fontSize: '12px', marginTop: '6px', padding: '5px 10px', background: 'rgba(255,180,0,0.12)', borderRadius: '6px', color: '#f9c' }}>
                  🍔 +{Math.round(pigEatenScale * 100)}% {t('settingsPanel.bonusText', 'bonus từ ăn rác — tự giảm dần')}
                  {' '}→ {t('settingsPanel.total', 'tổng')} {Math.round((scaleInput + pigEatenScale) * 100)}%
                </div>
              )}
              <button
                className="cache-clean-btn"
                style={{ marginTop: '6px', background: '#555', fontSize: '12px', padding: '5px 14px', width: 'auto' }}
                onClick={() => {
                  setScaleInput(1.0)
                  onResetPigScale?.()
                }}
              >
                🔄 {t('settingsPanel.resetSize', 'Reset về mặc định (x1.0)')}
              </button>
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
              <label className="cache-item">
                <input
                  type="checkbox"
                  checked={settings.neverGrow === true}
                  onChange={e => setSettings(prev => ({ ...prev, neverGrow: e.target.checked }))}
                />
                <span className="cache-item-label">{t('settingsPanel.neverGrow', { pet: petLabel, defaultValue: 'Pig and babies never grow' })}</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', padding: '0 4px' }}>
                <button
                  className="cache-clean-btn"
                  style={{ flex: 1, padding: '6px', fontSize: '12px', width: 'auto' }}
                  onClick={() => onSpawnPiglet?.()}
                >
                  👶 {t('settingsPanel.spawnPiglet', 'Spawn Baby')}
                </button>
                <button
                  className="cache-clean-btn"
                  style={{ flex: 1, padding: '6px', fontSize: '12px', width: 'auto', background: '#994444' }}
                  onClick={() => onClearPiglets?.()}
                >
                  ❌ {t('settingsPanel.clearPiglets', 'Clear Babies')}
                </button>
              </div>
            </div>

          </div>

          {/* ── CỘT GIỮA: Ngôn ngữ, Pet, Âm thanh, Auto Clean, Display, Startup ── */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>

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
                <option value="dog">{t('settingsPanel.dog', 'Chó (Dog)')}</option>
                <option value="custom">🎨 Custom Character</option>
              </select>

              <button
                type="button"
                onClick={() => setShowCustomConfig(true)}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  background: 'rgba(120, 80, 220, 0.3)',
                  border: '1px solid rgba(160, 120, 255, 0.4)',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                ⚙️ {t('settingsPanel.configCustomCharacter', 'Cấu hình Custom Character')}
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">🔊 {t('settingsPanel.sound', 'Âm thanh (Sound)')}</div>
              <label className="cache-item">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled === true}
                  onChange={e => setSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                />
                <span className="cache-item-label">{t('settingsPanel.soundEnabled', 'Bật âm thanh')}</span>
              </label>

              {(() => {
                const pet = settings.petType || 'pig'
                const sounds = settings.petSounds?.[pet] || {}
                const soundDefs = [
                  { key: 'eating',    icon: '🍖', label: t('settingsPanel.soundEating', 'Đang ăn') },
                  { key: 'birdCatch', icon: '🐦', label: t('settingsPanel.soundBirdCatch', 'Bắt được chim') },
                  { key: 'random',    icon: '🎲', label: t('settingsPanel.soundRandom', 'Ngẫu nhiên') },
                  { key: 'swimming',  icon: '🏊', label: t('settingsPanel.soundSwimming', 'Đang bơi') },
                  { key: 'scared',    icon: '😱', label: t('settingsPanel.soundScared', 'Sợ hãi') },
                ]
                return (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', opacity: settings.soundEnabled ? 1 : 0.5 }}>
                    {soundDefs.map(({ key, icon, label }) => {
                      const filePath = sounds[key]
                      const fileName = filePath ? filePath.split('/').pop().split('\\').pop() : null
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                          <span style={{ minWidth: '18px' }}>{icon}</span>
                          <span style={{ minWidth: '60px', color: '#ddd' }}>{label}</span>
                          <span style={{ flex: 1, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filePath || ''}>
                            {fileName || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>{t('settingsPanel.soundDefault', 'mặc định')}</span>}
                          </span>
                          {filePath && (
                            <button
                              title={t('settingsPanel.soundPlay', 'Phát thử')}
                              style={{ background: '#2a6', border: 'none', color: '#fff', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}
                              onClick={() => handlePlaySound(filePath)}
                            >▶</button>
                          )}
                          <button
                            title={t('settingsPanel.soundChoose', 'Chọn file')}
                            style={{ background: '#446', border: 'none', color: '#fff', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}
                            onClick={() => handleSelectSound(pet, key)}
                          >📂</button>
                          {filePath && (
                            <button
                              title={t('settingsPanel.soundClear', 'Xoá')}
                              style={{ background: '#633', border: 'none', color: '#fff', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}
                              onClick={() => handleClearSound(pet, key)}
                            >✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
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

          </div>

          {/* ── CỘT PHẢI: Danh sách dọn + Vị trí thời tiết ── */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>

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

          </div>

        </div>

        <button className="cache-clean-btn" onClick={handleSave} disabled={saving}>
          {saving ? '...' : t('cachePanel.saveAndClose', 'Save & Close')} 
        </button>
      </div>
      {showCustomConfig && (
        <CustomCharacterPanel
          onClose={() => setShowCustomConfig(false)}
          onSaved={async () => {
            if (isElectron) {
              const s = await window.pigAPI.getSettings()
              setSettings(s)
            }
          }}
        />
      )}
    </div>
  )
}
