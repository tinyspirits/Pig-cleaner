import React, { useState, useEffect } from 'react'

const isElectron = typeof window !== 'undefined' && window.pigAPI

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Tắt' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '1 tiếng' },
  { value: 120, label: '2 tiếng' },
  { value: 360, label: '6 tiếng' },
]

export default function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({
    autoCleanInterval: 0,
    autoCleanCategories: ['trash', 'temp'],
    displayMode: 'always-on-top',
    cameraFollowsPig: true,
    weatherEffects: true,
    weatherAlerts: true,
    weatherLocation: null,
    floodMode: false,
    snowMode: false,
  })
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState([])
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [autoCity, setAutoCity] = useState(null)

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
      await window.pigAPI.saveSettings(settings)
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="cache-panel-overlay" onClick={onClose}>
      <div className="cache-panel" onClick={e => e.stopPropagation()}>
        <div className="cache-panel-header">
          <span>⚙️ Cài đặt</span>
          <button className="cache-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <div className="settings-section-title">🕒 Tự động dọn rác</div>
            <select 
              className="settings-select"
              value={settings.autoCleanInterval}
              onChange={e => setSettings(prev => ({ ...prev, autoCleanInterval: parseInt(e.target.value) }))}
            >
              {INTERVAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">🖥️ Chế độ hiển thị</div>
            <select 
              className="settings-select"
              value={settings.displayMode || 'always-on-top'}
              onChange={e => setSettings(prev => ({ ...prev, displayMode: e.target.value }))}
            >
              <option value="always-on-top">Luôn nổi trên mọi ứng dụng</option>
              <option value="desktop">Chỉ nổi trên Desktop (bị đè)</option>
            </select>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">🗂️ Dọn các mục sau</div>
            <div className="cache-list" style={{ maxHeight: '200px' }}>
              {categories.map(cat => (
                <label key={cat.id} className="cache-item">
                  <input
                    type="checkbox"
                    checked={settings.autoCleanCategories.includes(cat.id)}
                    onChange={() => handleToggleCategory(cat.id)}
                  />
                  <span className="cache-item-label">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">📍 Vị trí thời tiết</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              Hiện tại: {settings.weatherLocation
                ? `${settings.weatherLocation.city} (tự chọn)`
                : `Tự động theo IP (${autoCity || 'đang tải...'})`}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="settings-select"
                style={{ flex: 1 }}
                placeholder="Nhập tên thành phố..."
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
                {searchingLocation ? '...' : 'Tìm'}
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
                Dùng lại vị trí tự động (theo IP)
              </button>
            )}
          </div>

          <div className="settings-section">
            <div className="settings-section-title">☁️ Trải nghiệm</div>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.cameraFollowsPig !== false}
                onChange={e => setSettings(prev => ({ ...prev, cameraFollowsPig: e.target.checked }))}
              />
              <span className="cache-item-label">Camera bay theo heo lên mây</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.weatherEffects !== false}
                onChange={e => setSettings(prev => ({ ...prev, weatherEffects: e.target.checked }))}
              />
              <span className="cache-item-label">Hiệu ứng thời tiết (mưa, gió, chớp sét)</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.weatherAlerts !== false}
                onChange={e => setSettings(prev => ({ ...prev, weatherAlerts: e.target.checked }))}
              />
              <span className="cache-item-label">Heo phản ứng thời tiết (kêu nóng, lạnh, cảnh báo)</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.floodMode === true}
                onChange={e => setSettings(prev => ({ ...prev, floodMode: e.target.checked }))}
              />
              <span className="cache-item-label">Bật chế độ lũ lụt (Nước ngập)</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.snowMode === true}
                onChange={e => setSettings(prev => ({ ...prev, snowMode: e.target.checked }))}
              />
              <span className="cache-item-label">Giả lập tuyết rơi (Phủ tuyết màn hình)</span>
            </label>
            <label className="cache-item">
              <input
                type="checkbox"
                checked={settings.unlimitedPigSize === true}
                onChange={e => setSettings(prev => ({ ...prev, unlimitedPigSize: e.target.checked }))}
              />
              <span className="cache-item-label">Heo ăn rác tăng kích thước không giới hạn</span>
            </label>
          </div>
        </div>

        <button className="cache-clean-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  )
}
