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

// ─── Sprite chim săn mồi (pool mode) ───────────────────────────────────────
const birdFramesRaw = import.meta.glob('../assets/bird_sprites/bird_fly_*.png', { eager: true, import: 'default' })
const BIRD_FRAMES = Object.keys(birdFramesRaw).sort((a, b) => {
  const numA = parseInt(a.match(/bird_fly_(\d+)\.png/)[1], 10)
  const numB = parseInt(b.match(/bird_fly_(\d+)\.png/)[1], 10)
  return numA - numB
}).map(key => birdFramesRaw[key])

const BIRD_PHASES = {
  patrol: { start: 2, end: 5 },
  diving: { start: 6, end: 8 },
  catching: { start: 21, end: 22 },
  rising: { start: 23, end: 27 }
}

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

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

// Hàm dùng để lấy màu ngẫu nhiên (chỉ dùng nội bộ trong file này)
function getRandomHue() {
  return Math.floor(Math.random() * 360)
}

// ─── Mưa ────────────────────────────────────────────────────────────────────
function RainLayer({ windForceX, intensity = 1 }) {
  const drops = useMemo(() => {
    return Array.from({ length: Math.round(40 * intensity) }, (_, i) => ({
      id: i,
      left: randomBetween(0, 100),
      delay: randomBetween(0, 1.5),
      duration: randomBetween(0.6, 1.2),
      height: randomBetween(15, 30),
      opacity: randomBetween(0.5, 0.9),
    }))
  }, [intensity])

  const skewDeg = windForceX * 30

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
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
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: randomBetween(0, 100),
      delay: randomBetween(0, 4),
      duration: randomBetween(3, 6),
      size: randomBetween(4, 10),
      opacity: randomBetween(0.6, 1),
    }))
  }, [])

  const drift = windForceX * 50

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
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

// ─── Gió mạnh ────────────────────────────────────────────────────────────────
function WindStreaks({ windForceX, windSpeed }) {
  const streaks = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      top: randomBetween(10, 85),
      delay: randomBetween(0, 1),
      duration: randomBetween(0.4, 0.9),
      width: randomBetween(60, 180),
      opacity: randomBetween(0.3, 0.65),
    }))
  }, [])

  const dir = windForceX >= 0 ? 1 : -1

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
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
      window.dispatchEvent(new CustomEvent('lightning-strike'))
      setTimeout(() => setFlashData(null), 150)
      timerRef.current = setTimeout(flash, randomBetween(4000, 15000))
    }
    timerRef.current = setTimeout(flash, randomBetween(1000, 5000))
    return () => clearTimeout(timerRef.current)
  }, [])

  if (!flashData) return null
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(220, 230, 255, 0.4)', pointerEvents: 'none', zIndex: 55, animation: 'lightning-flash 0.15s ease-out' }} />
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

