import React, { useState, useEffect } from 'react'
import PigPet from './components/PigPet'
import StatsPanel from './components/StatsPanel'
import CachePanel from './components/CachePanel'
import SettingsPanel from './components/SettingsPanel'
import WeatherEffects from './components/WeatherEffects'
import { usePigState } from './hooks/usePigState'
import { useWeather } from './hooks/useWeather'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: 'red', color: 'white', zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
          <h1>React Crashed!</h1>
          <pre>{this.state.error.toString()}</pre>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

const isElectron = typeof window !== 'undefined' && window.pigAPI

function App() {
  const [trashInfo, setTrashInfo] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showCache, setShowCache] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [permissionWarning, setPermissionWarning] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [weatherSettings, setWeatherSettings] = useState({ weatherEffects: true, weatherAlerts: true })

  const { mode, bubble, pigScale, totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble } = usePigState(trashInfo)
  const isPanelOpen = showStats || showCache || showSettings || permissionWarning
  const weather = useWeather()

  // Load weather settings khi app khởi động
  useEffect(() => {
    if (isElectron) {
      window.pigAPI.getSettings().then(s => {
        setWeatherSettings({
          weatherEffects: s.weatherEffects !== false,
          weatherAlerts: s.weatherAlerts !== false,
        })
      })
    }
  }, [])

  // Reload settings khi đóng Settings panel
  const handleReloadSettings = () => {
    reloadSettings()
    if (isElectron) {
      window.pigAPI.getSettings().then(s => {
        setWeatherSettings({
          weatherEffects: s.weatherEffects !== false,
          weatherAlerts: s.weatherAlerts !== false,
        })
      })
    }
  }

  // Phản ứng thời tiết của heo
  useEffect(() => {
    if (!weatherSettings.weatherAlerts) return
    const { condition, temperature, windSpeed, upcomingCondition } = weather

    let msg = null

    // Cảnh báo thời tiết sắp tới (chỉ báo nếu hiện tại chưa mưa)
    const isRainingNow = condition === 'rain' || condition === 'drizzle' || condition === 'thunderstorm'

    if (upcomingCondition === 'thunderstorm' && !isRainingNow) msg = '⛈️ Bão sắp đến! Trú ẩn nào!'
    else if (upcomingCondition === 'rain' && !isRainingNow) msg = '🌧️ Sắp mưa rồi! Ướt thôi...'
    else if (upcomingCondition === 'drizzle' && !isRainingNow) msg = '🌦️ Sắp có mưa phùn!'
    // Thời tiết hiện tại
    else if (windSpeed > 60) msg = '🌪️ Gió quá mạnh! Tôi sắp bay...'
    else if (windSpeed > 40) msg = '🌬️ Gió mạnh quá đó!'
    else if (condition === 'thunderstorm') msg = '⚡️ Trời nổi giận!'
    else if (condition === 'rain' || condition === 'drizzle') msg = '💧 Ồi! Ướt rồi! Lạnh quá!'
    else if (condition === 'snow') msg = '❄️ Tuyết rơi! Lạnh quá đi!'
    else if (condition === 'clear' && temperature > 35) msg = '🔥 Nắng nóng cực! Cháy da rồi!'
    else if (condition === 'clear' && temperature > 30) msg = '☀️ Nóng quá! Cho tôi nghỉ tí!'
    else if (temperature !== null && temperature < 10) msg = '🥶 Lạnh cắt da luôn!'
    else if (temperature !== null && temperature < 18) msg = '🧊 Tôi đang thấy lạnh!'

    if (msg) setTimeout(() => forceBubble(msg), 3000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather.condition, weather.upcomingCondition, weatherSettings.weatherAlerts])

  // Lắng nghe sự kiện sét đánh từ WeatherEffects
  useEffect(() => {
    if (!weatherSettings.weatherAlerts) return
    const handleLightning = () => {
      setMode('scared')
      forceBubble('Sợ quá! 😭')
      setTimeout(() => setMode('idle'), 2000)
    }
    window.addEventListener('lightning-strike', handleLightning)
    return () => window.removeEventListener('lightning-strike', handleLightning)
  }, [weatherSettings.weatherAlerts, setMode, forceBubble])

  // Lắng nghe động đất khi heo khổng lồ rơi xuống
  const [isEarthquake, setIsEarthquake] = useState(false)
  useEffect(() => {
    const handleEarthquake = () => {
      setIsEarthquake(true)
      setTimeout(() => setIsEarthquake(false), 500)
    }
    window.addEventListener('earthquake', handleEarthquake)
    return () => window.removeEventListener('earthquake', handleEarthquake)
  }, [])

  // Setup IPC listeners
  useEffect(() => {
    if (!isElectron) {
      // Dev mode: mock data
      setTrashInfo({ sizeBytes: 1024 * 1024 * 150, sizeFormatted: '150 MB', fileCount: 42 })
      return
    }

    // Lắng nghe trash changes (auto)
    const unsubTrash = window.pigAPI.onTrashChanged((info) => {
      setTrashInfo(info)
    })

    // Lắng nghe trash check (manual)
    const unsubTrashManual = window.pigAPI.onTrashCheckedManually((info) => {
      setTrashInfo(info)
      if (info.sizeBytes > 0) {
        setMode('sniffing')
        forceBubble(`Thùng rác đang có ${info.sizeFormatted} rác! 🗑️`)
      } else {
        forceBubble(`Thùng rác sạch bóng! ✨`)
      }
    })

    // Lưu ý: onCleanComplete chỉ được đăng ký MỘT lần, ở dưới (gần
    // onCleanStarted) — trước đây bị đăng ký 2 lần ở đây và ở dưới, khiến
    // mỗi lần dọn rác xong, triggerEat() và các bubble message chạy 2 lần
    // liên tiếp (vd: "Đã ăn tổng" bị cộng dồn gấp đôi số byte thật đã dọn).

    // Lắng nghe lệnh gọi heo về
    const unsubHome = window.pigAPI.onPigCalledHome(() => {
      setMode('idle')
    })

    // Lắng nghe permission status
    const unsubPerm = window.pigAPI.onPermissionStatus((hasPermission) => {
      if (!hasPermission) setPermissionWarning(true)
    })

    // Lắng nghe show stats
    const unsubStats = window.pigAPI.onShowStats(async () => {
      setShowStats(prev => !prev)
      if (isElectron) {
        const newTrash = await window.pigAPI.getTrashInfo()
        setTrashInfo(newTrash)
        const newCache = await window.pigAPI.getCacheTypes()
        setCacheInfo(newCache)
      }
    })

    // Lắng nghe show cache panel
    const unsubCache = window.pigAPI.onShowCachePanel(() => {
      setShowCache(prev => !prev)
    })

    // Lắng nghe show settings panel
    const unsubSettings = window.pigAPI.onShowSettings(() => {
      setShowSettings(prev => !prev)
    })

    // Lắng nghe bắt đầu dọn dẹp (từ tray)
    const unsubCleanStarted = window.pigAPI.onCleanStarted(() => {
      setIsCleaning(true)
      setMode('eating')
    })

    // Lắng nghe hoàn thành dọn dẹp (từ tray)
    const unsubCleanComplete = window.pigAPI.onCleanComplete(async (data) => {
      setIsCleaning(false)

      if (data.trash?.success === false) {
        forceBubble('Heo chưa được cấp quyền full access ⚠️')
        setTimeout(() => setMode('idle'), 4000)
        return
      }

      if (data.freedBytes > 0) {
        triggerEat(data.freedBytes / 1024)
      }
      // cleanTrash() giờ đã tự chờ + xác minh thật trước khi trả kết quả,
      // nên gọi lại getTrashInfo() ở đây là lấy số liệu chính xác, không
      // còn cần "lạc quan" set cứng về 0 nữa (cách cũ khiến Thống Kê hiện
      // sai 0 rồi lại nhảy về số cũ khi mở lại panel).
      const newInfo = await window.pigAPI.getTrashInfo()
      setTrashInfo(newInfo)
      if (data.freedBytes <= 0) {
        forceBubble('Ủa, không có rác à? 🐷')
        setTimeout(() => setMode('idle'), 1500)
      } else if (data.remainingBytes > 0) {
        forceBubble(`Còn ${newInfo.sizeFormatted} chưa dọn được, có file đang mở à? 🤔`)
      }
    })

    // Load trash info ban đầu
    window.pigAPI.getTrashInfo().then(setTrashInfo)

    return () => {
      unsubTrash?.()
      unsubTrashManual?.()
      unsubHome?.()
      unsubPerm?.()
      unsubStats?.()
      unsubCache?.()
      unsubSettings?.()
      unsubCleanStarted?.()
      unsubCleanComplete?.()
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
    
    if (isElectron) {
      try {
        // B1: Đổi sang mode sniffing để kiểm tra rác
        setMode('sniffing')
        forceBubble('Đang tìm rác... 🐽')
        const currentTrash = await window.pigAPI.getTrashInfo()
        const currentCache = await window.pigAPI.getCacheTypes()
        const totalCacheBytes = currentCache.reduce((sum, c) => sum + c.sizeBytes, 0)
        const totalBytes = currentTrash.sizeBytes + totalCacheBytes
        
        if (totalBytes === 0) {
          forceBubble('Trắng bóc rồi! Không có gì để dọn ✨')
          setTimeout(() => {
            setMode('idle')
            setIsCleaning(false)
          }, 1500)
          return
        }

        // Format size
        let formattedSize = ''
        if (totalBytes < 1024) formattedSize = totalBytes + ' B'
        else if (totalBytes < 1024 * 1024) formattedSize = (totalBytes / 1024).toFixed(1) + ' KB'
        else if (totalBytes < 1024 * 1024 * 1024) formattedSize = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB'
        else formattedSize = (totalBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'

        // Hiện thông báo lượng rác phát hiện được
        forceBubble(`Phát hiện ${formattedSize} rác!`)
        
        // Chờ 1.5 giây để người dùng đọc thông báo
        await new Promise(resolve => setTimeout(resolve, 1500))

        // B2: Đổi sang mode eating và tiến hành dọn
        setMode('eating')
        forceBubble(null)
        
        // Ensure eating animation shows for at least 3 seconds
        const startTime = Date.now()
        const result = await window.pigAPI.cleanAll()
        const elapsed = Date.now() - startTime
        if (elapsed < 3000) {
          await new Promise(resolve => setTimeout(resolve, 3000 - elapsed))
        }
        
        setIsCleaning(false)

        if (result.trash?.success === false) {
          forceBubble('Heo chưa được cấp quyền full access ⚠️')
          setTimeout(() => setMode('idle'), 4000)
          return
        }

        if (result.freedBytes > 0) {
          triggerEat(result.freedBytes / 1024) // convert to KB
          const newInfo = await window.pigAPI.getTrashInfo()
          setTrashInfo(newInfo)
          const remaining = result.trash?.remainingBytes || 0
          if (remaining > 0) {
            forceBubble(`Còn ${newInfo.sizeFormatted} chưa dọn được, có file đang mở à? 🤔`)
          }
        } else {
          forceBubble('Đã dọn xong!')
          setTimeout(() => setMode('idle'), 1500)
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
    <div className={`pig-wrapper ${isEarthquake ? 'earthquake' : ''}`}>
      {/* Weather visual effects (respects settings toggle) */}
      {weatherSettings.weatherEffects && <WeatherEffects weather={weather} />}
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
        <SettingsPanel onClose={() => {
          setShowSettings(false)
          handleReloadSettings()
        }} />
      )}

      {/* Con Heo Chính */}
      <PigPet
        mode={mode}
        bubble={bubble}
        pigScale={pigScale}
        isPanelOpen={isPanelOpen}
        isCleaning={isCleaning}
        cameraFollowsPig={cameraFollowsPig}
        onDoubleClick={handlePigDoubleClick}
        onWakeUp={() => setMode('idle')}
        weatherData={weatherSettings.weatherAlerts ? weather : null}
      />
    </div>
  )
}
