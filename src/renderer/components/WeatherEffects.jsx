import React, { useEffect, useState, useMemo, useRef } from 'react'

// ─── Sprite cá bơi (pool mode) ───────────────────────────────────────────
import fishFrame1 from '../assets/Fish_swim_aligned/Fish1.png'
import fishFrame2 from '../assets/Fish_swim_aligned/Fish2.png'
import fishFrame3 from '../assets/Fish_swim_aligned/Fish3.png'
import fishFrame4 from '../assets/Fish_swim_aligned/Fish4.png'
import fishFrame5 from '../assets/Fish_swim_aligned/Fish5.png'
import fishFrame6 from '../assets/Fish_swim_aligned/Fish6.png'
import fishFrame7 from '../assets/Fish_swim_aligned/Fish7.png'
import fishFrame8 from '../assets/Fish_swim_aligned/Fish8.png'

const FISH_FRAMES = [fishFrame1, fishFrame2, fishFrame3, fishFrame4, fishFrame5, fishFrame6, fishFrame7, fishFrame8]

// Cycling qua 8 frame cá bơi, giống cách PigPet.jsx cycling sprite heo/vịt (useSprite)
function useFishFrame(fps = 9) {
  const [frameIdx, setFrameIdx] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % FISH_FRAMES.length)
    }, 1000 / fps)
    return () => clearInterval(interval)
  }, [fps])
  return FISH_FRAMES[frameIdx]
}

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
export default function WeatherEffects({ weather, poolMode = false, effectsEnabled = true }) {
  const containerRef = useRef(null)
  const [waterLevel, setWaterLevel] = useState(0)
  const [snowLevel, setSnowLevel] = useState(0)
  const waterLevelRef = useRef(0)
  useEffect(() => { waterLevelRef.current = waterLevel }, [waterLevel])

  // ─── Cá bơi ngang qua khi bật pool mode ──────────────────────────────────
  const [fish, setFish] = useState(null)
  const nextFishTimeRef = useRef(0)
  const fishRef = useRef(null)
  const fishSprite = useFishFrame(9)

  useEffect(() => {
    const isHeavyRain = weather?.condition === 'thunderstorm' || poolMode
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

      // Lâu lâu có một con cá bơi ngang qua khi hồ đủ nước — người chơi click để bắt,
      // hoặc kéo heo/vịt chạm vào cá cũng bắt được (xem vòng lặp va chạm bên dưới).
      const now = Date.now()
      setFish(prev => {
        if (prev) return prev // đã có cá đang bơi, chờ nó xong
        if (!poolMode || waterLevelRef.current < 15) return null
        if (now < nextFishTimeRef.current) return null

        const fromLeft = Math.random() < 0.5
        const duration = randomBetween(6, 11)
        const bottomVh = randomBetween(3, Math.max(6, waterLevelRef.current - 4))
        nextFishTimeRef.current = now + duration * 1000 + randomBetween(15000, 40000)
        return { id: now, fromLeft, duration, bottomVh, caught: false }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [weather?.condition, poolMode])

  // Tự thu cá lại: bơi hết quãng đường mà không bị bắt -> biến mất; nếu bị bắt -> biến mất sau hiệu ứng nuốt
  useEffect(() => {
    if (!fish) return
    const t = setTimeout(() => {
      setFish(prev => (prev && prev.id === fish.id ? null : prev))
    }, fish.caught ? 650 : fish.duration * 1000 + 300)
    return () => clearTimeout(t)
  }, [fish])

  // Bắt cá: cá quay đầu bơi ngược lại phía heo/vịt (giống cá lớn nuốt cá bé) rồi biến mất.
  const catchFish = (predatorRect) => {
    setFish(prev => {
      if (!prev || prev.caught) return prev
      const rect = fishRef.current?.getBoundingClientRect()
      if (!rect) return prev
      const target = predatorRect || document.querySelector('.pig-container')?.getBoundingClientRect()
      return {
        ...prev,
        caught: true,
        swallowing: false,
        frozenLeft: rect.left,
        frozenTop: rect.top,
        targetLeft: target ? target.left + target.width / 2 : rect.left,
        targetTop: target ? target.top + target.height / 2 : rect.top,
      }
    })
    // Bắt cá cho heo/vịt ăn -> tăng kích thước nhẹ (tương đương dọn vài MB rác)
    const freedKB = randomBetween(2, 10) * 1024
    window.dispatchEvent(new CustomEvent('fish-caught', { detail: { freedKB } }))
  }

  const handleFishCatch = () => catchFish()

  // Bắt đầu hiệu ứng "bơi ngược vào miệng" ngay sau khi vị trí đóng băng đã render 1 frame,
  // để CSS transition có điểm xuất phát rõ ràng trước khi chạy tới đích.
  useEffect(() => {
    if (!fish || !fish.caught || fish.swallowing) return
    const raf = requestAnimationFrame(() => {
      setFish(prev => (prev && prev.id === fish.id ? { ...prev, swallowing: true } : prev))
    })
    return () => cancelAnimationFrame(raf)
  }, [fish?.caught])

  // Heo/vịt chạm trúng cá là tự nhai nuốt luôn — dù đang đứng yên (cá tự bơi vào miệng)
  // hay đang bị kéo (kéo heo trúng cá), không cần click.
  useEffect(() => {
    if (!fish || fish.caught) return
    let rafId
    const checkCollision = () => {
      if (fishRef.current) {
        const pigEl = document.querySelector('.pig-container')
        const fishRect = fishRef.current.getBoundingClientRect()
        const pigRect = pigEl?.getBoundingClientRect()
        if (pigRect) {
          const overlap = !(
            fishRect.right < pigRect.left ||
            fishRect.left > pigRect.right ||
            fishRect.bottom < pigRect.top ||
            fishRect.top > pigRect.bottom
          )
          if (overlap) {
            catchFish(pigRect)
            return
          }
        }
      }
      rafId = requestAnimationFrame(checkCollision)
    }
    rafId = requestAnimationFrame(checkCollision)
    return () => cancelAnimationFrame(rafId)
  }, [fish])

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

  if (!weather && waterLevel <= 0 && snowLevel <= 0 && !fish) return null

  const { condition, windForceX, windSpeed, isStorm } = weather || {}
  const showRain = effectsEnabled && (condition === 'rain' || condition === 'drizzle' || condition === 'thunderstorm')
  const showSnow = effectsEnabled && condition === 'snow'
  const showWind = effectsEnabled && windSpeed > 25
  const showLightning = effectsEnabled && condition === 'thunderstorm'
  const rainIntensity = condition === 'thunderstorm' ? 1.5 : condition === 'drizzle' ? 0.4 : 1.0

  if (!showRain && !showSnow && !showWind && !showLightning && waterLevel <= 0 && snowLevel <= 0 && !fish) return null

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
      {fish && !fish.caught && (
        <img
          ref={fishRef}
          src={fishSprite}
          onClick={handleFishCatch}
          title="Bắt cá cho heo/vịt ăn"
          draggable={false}
          style={{
            position: 'absolute',
            bottom: `${fish.bottomVh}vh`,
            left: fish.fromLeft ? '-8%' : '108%',
            width: '46px',
            height: 'auto',
            zIndex: 20,
            pointerEvents: 'auto',
            cursor: 'pointer',
            userSelect: 'none',
            transform: fish.fromLeft ? 'scaleX(1)' : 'scaleX(-1)',
            animation: `${fish.fromLeft ? 'fishSwimLTR' : 'fishSwimRTL'} ${fish.duration}s linear forwards`,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
          }}
        />
      )}
      {fish && fish.caught && fish.frozenLeft != null && (
        <img
          src={fishSprite}
          draggable={false}
          style={{
            position: 'fixed',
            left: `${fish.swallowing ? fish.targetLeft : fish.frozenLeft}px`,
            top: `${fish.swallowing ? fish.targetTop : fish.frozenTop}px`,
            width: '46px',
            height: 'auto',
            zIndex: 20,
            pointerEvents: 'none',
            // Quay đầu bơi ngược lại đúng hướng đối lập với lúc đang bơi tới (fromLeft)
            transform: `${fish.fromLeft ? 'scaleX(-1)' : 'scaleX(1)'} scale(${fish.swallowing ? 0.15 : 1})`,
            opacity: fish.swallowing ? 0 : 1,
            transition: 'left 0.45s ease-in, top 0.45s ease-in, transform 0.45s ease-in, opacity 0.45s ease-in 0.15s',
          }}
        />
      )}
    </div>
  )
}