// ─── WeatherEffects (main export) CHỨA CẢ WILDLIFE ───────────────────────────
export default function WeatherEffects({ weather, poolMode = false, effectsEnabled = true, cameraFollowsPig = true }) {
  const containerRef = useRef(null)
  const [waterLevel, setWaterLevel] = useState(0)
  const [snowLevel, setSnowLevel] = useState(0)
  const waterLevelRef = useRef(0)

  useEffect(() => { waterLevelRef.current = waterLevel }, [waterLevel])

  const [bird, setBird] = useState(null)
  const nextBirdTimeRef = useRef(0)
  const birdRef = useRef(null)
  const birdStateRef = useRef(null)

  const [fish, setFish] = useState(null)
  const nextFishTimeRef = useRef(0)
  const fishRef = useRef(null)
  const fishSprite = useFishFrame(9)

  // Xử lý thay đổi mực nước, tuyết và tạo ra Cá/Chim
  useEffect(() => {
    const isHeavyRain = weather?.condition === 'thunderstorm' || poolMode
    const isSnowing = weather?.condition === 'snow'

    const interval = setInterval(() => {
      // Cập nhật nước / tuyết
      setWaterLevel(prev => {
        if (isHeavyRain) return Math.min(50, prev + 1.5)
        return Math.max(0, prev - 3)
      })
      setSnowLevel(prev => {
        if (isSnowing) return Math.min(1, prev + 0.1)
        return Math.max(0, prev - 0.2)
      })

      const now = Date.now()

      // Tạo cá
      setFish(prev => {
        if (prev) return prev
        if (!poolMode || waterLevelRef.current < 15) return null
        if (now < nextFishTimeRef.current) return null

        const fromLeft = Math.random() < 0.5
        const duration = randomBetween(6, 11)
        const bottomVh = randomBetween(3, Math.max(6, waterLevelRef.current - 4))
        nextFishTimeRef.current = now + duration * 1000 + randomBetween(15000, 40000)

        return { id: now, fromLeft, duration, bottomVh, caught: false, hue: getRandomHue() }
      })

      // Tạo chim
      setBird(prev => {
        if (prev) return prev
        if (!poolMode) return null
        if (now < nextBirdTimeRef.current) return null
        const fromLeft = Math.random() < 0.5
        nextBirdTimeRef.current = now + randomBetween(15000, 35000)

        birdStateRef.current = {
          x: fromLeft ? -150 : window.innerWidth + 150,
          y: randomBetween(80, 180),
          vx: (fromLeft ? 1 : -1) * randomBetween(150, 220),
          vy: 0,
          phase: 'patrol',
          fromLeft,
          scale: 1.0,
          frameIdx: BIRD_PHASES.patrol.start,
          frameTimer: 0,
          pigletsEaten: [],
          hue: getRandomHue()
        }
        return { id: now, caught: false }
      })

    }, 1000)
    return () => clearInterval(interval)
  }, [weather?.condition, poolMode])

  // Thu dọn cá
  useEffect(() => {
    if (!fish) return
    const t = setTimeout(() => {
      setFish(prev => (prev && prev.id === fish.id ? null : prev))
    }, fish.caught ? 650 : fish.duration * 1000 + 300)
    return () => clearTimeout(t)
  }, [fish])

  // Hàm xử lý chung khi bị nuốt
  const catchPrey = (currentPrey, setPrey, preyRef, type = 'fish') => {
    if (!currentPrey || currentPrey.caught) return;
    const rect = preyRef.current?.getBoundingClientRect();
    if (!rect) return;

    const target = document.querySelector('.pig-container')?.getBoundingClientRect();

    setPrey({
      ...currentPrey,
      caught: true,
      swallowing: false,
      frozenLeft: rect.left,
      frozenTop: rect.top,
      targetLeft: target ? target.left + target.width / 2 : rect.left,
      targetTop: target ? target.top + target.height / 2 : rect.top,
    });

    const freedKB = type === 'bird' ? randomBetween(20, 50) * 1024 : randomBetween(2, 10) * 1024;
    window.dispatchEvent(new CustomEvent('fish-caught', { detail: { freedKB } }));

    if (type === 'bird' && birdStateRef.current?.pigletsEaten?.length > 0) {
      window.dispatchEvent(new CustomEvent('rescue-piglets', { detail: { piglets: birdStateRef.current.pigletsEaten } }));
      birdStateRef.current.pigletsEaten = [];
    }
  }

  // Bật animation nuốt
  useEffect(() => {
    if (!fish || !fish.caught || fish.swallowing) return
    const raf = requestAnimationFrame(() => setFish(prev => (prev && prev.id === fish.id ? { ...prev, swallowing: true } : prev)))
    return () => cancelAnimationFrame(raf)
  }, [fish?.caught])

  useEffect(() => {
    if (!bird || !bird.caught || bird.swallowing) return
    const raf = requestAnimationFrame(() => setBird(prev => (prev && prev.id === bird.id ? { ...prev, swallowing: true } : prev)))
    return () => cancelAnimationFrame(raf)
  }, [bird?.caught])

  // Thu dọn chim
  useEffect(() => {
    if (!bird) return
    if (bird.caught) {
      const t = setTimeout(() => setBird(null), 650)
      return () => clearTimeout(t)
    }
  }, [bird?.caught])

  // Vòng lặp vật lý và AI của Chim/Cá
  useEffect(() => {
    let rafId
    let lastTime = performance.now()

    const loop = (time) => {
      rafId = requestAnimationFrame(loop)
      const dt = (time - lastTime) / 1000
      lastTime = time
      if (dt > 0.1) return

      const pigEl = document.querySelector('.pig-container')
      const pigRect = pigEl?.getBoundingClientRect()

      const st = birdStateRef.current
      if (bird && !bird.caught && st && birdRef.current) {
        st.frameTimer += dt
        if (st.frameTimer > 1 / 12) {
          st.frameTimer -= 1 / 12
          const p = BIRD_PHASES[st.phase]
          st.frameIdx++
          if (st.frameIdx > p.end) {
            if (st.phase === 'diving') st.frameIdx = p.end
            else if (st.phase === 'catching') {
              st.phase = 'rising'
              st.frameIdx = BIRD_PHASES.rising.start
            } else {
              st.frameIdx = p.start
            }
          }
        }

        if (st.phase === 'patrol') {
          if (fishRef.current && !fish?.caught) {
            const fishRect = fishRef.current.getBoundingClientRect()
            if (Math.abs(st.x - (fishRect.left + fishRect.width / 2)) < 150) {
              st.phase = 'diving'
              st.frameIdx = BIRD_PHASES.diving.start
              st.vy = 400
              st.targetY = window.innerHeight * (1 - (waterLevelRef.current / 2) / 100)
            }
          } else {
            const followers = document.querySelectorAll('.pig-follower')
            for (const el of followers) {
              const scale = parseFloat(el.getAttribute('data-scale') || '0.4')
              if (scale <= 0.6) {
                const rect = el.getBoundingClientRect()
                if (Math.abs(st.x - (rect.left + rect.width / 2)) < 150) {
                  st.phase = 'diving'
                  st.frameIdx = BIRD_PHASES.diving.start
                  st.vy = 400
                  st.targetY = window.innerHeight - 50
                  st.targetPigletId = el.getAttribute('data-index')
                  break
                }
              }
            }
          }
        } else if (st.phase === 'diving') {
          let hitFish = false
          let hitPiglet = false

          if (fishRef.current && !fish?.caught) {
            const bRect = birdRef.current.getBoundingClientRect()
            const fRect = fishRef.current.getBoundingClientRect()
            const overlap = !(bRect.right < fRect.left || bRect.left > fRect.right || bRect.bottom < fRect.top || bRect.top > fRect.bottom)
            if (overlap) {
              hitFish = true
              catchPrey(fish, setFish, fishRef, 'fish')
              st.scale += 0.15
            }
          } else if (st.targetPigletId !== undefined) {
            const followers = document.querySelectorAll('.pig-follower')
            for (const el of followers) {
              if (el.getAttribute('data-index') === st.targetPigletId) {
                const rect = el.getBoundingClientRect()
                const bRect = birdRef.current.getBoundingClientRect()
                const overlap = !(bRect.right < rect.left || bRect.left > rect.right || bRect.bottom < rect.top || bRect.top > rect.bottom)
                if (overlap) {
                  hitPiglet = true
                  const pigletScale = parseFloat(el.getAttribute('data-scale') || '0.4')
                  const pigletHue = el.getAttribute('data-hue')
                  st.pigletsEaten.push({ id: Math.random().toString(), scale: pigletScale, hue: pigletHue ? parseInt(pigletHue, 10) : 0 })

                  window.dispatchEvent(new CustomEvent('bird-caught-follower', { detail: { index: parseInt(st.targetPigletId) } }))
                  st.scale += 0.15
                  st.targetPigletId = undefined
                }
                break
              }
            }
          }

          if (hitFish || hitPiglet) {
            st.vy = 0
            st.vx *= 0.5
            st.phase = 'catching'
            st.frameIdx = BIRD_PHASES.catching.start
          } else if (st.y >= st.targetY) {
            st.y = st.targetY
            st.vy = 0
            st.vx *= 0.5
            st.phase = 'rising'
            st.frameIdx = BIRD_PHASES.rising.start
          }
        } else if (st.phase === 'rising') {
          st.vy = -150
          if (st.y < 50) {
            st.vy = 0
            st.phase = 'patrol'
            st.frameIdx = BIRD_PHASES.patrol.start
          }
        }

        st.x += st.vx * dt
        st.y += st.vy * dt

        if ((st.vx > 0 && st.x > window.innerWidth + 200) || (st.vx < 0 && st.x < -200)) {
          setBird(null)
        } else {
          birdRef.current.src = BIRD_FRAMES[st.frameIdx]
          birdRef.current.style.transform = `translate(${st.x}px, ${st.y}px) scaleX(${st.fromLeft ? 1 : -1}) scale(${st.scale})`
        }

        if (pigRect) {
          const birdRect = birdRef.current.getBoundingClientRect()
          const overlap = !(birdRect.right < pigRect.left || birdRect.left > pigRect.right || birdRect.bottom < pigRect.top || birdRect.top > pigRect.bottom)

          if (overlap) {
            catchPrey(bird, setBird, birdRef, 'bird')
          } else if (st.phase !== 'rising' && !bird.caught) {
            const birdCenterX = birdRect.left + birdRect.width / 2;
            const birdCenterY = birdRect.top + birdRect.height / 2;
            const pigCenterX = pigRect.left + pigRect.width / 2;
            const pigCenterY = pigRect.top + pigRect.height / 2;
            const dx = birdCenterX - pigCenterX;
            const dy = birdCenterY - pigCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 220) {
              st.phase = 'rising';
              st.frameIdx = BIRD_PHASES.rising.start;
              st.vy = -350;
              st.vx = (dx > 0 ? 1 : -1) * (200 + Math.random() * 100);
              st.fromLeft = st.vx > 0;
              st.targetPigletId = undefined;
            }
          }
        }
      }

      if (fish && !fish.caught && fishRef.current) {
        if (pigRect) {
          const fishRect = fishRef.current.getBoundingClientRect()
          const overlap = !(fishRect.right < pigRect.left || fishRect.left > pigRect.right || fishRect.bottom < pigRect.top || fishRect.top > pigRect.bottom)
          if (overlap) {
            catchPrey(fish, setFish, fishRef, 'fish')
          }
        }
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [bird, fish])

  // Camera chạy theo heo
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current) return
      const { isFlying, vy, y } = e.detail || {}

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
        if (Math.abs(anim.playbackRate - rate) > 0.05) anim.playbackRate = rate
      }

      if (cameraFollowsPig) {
        const altitude = Math.max(0, -(y || 0) - window.innerHeight * 0.7)
        containerRef.current.style.transform = `translateY(${altitude}px)`
      } else {
        containerRef.current.style.transform = `translateY(0px)`
      }
    }
    window.addEventListener('pig-flying', handler)
    return () => window.removeEventListener('pig-flying', handler)
  }, [cameraFollowsPig])

  if (!weather && waterLevel <= 0 && snowLevel <= 0 && !poolMode) return null

  const { condition, windForceX, windSpeed } = weather || {}
  const showRain = effectsEnabled && (condition === 'rain' || condition === 'drizzle' || condition === 'thunderstorm')
  const showSnow = effectsEnabled && condition === 'snow'
  const showWind = effectsEnabled && windSpeed > 25
  const showLightning = effectsEnabled && condition === 'thunderstorm'
  const rainIntensity = condition === 'thunderstorm' ? 1.5 : condition === 'drizzle' ? 0.4 : 1.0

  if (!showRain && !showSnow && !showWind && !showLightning && waterLevel <= 0 && snowLevel <= 0 && !poolMode) return null

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {waterLevel > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${waterLevel}vh`, backgroundColor: '#0ea5e9',
          opacity: 0.1, transition: 'height 1s linear', zIndex: 10
        }} />
      )}

      {snowLevel > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${snowLevel}vh`, backgroundColor: '#ffffff',
          opacity: 0.9, transition: 'height 1s linear', zIndex: 10,
          boxShadow: '0 -2px 10px rgba(255,255,255,0.8)'
        }} />
      )}

      {showRain && <RainLayer windForceX={windForceX} intensity={Math.min(rainIntensity, 1)} />}
      {showSnow && <SnowLayer windForceX={windForceX} />}
      {showWind && <WindStreaks windForceX={windForceX} windSpeed={windSpeed} />}
      {showLightning && <LightningFlash />}

      {/* ─── CÁ ĐANG BƠI ─── */}
      {fish && !fish.caught && (
        <img
          ref={fishRef}
          src={fishSprite}
          title="Cá"
          draggable={false}
          style={{
            position: 'absolute',
            bottom: `${fish.bottomVh}vh`,
            left: fish.fromLeft ? '-8%' : '108%',
            width: '46px',
            height: 'auto',
            zIndex: 20,
            pointerEvents: 'none',
            userSelect: 'none',
            transform: fish.fromLeft ? 'scaleX(1)' : 'scaleX(-1)',
            animation: `${fish.fromLeft ? 'fishSwimLTR' : 'fishSwimRTL'} ${fish.duration}s linear forwards`,
            filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.3)) hue-rotate(${fish.hue}deg)`,
          }}
        />
      )}

      {/* ─── CÁ BỊ NUỐT ─── */}
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
            transform: `${fish.fromLeft ? 'scaleX(-1)' : 'scaleX(1)'} scale(${fish.swallowing ? 0.15 : 1})`,
            opacity: fish.swallowing ? 0 : 1,
            transition: 'left 0.45s ease-in, top 0.45s ease-in, transform 0.45s ease-in, opacity 0.45s ease-in 0.15s',
            filter: `hue-rotate(${fish.hue}deg)`,
          }}
        />
      )}

      {/* ─── CHIM ĐANG BAY ─── */}
      {bird && !bird.caught && (
        <img
          ref={birdRef}
          title="Chim"
          draggable={false}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '64px',
            height: 'auto',
            zIndex: 21,
            pointerEvents: 'none',
            userSelect: 'none',
            filter: `drop-shadow(0 4px 6px rgba(0,0,0,0.3)) hue-rotate(${birdStateRef.current?.hue}deg)`
          }}
        />
      )}

      {/* ─── CHIM BỊ NUỐT ─── */}
      {bird && bird.caught && bird.frozenLeft != null && (
        <img
          src={BIRD_FRAMES[BIRD_PHASES.patrol.start]}
          draggable={false}
          style={{
            position: 'fixed',
            left: `${bird.swallowing ? bird.targetLeft : bird.frozenLeft}px`,
            top: `${bird.swallowing ? bird.targetTop : bird.frozenTop}px`,
            width: '64px',
            height: 'auto',
            zIndex: 21,
            pointerEvents: 'none',
            transform: `${birdStateRef.current?.fromLeft ? 'scaleX(-1)' : 'scaleX(1)'} scale(${bird.swallowing ? 0.15 : birdStateRef.current?.scale || 1})`,
            opacity: bird.swallowing ? 0 : 1,
            transition: 'left 0.45s ease-in, top 0.45s ease-in, transform 0.45s ease-in, opacity 0.45s ease-in 0.15s',
            filter: `hue-rotate(${birdStateRef.current?.hue}deg)`
          }}
        />
      )}
    </div>
  )
}