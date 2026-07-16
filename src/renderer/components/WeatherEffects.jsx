import React, { useEffect, useState, useMemo, useRef } from 'react'

// Số lượng hạt tối đa — giữ thấp để không lag
const MAX_RAIN = 40
const MAX_SNOW = 25
const MAX_WIND_STREAKS = 8

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

// ─── Mưa ────────────────────────────────────────────────────────────────────
function RainLayer({ windForceX, intensity = 1 }) {
  const drops = useMemo(() => {
    return Array.from({ length: Math.round(MAX_RAIN * intensity) }, (_, i) => ({
      id: i,
      left: randomBetween(0, 100),    // %
      delay: randomBetween(0, 1.5),   // s
      duration: randomBetween(0.6, 1.2), // s
      height: randomBetween(15, 30),  // px
      opacity: randomBetween(0.5, 0.9),
    }))
  }, [intensity])

  // Gió lệch hạt mưa: windForceX ∈ [-1, 1] → skew ±30deg
  const skewDeg = windForceX * 30

  return (
    <div style={{
      position: 'fixed', inset: 0,
      pointerEvents: 'none', zIndex: 50,
      overflow: 'hidden',
    }}>
      {drops.map(d => (
        <div key={d.id} style={{
          position: 'absolute',
          left: `${d.left}%`,
          top: '-40px',
          width: '2px',
          height: `${d.height}px`,
          background: 'linear-gradient(transparent, rgba(180, 210, 255, 0.8))',
          borderRadius: '1px',
          transform: `skewX(${skewDeg}deg)`,
          opacity: d.opacity,
          animation: `rain-fall ${d.duration}s ${d.delay}s linear infinite`,
        }} />
      ))}
    </div>
  )
}

// ─── Tuyết ───────────────────────────────────────────────────────────────────
function SnowLayer({ windForceX }) {
  const flakes = useMemo(() => {
    return Array.from({ length: MAX_SNOW }, (_, i) => ({
      id: i,
      left: randomBetween(0, 100),
      delay: randomBetween(0, 4),
      duration: randomBetween(3, 6),
      size: randomBetween(4, 10),
      opacity: randomBetween(0.6, 1),
    }))
  }, [])

  const drift = windForceX * 50 // px ngang thêm khi rơi

  return (
    <div style={{
      position: 'fixed', inset: 0,
      pointerEvents: 'none', zIndex: 50,
      overflow: 'hidden',
    }}>
      {flakes.map(f => (
        <div key={f.id} style={{
          position: 'absolute',
          left: `${f.left}%`,
          top: '-20px',
          width: `${f.size}px`,
          height: `${f.size}px`,
          borderRadius: '50%',
          background: 'rgba(220, 235, 255, 0.95)',
          boxShadow: '0 0 4px rgba(180,210,255,0.8)',
          opacity: f.opacity,
          animation: `snow-fall ${f.duration}s ${f.delay}s linear infinite`,
          '--drift': `${drift}px`,
        }} />
      ))}
    </div>
  )
}

// ─── Gió mạnh (dải gió ngang) ────────────────────────────────────────────────
function WindStreaks({ windForceX, windSpeed }) {
  const streaks = useMemo(() => {
    return Array.from({ length: MAX_WIND_STREAKS }, (_, i) => ({
      id: i,
      top: randomBetween(10, 85),     // % vh
      delay: randomBetween(0, 1),
      duration: randomBetween(0.4, 0.9),
      width: randomBetween(60, 180),  // px
      opacity: randomBetween(0.3, 0.65),
    }))
  }, [])

  // Gió thổi trái → dải bay sang phải, ngược lại → từ phải sang trái
  const dir = windForceX >= 0 ? 1 : -1

  return (
    <div style={{
      position: 'fixed', inset: 0,
      pointerEvents: 'none', zIndex: 50,
      overflow: 'hidden',
    }}>
      {streaks.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          top: `${s.top}vh`,
          left: dir > 0 ? '-200px' : 'auto',
          right: dir < 0 ? '-200px' : 'auto',
          width: `${s.width}px`,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          opacity: s.opacity,
          borderRadius: '1px',
          animation: `wind-streak-${dir > 0 ? 'right' : 'left'} ${s.duration}s ${s.delay}s linear infinite`,
        }} />
      ))}
    </div>
  )
}

