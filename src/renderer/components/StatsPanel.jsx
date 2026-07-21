import React from 'react'
import { useTranslation } from 'react-i18next'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const precision = i >= 3 ? 2 : 1 // Hiện 2 chữ số cho GB và TB để dễ thấy thay đổi
  return parseFloat((bytes / Math.pow(k, i)).toFixed(precision)) + ' ' + sizes[i]
}

export default function StatsPanel({ trashInfo, cacheInfo = [], totalEaten, pigScale, weather, petType = 'pig', onClose }) {
  const { t } = useTranslation()
  const petLabel = t(petType === 'duck' ? 'settingsPanel.duck' : 'settingsPanel.pig')
  const petEmoji = petType === 'duck' ? '🦆' : '🐽'
  const totalCacheBytes = cacheInfo.reduce((s, c) => s + (c.sizeBytes || 0), 0)
  const totalRac = (trashInfo?.sizeBytes || 0) + totalCacheBytes

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 199, pointerEvents: 'all' }}
        onClick={onClose}
      />
      <div className="stats-panel" style={{ zIndex: 200 }}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h3>{petEmoji} {t('statsPanel.title', { pet: petLabel })}</h3>

        {/* Thời tiết */}
        {weather?.description && (
          <div className="stats-row" style={{ marginBottom: 4 }}>
            <span>🌤️ {t('statsPanel.weather', 'Weather')}</span>
            <strong style={{ fontSize: 11, maxWidth: 130, textAlign: 'right' }}>{weather.description}</strong>
          </div>
        )}

        <div className="stats-row" style={{ marginTop: 6 }}>
          <span>🗑️ {t('statsPanel.trashSize')}</span>
          <strong>{trashInfo?.sizeFormatted || '0 B'}</strong>
        </div>
        {totalCacheBytes > 0 && (
          <div className="stats-row">
            <span>📦 {t('statsPanel.dirtyCache', 'Dirty Cache')}</span>
            <strong>{formatBytes(totalCacheBytes)}</strong>
          </div>
        )}
        <div className="stats-row" style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 4 }}>
          <span>📊 {t('statsPanel.totalTrash', 'Total Trash')}</span>
          <strong style={{ color: '#FF6B9D' }}>{formatBytes(totalRac)}</strong>
        </div>

        <div className="stats-row" style={{ marginTop: 6 }}>
          <span>🍽️ {t('statsPanel.totalEaten')}</span>
          <strong title={`${(totalEaten * 1024).toLocaleString('en-US')} Bytes`}>
            {formatBytes(totalEaten * 1024)}
          </strong>
        </div>
        <div className="stats-row">
          <span>📏 {t('statsPanel.pigSize', { pet: petLabel })}</span>
          <strong title={`scale = ${pigScale.toFixed(3)}`}>
            {Math.round(pigScale * 100)}% (x{pigScale.toFixed(2)})
          </strong>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#999', textAlign: 'center' }}>
          {t('statsPanel.clickToEat', { pet: petLabel, emoji: petEmoji })}
        </div>
      </div>
    </>
  )
}
