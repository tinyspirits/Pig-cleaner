import React, { useState, useEffect } from 'react'
import PigPet from './components/PigPet'
import StatsPanel from './components/StatsPanel'
import CachePanel from './components/CachePanel'
import SettingsPanel from './components/SettingsPanel'
import { usePigState } from './hooks/usePigState'

const isElectron = typeof window !== 'undefined' && window.pigAPI

export default function App() {
  const [trashInfo, setTrashInfo] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showCache, setShowCache] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [permissionWarning, setPermissionWarning] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)

  const { mode, bubble, pigScale, totalEaten, triggerEat, setMode } = usePigState(trashInfo)
  const isPanelOpen = showStats || showCache || showSettings || permissionWarning

  // Setup IPC listeners
  useEffect(() => {
    if (!isElectron) {
      // Dev mode: mock data
      setTrashInfo({ sizeBytes: 1024 * 1024 * 150, sizeFormatted: '150 MB', fileCount: 42 })
      return
    }

    // Lắng nghe trash changes
    const unsubTrash = window.pigAPI.onTrashChanged((info) => {
      setTrashInfo(info)
    })

    // Lắng nghe clean complete
    const unsubClean = window.pigAPI.onCleanComplete((result) => {
      setIsCleaning(false)
      if (result.freedBytes > 0) {
        triggerEat(result.freedBytes / 1024) // convert to KB
      }
    })

    // Lắng nghe lệnh gọi heo về
    const unsubHome = window.pigAPI.onPigCalledHome(() => {
      setMode('idle')
    })

    // Lắng nghe permission status
    const unsubPerm = window.pigAPI.onPermissionStatus((hasPermission) => {
      if (!hasPermission) setPermissionWarning(true)
    })

    // Lắng nghe show stats
    const unsubStats = window.pigAPI.onShowStats(() => {
      setShowStats(prev => !prev)
    })

    // Lắng nghe show cache panel
    const unsubCache = window.pigAPI.onShowCachePanel(() => {
      setShowCache(prev => !prev)
    })

    // Lắng nghe show settings panel
    const unsubSettings = window.pigAPI.onShowSettings(() => {
      setShowSettings(prev => !prev)
    })

    // Lắng nghe bắt đầu dọn dẹp
    const unsubCleanStarted = window.pigAPI.onCleanStarted(() => {
      setIsCleaning(true)
      setMode('eating')
    })

    // Load trash info ban đầu
    window.pigAPI.getTrashInfo().then(setTrashInfo)

    return () => {
      unsubTrash?.()
      unsubClean?.()
      unsubHome?.()
      unsubPerm?.()
      unsubStats?.()
      unsubCache?.()
      unsubSettings?.()
      unsubCleanStarted?.()
    }
  }, [])

  // Manage mouse ignore globally based on panel open state
  useEffect(() => {
    if (isElectron) {
      if (isPanelOpen) {
        window.pigAPI.setIgnoreMouse(false)
      } else {
        window.pigAPI.setIgnoreMouse(true)
      }
    }
  }, [isPanelOpen])

  // Double click → dọn rác
  async function handlePigDoubleClick() {
    if (isCleaning) return
    setIsCleaning(true)
    setMode('eating')

    if (isElectron) {
      try {
        const result = await window.pigAPI.cleanAll()
        setIsCleaning(false)
        if (result.freedBytes > 0) {
          triggerEat(result.freedBytes / 1024)
          // Cập nhật trash info sau khi dọn
          const newInfo = await window.pigAPI.getTrashInfo()
          setTrashInfo(newInfo)
        }
      } catch (err) {
        console.error('Clean failed:', err)
        setIsCleaning(false)
        setMode('idle')
      }
    } else {
      // Dev mode: simulate
      setTimeout(() => {
        setIsCleaning(false)
        triggerEat(150 * 1024) // 150MB
        setTrashInfo({ sizeBytes: 0, sizeFormatted: '0 B', fileCount: 0 })
      }, 2000)
    }
  }

  return (
    <div className="pig-wrapper">
      {/* Stats Panel */}
      {showStats && (
        <StatsPanel
          trashInfo={trashInfo}
          totalEaten={totalEaten}
          pigScale={pigScale}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Permission Warning */}
      {permissionWarning && (
        <div className="permission-warning" onClick={() => setPermissionWarning(false)}>
          ⚠️ Cần cấp Full Disk Access<br />
          <small>System Settings → Privacy & Security → Full Disk Access</small>
        </div>
      )}

      {/* Cache Panel */}
      {showCache && (
        <CachePanel
          onClose={() => setShowCache(false)}
          onCleaned={(freedBytes) => {
            triggerEat(freedBytes / 1024)
            setShowCache(false)
          }}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Con Heo Chính */}
      <PigPet
        mode={mode}
        bubble={bubble}
        pigScale={pigScale}
        isPanelOpen={isPanelOpen}
        onDoubleClick={handlePigDoubleClick}
      />

      {/* Cleaning indicator */}
      {isCleaning && (
        <div style={{
          position: 'fixed',
          bottom: 110,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,107,157,0.9)',
          color: 'white',
          padding: '6px 16px',
          borderRadius: 20,
          fontSize: 13,
          fontFamily: '-apple-system, sans-serif',
          fontWeight: 600,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
        }}>
          Đang ăn rác... 🐽
        </div>
      )}
    </div>
  )
}
