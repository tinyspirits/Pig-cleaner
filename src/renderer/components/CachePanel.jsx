import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const isElectron = typeof window !== 'undefined' && window.pigAPI

export default function CachePanel({ onClose, onCleaned }) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState([])
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setLoading(true)
    if (isElectron) {
      const cats = await window.pigAPI.getCacheTypes()
      setCategories(cats)
      // Mặc định chọn các loại có dữ liệu
      const defaultSelected = {}
      cats.forEach(c => {
        if (c.exists) defaultSelected[c.id] = true
      })
      setSelected(defaultSelected)
    } else {
      // Dev mock
      const mock = [
        { id: 'system', label: '🖥️ System Cache', sizeFormatted: '1.2 GB', sizeBytes: 1200000000, exists: true },
        { id: 'npm', label: '📦 npm Cache', sizeFormatted: '450 MB', sizeBytes: 450000000, exists: true },
        { id: 'yarn', label: '🧶 Yarn Cache', sizeFormatted: '230 MB', sizeBytes: 230000000, exists: true },
        { id: 'pip', label: '🐍 pip Cache', sizeFormatted: '0 B', sizeBytes: 0, exists: false },
        { id: 'brew', label: '🍺 Homebrew', sizeFormatted: '780 MB', sizeBytes: 780000000, exists: true },
        { id: 'xcode', label: '🔨 Xcode', sizeFormatted: '3.4 GB', sizeBytes: 3400000000, exists: true },
        { id: 'vscode', label: '💻 VS Code', sizeFormatted: '120 MB', sizeBytes: 120000000, exists: true },
        { id: 'gradle', label: '🐘 Gradle', sizeFormatted: '0 B', sizeBytes: 0, exists: false },
        { id: 'docker', label: '🐳 Docker', sizeFormatted: '0 B', sizeBytes: 0, exists: false },
        { id: 'temp', label: '🗂️ Temp Files', sizeFormatted: '89 MB', sizeBytes: 89000000, exists: true },
      ]
      setCategories(mock)
      const defaultSelected = {}
      mock.forEach(c => { if (c.exists) defaultSelected[c.id] = true })
      setSelected(defaultSelected)
    }
    setLoading(false)
  }

  function toggleAll(val) {
    const next = {}
    categories.filter(c => c.exists).forEach(c => { next[c.id] = val })
    setSelected(next)
  }

  const selectedIds = Object.keys(selected).filter(k => selected[k])
  const totalSelected = categories
    .filter(c => selectedIds.includes(c.id))
    .reduce((s, c) => s + c.sizeBytes, 0)

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  async function handleClean() {
    if (selectedIds.length === 0) return
    setCleaning(true)
    setResult(null)

    if (isElectron) {
      const res = await window.pigAPI.cleanCache(selectedIds)
      setResult(res)
      setCleaning(false)
      if (res.freedBytes > 0) onCleaned?.(res.freedBytes)
      // Reload categories
      loadCategories()
    } else {
      setTimeout(() => {
        const mockFreed = totalSelected * 0.9
        setResult({ freedBytes: mockFreed, freedFormatted: formatBytes(mockFreed), success: true })
        setCleaning(false)
        onCleaned?.(mockFreed)
      }, 1500)
    }
  }

  return (
    <div className="cache-panel-overlay" onClick={onClose}>
      <div className="cache-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cache-panel-header">
          <span>🐷 {t('cachePanel.title', 'Cache Cleanup')}</span>
          <button className="cache-close-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="cache-loading">{t('cachePanel.scanning', 'Scanning... 🔍')}</div>
        ) : result ? (
          /* Result screen */
          <div className="cache-result">
            <div className="cache-result-icon">🎉</div>
            <div className="cache-result-text">{t('cachePanel.cleaned', 'Cleaned')}</div>
            <div className="cache-result-size">{result.freedFormatted}</div>
            <button className="cache-clean-btn" onClick={() => { setResult(null); loadCategories() }}>
              {t('cachePanel.scanAgain', 'Scan Again')}
            </button>
          </div>
        ) : (
          <>
            {/* Select all / none */}
            <div className="cache-select-all">
              <button onClick={() => toggleAll(true)}>{t('cachePanel.selectAll', 'Select All')}</button>
              <button onClick={() => toggleAll(false)}>{t('cachePanel.deselectAll', 'Deselect All')}</button>
              <span className="cache-total-size">
                {selectedIds.length > 0 ? `~${formatBytes(totalSelected)}` : ''}
              </span>
            </div>

            {/* Category list */}
            <div className="cache-list">
              {categories.map(cat => (
                <label
                  key={cat.id}
                  className={`cache-item ${!cat.exists ? 'cache-item--empty' : ''} ${selected[cat.id] ? 'cache-item--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[cat.id]}
                    disabled={!cat.exists}
                    onChange={e => setSelected(prev => ({ ...prev, [cat.id]: e.target.checked }))}
                  />
                  <span className="cache-item-label">{t(`cacheCategories.${cat.id}`, cat.label)}</span>
                  <span className="cache-item-size">{cat.exists ? cat.sizeFormatted : '—'}</span>
                </label>
              ))}
            </div>

            {/* Clean button */}
            <button
              className="cache-clean-btn"
              disabled={selectedIds.length === 0 || cleaning}
              onClick={handleClean}
            >
              {cleaning ? t('cachePanel.cleaning', 'Cleaning... 🐽') : `🧹 ${t('cachePanel.cleanItems', { count: selectedIds.length, defaultValue: 'Clean {{count}} items' })}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
