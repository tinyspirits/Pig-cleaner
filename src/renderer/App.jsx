import React, { useState, useEffect } from 'react'
import PigPet from './components/PigPet'
import oinkSound from './assets/oink.mp3'
import quackSound from './assets/quack.mp3'
import StatsPanel from './components/StatsPanel'
import CachePanel from './components/CachePanel'
import SettingsPanel from './components/SettingsPanel'
import WeatherEffects from './components/WeatherEffects'
import { usePigState } from './hooks/usePigState'
import { useWeather } from './hooks/useWeather'
import { useTranslation } from 'react-i18next'

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
  const [isSuspended, setIsSuspended] = useState(false)
  const [weatherSettings, setWeatherSettings] = useState({ weatherEffects: true, weatherAlerts: true, poolMode: false, petType: 'pig', soundEnabled: false })

  const { mode, bubble, pigScale, totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble, explosionEvent, clearExplosionEvent, followers } = usePigState(trashInfo, weatherSettings.petType)
  const isPanelOpen = showStats || showCache || showSettings || permissionWarning
  const weather = useWeather()
  const { t, i18n } = useTranslation()
  const petLabel = t(weatherSettings.petType === 'duck' ? 'settingsPanel.duck' : 'settingsPanel.pig')
  const petEmoji = weatherSettings.petType === 'duck' ? '🦆' : '🐽'

  // Khi đạt 500%, hiện bong bóng ăn mừng lúc "nổ" tách nhỏ
  useEffect(() => {
    if (!explosionEvent) return
    const key = weatherSettings.petType === 'duck' ? 'duck.explode' : 'pig.explode'
    const def = weatherSettings.petType === 'duck'
      ? 'BÙM! Vịt tách thành cả đàn vịt con! 🦆💥'
      : 'BÙM! Heo tách thành cả đàn heo con! 🐷💥'
    forceBubble(t(key, def))
  }, [explosionEvent])

  // Load weather settings khi app khởi động
  useEffect(() => {
    if (isElectron) {
      window.pigAPI.getSettings().then(s => {
        setWeatherSettings({
          weatherEffects: s.weatherEffects !== false,
          weatherAlerts: s.weatherAlerts !== false,
          poolMode: s.poolMode === true,
          petType: s.petType || 'pig',
          soundEnabled: s.soundEnabled === true,
        })
        if (s.language) {
          i18n.changeLanguage(s.language)
        }
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
          poolMode: s.poolMode === true,
          petType: s.petType || 'pig',
          soundEnabled: s.soundEnabled === true,
        })
        if (s.language && s.language !== i18n.language) {
          i18n.changeLanguage(s.language)
        }
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

    if (upcomingCondition === 'thunderstorm' && !isRainingNow) msg = t('weather.stormComing')
    else if (upcomingCondition === 'rain' && !isRainingNow) msg = t('weather.rainComing')
    else if (upcomingCondition === 'drizzle' && !isRainingNow) msg = t('weather.drizzleComing')
    // Thời tiết hiện tại
    else if (windSpeed > 60) msg = t('weather.windStrong')
    else if (windSpeed > 40) msg = t('weather.windBrisk')
    else if (condition === 'thunderstorm') msg = t('weather.thunderstorm')
    else if (condition === 'rain' || condition === 'drizzle') msg = t('weather.rain')
    else if (condition === 'snow') msg = t('weather.snow')
    else if (condition === 'clear' && temperature > 35) msg = t('weather.hotExtreme')
    else if (condition === 'clear' && temperature > 30) msg = t('weather.hot')
    else if (temperature !== null && temperature < 10) msg = t('weather.coldExtreme')
    else if (temperature !== null && temperature < 18) msg = t('weather.cold')

    if (msg) setTimeout(() => forceBubble(msg), 3000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather.condition, weather.upcomingCondition, weatherSettings.weatherAlerts, t])

  // Heo than lạnh thường xuyên hơn khi nhiệt độ <= 0
  useEffect(() => {
    if (!weatherSettings.weatherAlerts || weather.temperature === null || weather.temperature > 0) return
    const messages = [t('weather.coldComplain1'), t('weather.coldComplain2'), t('weather.coldComplain3'), t('weather.coldComplain4')]
    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)]
      forceBubble(randomMsg)
    }, 20000) // 20 giây than 1 lần
    return () => clearInterval(interval)
  }, [weather.temperature, weatherSettings.weatherAlerts, forceBubble])

  // Lắng nghe sự kiện sét đánh từ WeatherEffects
  useEffect(() => {
    if (!weatherSettings.weatherAlerts) return
    const handleLightning = () => {
      setMode('scared')
      forceBubble(t('weather.scared'))
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

  // Bắt được cá trong hồ (pool mode) -> heo/vịt ăn, tăng kích thước nhẹ
  useEffect(() => {
    const handleFishCaught = (e) => {
      const freedKB = e.detail?.freedKB || 5 * 1024
      triggerEat(freedKB)
      forceBubble(t('fish.caught') || '🐟')
    }
    window.addEventListener('fish-caught', handleFishCaught)
    return () => window.removeEventListener('fish-caught', handleFishCaught)
  }, [triggerEat, forceBubble])

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
        forceBubble(t('trash.found', { size: info.sizeFormatted }))
      } else {
        forceBubble(t('trash.clean'))
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
        forceBubble(t('trash.noPermission', { pet: petLabel }))
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
        forceBubble(t('trash.empty', { emoji: petEmoji }))
        setTimeout(() => setMode('idle'), 1500)
      } else if (data.remainingBytes > 0) {
        forceBubble(t('trash.remaining', { size: newInfo.sizeFormatted }))
      }
    })

    // Load trash info ban đầu
    window.pigAPI.getTrashInfo().then(setTrashInfo)

    // Lắng nghe sự kiện Suspend/Resume
    const unsubSuspend = window.pigAPI.onAppSuspend(() => setIsSuspended(true))
    const unsubResume = window.pigAPI.onAppResume(() => setIsSuspended(false))

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
      unsubSuspend?.()
      unsubResume?.()
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

    // Play sound based on petType if enabled
    if (weatherSettings.soundEnabled) {
      try {
        const soundSrc = weatherSettings.petType === 'duck' ? quackSound : oinkSound
        const audio = new Audio(soundSrc)
        audio.play().catch(e => console.log('Audio play failed:', e))
      } catch (e) {
        console.log('Audio error:', e)
      }
    }
    
    if (isElectron) {
      try {
        // B1: Đổi sang mode sniffing để kiểm tra rác
        setMode('sniffing')
        forceBubble(t('trash.sniffing', { emoji: petEmoji }))
        const currentTrash = await window.pigAPI.getTrashInfo()
        const currentCache = await window.pigAPI.getCacheTypes()
        const totalCacheBytes = currentCache.reduce((sum, c) => sum + c.sizeBytes, 0)
        const totalBytes = currentTrash.sizeBytes + totalCacheBytes
        
        if (totalBytes === 0 && currentTrash.fileCount === 0 && totalCacheBytes === 0) {
          forceBubble(t('trash.spotless'))
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
        forceBubble(t('trash.detected', { size: formattedSize }))
        
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
          forceBubble(t('trash.noPermission', { pet: petLabel }))
          setTimeout(() => setMode('idle'), 4000)
          return
        }

        if (result.freedBytes > 0) {
          triggerEat(result.freedBytes / 1024) // convert to KB
        }
        
        const newInfo = await window.pigAPI.getTrashInfo()
        setTrashInfo(newInfo)
        
        const remaining = result.trash?.remainingBytes || 0
        if (result.freedBytes > 0 && remaining > 0) {
          forceBubble(t('trash.remaining', { size: newInfo.sizeFormatted }))
        } else {
          forceBubble(t('trash.done'))
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

  if (isSuspended) return null

  return (
    <div className={`pig-wrapper ${isEarthquake ? 'earthquake' : ''}`}>
      {/* Weather visual effects (respects settings toggle) */}
      {(weatherSettings.weatherEffects || weatherSettings.poolMode) && <WeatherEffects weather={weather} poolMode={weatherSettings.poolMode} effectsEnabled={weatherSettings.weatherEffects} />}
      {/* Stats Panel */}
      {showStats && (
        <StatsPanel
          trashInfo={trashInfo}
          totalEaten={totalEaten}
          pigScale={pigScale}
          petType={weatherSettings.petType}
          weather={weather}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Permission Warning */}
      {permissionWarning && (
        <div className="permission-warning" onClick={() => setPermissionWarning(false)}>
          {t('permissions.warning')}<br />
          <small>{t('permissions.instruction')}</small>
        </div>
      )}

      {/* Cache Panel */}
      {showCache && (
        <CachePanel
          petType={weatherSettings.petType}
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
        poolMode={weatherSettings.poolMode}
        petType={weatherSettings.petType}
        explosionEvent={explosionEvent}
        onExplosionDone={clearExplosionEvent}
        followers={followers}
      />
    </div>
  )
}
