import React from 'react'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function StatsPanel({ trashInfo, totalEaten, pigScale, onClose }) {
  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 199, pointerEvents: 'all' }} 
        onClick={onClose}
      />
      <div className="stats-panel" style={{ zIndex: 200 }}>
        <button className="close-btn" onClick={onClose}>✕</button>
      <h3>🐷 Heo Thống Kê</h3>
      <div className="stats-row">
        <span>🗑️ Rác hiện tại</span>
        <strong>{trashInfo?.sizeFormatted || '0 B'}</strong>
      </div>
      <div className="stats-row">
        <span>📄 Số file rác</span>
        <strong>{trashInfo?.fileCount || 0} file</strong>
      </div>
      <div className="stats-row">
        <span>🍽️ Đã ăn tổng</span>
        <strong>{formatBytes(totalEaten * 1024)}</strong>
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
