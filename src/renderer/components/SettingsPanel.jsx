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
  })
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)

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
        </div>

        <button className="cache-clean-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  )
}