// ─── Chớp sét ────────────────────────────────────────────────────────────────
function LightningFlash() {
  const [flashData, setFlashData] = useState(null)

  const timerRef = useRef(null)

  useEffect(() => {
    function flash() {
      setFlashData({
        left: randomBetween(10, 90),
        scale: randomBetween(0.7, 1.3),
        flip: Math.random() > 0.5 ? 1 : -1,
      })
      
      // Báo cho heo biết có sét đánh
      window.dispatchEvent(new CustomEvent('lightning-strike'))
      
      setTimeout(() => setFlashData(null), 150)
      // Flash lại ngẫu nhiên sau 4-15 giây
      timerRef.current = setTimeout(flash, randomBetween(4000, 15000))
    }
    timerRef.current = setTimeout(flash, randomBetween(1000, 5000))
    return () => clearTimeout(timerRef.current)
  }, [])

  if (!flashData) return null
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(220, 230, 255, 0.4)',
        pointerEvents: 'none', zIndex: 55,
        animation: 'lightning-flash 0.15s ease-out',
      }} />
      <div style={{
        position: 'fixed',
        top: 0,
        left: `${flashData.left}%`,
        transform: `translateX(-50%) scaleX(${flashData.flip}) scale(${flashData.scale})`,
        transformOrigin: 'top center',
        pointerEvents: 'none', zIndex: 56,
        animation: 'lightning-flash 0.15s ease-out',
      }}>
        <svg width="80" height="300" viewBox="0 0 120 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M70 0L0 200H50L30 400L120 150H60L90 0H70Z" fill="#FFF" filter="drop-shadow(0 0 20px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 40px rgba(180, 210, 255, 0.8))" />
        </svg>
      </div>
    </>
  )
}

// ─── WeatherEffects (main export) ────────────────────────────────────────────
export default function WeatherEffects({ weather, floodMode = false, effectsEnabled = true }) {
  const containerRef = useRef(null)
  const [waterLevel, setWaterLevel] = useState(0)
  const [snowLevel, setSnowLevel] = useState(0)

  useEffect(() => {
    const isHeavyRain = weather?.condition === 'thunderstorm' || floodMode
    const interval = setInterval(() => {
      setWaterLevel(prev => {
        if (isHeavyRain) {
          // Ngập dần, max 50%
          return Math.min(50, prev + 1.5)
        } else {
          // Rút dần
          return Math.max(0, prev - 3)
        }
      })
      
      const isSnowing = weather?.condition === 'snow'
      setSnowLevel(prev => {
        if (isSnowing) {
          // Tuyết dày dần, max 1%
          return Math.min(1, prev + 0.1)
        } else {
          // Tan dần
          return Math.max(0, prev - 0.2)
        }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [weather?.condition, floodMode])

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current) return
      
      const { isFlying, vy } = e.detail || {}
      let rate = 1
      if (isFlying && typeof vy === 'number') {
        rate = Math.max(0.05, Math.min(5.0, 1 - vy / 15))
      }

      const anims = containerRef.current.getAnimations({ subtree: true })
      for (const anim of anims) {
        if (anim.animationName && anim.animationName.includes('wind-streak')) {
          if (Math.abs(anim.playbackRate - 1) > 0.05) anim.playbackRate = 1
          continue
        }
        if (Math.abs(anim.playbackRate - rate) > 0.05) {
          anim.playbackRate = rate
        }
      }
    }
    window.addEventListener('pig-flying', handler)
    return () => window.removeEventListener('pig-flying', handler)
  }, [])

  if (!weather && waterLevel <= 0 && snowLevel <= 0) return null

  const { condition, windForceX, windSpeed, isStorm } = weather || {}
  const showRain = effectsEnabled && (condition === 'rain' || condition === 'drizzle' || condition === 'thunderstorm')
  const showSnow = effectsEnabled && condition === 'snow'
  const showWind = effectsEnabled && windSpeed > 25
  const showLightning = effectsEnabled && condition === 'thunderstorm'
  const rainIntensity = condition === 'thunderstorm' ? 1.5 : condition === 'drizzle' ? 0.4 : 1.0

  if (!showRain && !showSnow && !showWind && !showLightning && waterLevel <= 0 && snowLevel <= 0) return null

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {waterLevel > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${waterLevel}vh`,
          backgroundColor: '#0ea5e9',
          opacity: 0.1,
          transition: 'height 1s linear',
          zIndex: 10
        }} />
      )}
      {snowLevel > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${snowLevel}vh`,
          backgroundColor: '#ffffff',
          opacity: 0.9,
          transition: 'height 1s linear',
          zIndex: 10,
          boxShadow: '0 -2px 10px rgba(255,255,255,0.8)'
        }} />
      )}
      {showRain && <RainLayer windForceX={windForceX} intensity={Math.min(rainIntensity, 1)} />}
      {showSnow && <SnowLayer windForceX={windForceX} />}
      {showWind && <WindStreaks windForceX={windForceX} windSpeed={windSpeed} />}
      {showLightning && <LightningFlash />}
    </div>
  )
}
