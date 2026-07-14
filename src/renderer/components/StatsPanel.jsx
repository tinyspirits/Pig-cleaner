import React from 'react'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const precision = i >= 3 ? 2 : 1 // Hiện 2 chữ số cho GB và TB để dễ thấy thay đổi
  return parseFloat((bytes / Math.pow(k, i)).toFixed(precision)) + ' ' + sizes[i]
}

export default function StatsPanel({ trashInfo, cacheInfo = [], totalEaten, pigScale, weather, onClose }) {
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
        <h3>🐷 Heo Thống Kê</h3>

        {/* Thời tiết */}
        {weather?.description && (
          <div className="stats-row" style={{ marginBottom: 4 }}>
            <span>🌤️ Thời tiết</span>
            <strong style={{ fontSize: 11, maxWidth: 130, textAlign: 'right' }}>{weather.description}</strong>
          </div>
        )}

        <div className="stats-row" style={{ marginTop: 6 }}>
          <span>🗑️ Thùng rác</span>
          <strong>{trashInfo?.sizeFormatted || '0 B'}</strong>
        </div>
        {totalCacheBytes > 0 && (
          <div className="stats-row">
            <span>📦 Cache bẩn</span>
            <strong>{formatBytes(totalCacheBytes)}</strong>
          </div>
        )}
        <div className="stats-row" style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 4 }}>
          <span>📊 Tổng rác</span>
          <strong style={{ color: '#FF6B9D' }}>{formatBytes(totalRac)}</strong>
        </div>

        <div className="stats-row" style={{ marginTop: 6 }}>
          <span>🍽️ Đã ăn tổng</span>
          <strong title={`${(totalEaten * 1024).toLocaleString('en-US')} Bytes`}>
            {formatBytes(totalEaten * 1024)}
          </strong>
        </div>
        <div className="stats-row">
          <span>📏 Kích thước heo</span>
          <strong>{Math.round((pigScale - 1) * 100 + 100)}%</strong>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#999', textAlign: 'center' }}>
          Nhấp vào heo để ăn rác! 🐽
        </div>
      </div>
    </>
  )
}
