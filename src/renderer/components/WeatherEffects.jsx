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

// ─── Sprite chim săn mồi (pool mode & foraging) ────────────────────────────
const birdFramesRaw = import.meta.glob('../assets/bird_sprites/bird_fly_*.png', { eager: true, import: 'default' })
const BIRD_FRAMES = Object.keys(birdFramesRaw).sort((a, b) => {
  const numA = parseInt(a.match(/bird_fly_(\d+)\.png/)[1], 10)
  const numB = parseInt(b.match(/bird_fly_(\d+)\.png/)[1], 10)
  return numA - numB
}).map(key => birdFramesRaw[key])

// Frames mới: đi bộ & mổ thóc dưới đất
const birdWalkFramesRaw = import.meta.glob('../assets/bird_walk_aligned/bird_walk_*.png', { eager: true, import: 'default' })
const BIRD_WALK_FRAMES = Object.keys(birdWalkFramesRaw).sort((a, b) => {
  const numA = parseInt(a.match(/bird_walk_(\d+)\.png/)[1], 10)
  const numB = parseInt(b.match(/bird_walk_(\d+)\.png/)[1], 10)
  return numA - numB
}).map(key => birdWalkFramesRaw[key])

const birdPeckFramesRaw = import.meta.glob('../assets/bird_walk_aligned/bird_peck_*.png', { eager: true, import: 'default' })
const BIRD_PECK_FRAMES = Object.keys(birdPeckFramesRaw).sort((a, b) => {
  const numA = parseInt(a.match(/bird_peck_(\d+)\.png/)[1], 10)
  const numB = parseInt(b.match(/bird_peck_(\d+)\.png/)[1], 10)
  return numA - numB
}).map(key => birdPeckFramesRaw[key])

const BIRD_PHASES = {
  swim: { start: 28, end: 30 },
  patrol: { start: 3, end: 7 },
  diving: { start: 6, end: 8 },
  catching: { start: 21, end: 22 },
  rising: { start: 23, end: 27 }
}

const BIRD_GROUND_PHASES = {
  flyaway: { start: 0, end: BIRD_WALK_FRAMES.length - 1 },
  foraging: { start: 0, end: BIRD_PECK_FRAMES.length - 1 },
  scared: { start: 4, end: 6 },
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

function getRandomHue() {
  return Math.floor(Math.random() * 360)
}

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

// Helper function để ghi log an toàn
const safeLog = (message) => {
  if (window.electronAPI && window.electronAPI.logToTerminal) {
    window.electronAPI.logToTerminal(message);
  } else {
    console.log(message);
  }
}

export default function WeatherEffects({ weather, poolMode = false, effectsEnabled = true, cameraFollowsPig = true }) {
  const containerRef = useRef(null)
  const [waterLevel, setWaterLevel] = useState(0)
  const [snowLevel, setSnowLevel] = useState(0)

  const waterLevelRef = useRef(0)
  useEffect(() => { waterLevelRef.current = waterLevel }, [waterLevel])

  const weatherRef = useRef(weather)
  useEffect(() => { weatherRef.current = weather }, [weather])

  const [bird, setBird] = useState(null)
  const nextBirdTimeRef = useRef(0)
  const birdRef = useRef(null)
  const birdStateRef = useRef(null)

  const [fish, setFish] = useState(null)
  const nextFishTimeRef = useRef(0)
  const fishRef = useRef(null)
  const fishSprite = useFishFrame(9)

  useEffect(() => {
    const isHeavyRain = weather?.condition === 'thunderstorm' || poolMode
    const isSnowing = weather?.condition === 'snow'

    const interval = setInterval(() => {
      setWaterLevel(prev => {
        if (isHeavyRain) return Math.min(50, prev + 1.5)
        return Math.max(0, prev - 3)
      })
      setSnowLevel(prev => {
        if (isSnowing) return Math.min(1, prev + 0.1)
        return Math.max(0, prev - 0.2)
      })

      const now = Date.now()

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

      setBird(prev => {
        if (prev) return prev
        if (now < nextBirdTimeRef.current) return null
        const fromLeft = Math.random() < 0.5

        nextBirdTimeRef.current = now + randomBetween(5000, 15000)

        safeLog(`[Bird Spawned] Xuất hiện từ bên ${fromLeft ? 'TRÁI' : 'PHẢI'}`);

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
          targetGrain: false,
          targetWater: false,
          forageUntil: 0,
          nextGrainTime: now + randomBetween(2000, 5000),
          pigletsEaten: [],
          hue: getRandomHue()
        }
        return { id: now, caught: false }
      })

    }, 1000)
    return () => clearInterval(interval)
  }, [weather?.condition, poolMode])

  useEffect(() => {
    if (!fish) return
    const t = setTimeout(() => {
      setFish(prev => (prev && prev.id === fish.id ? null : prev))
    }, fish.caught ? 650 : fish.duration * 1000 + 300)
    return () => clearTimeout(t)
  }, [fish])

  const catchPrey = (currentPrey, setPrey, preyRef, type = 'fish', predatorEl = null) => {
    if (!currentPrey || currentPrey.caught) return;
    const rect = preyRef.current?.getBoundingClientRect();
    if (!rect) return;

    const target = (predatorEl || document.querySelector('.pig-container:not(.pig-follower)'))?.getBoundingClientRect();

    let actuallyCaught = false
    setPrey(prev => {
      if (!prev || prev.caught) return prev
      actuallyCaught = true
      return {
        ...prev,
        caught: true,
        swallowing: false,
        frozenLeft: rect.left,
        frozenTop: rect.top,
        targetLeft: target ? target.left + target.width / 2 : rect.left,
        targetTop: target ? target.top + target.height / 2 : rect.top,
      }
    });

    if (!actuallyCaught) return

    const isPig = !predatorEl || predatorEl.classList.contains('pig-container');
    if (isPig) {
      const freedKB = type === 'bird' ? randomBetween(20, 50) * 1024 : randomBetween(2, 10) * 1024;
      window.dispatchEvent(new CustomEvent('fish-caught', { detail: { freedKB, type } }));

      if (type === 'bird' && birdStateRef.current?.pigletsEaten?.length > 0) {
        window.dispatchEvent(new CustomEvent('rescue-piglets', { detail: { piglets: birdStateRef.current.pigletsEaten } }));
        birdStateRef.current.pigletsEaten = [];
      }
    }
  }

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

  useEffect(() => {
    if (!bird) return
    if (bird.caught) {
      const t = setTimeout(() => setBird(null), 650)
      return () => clearTimeout(t)
    }
  }, [bird?.caught])

  useEffect(() => {
    let rafId
    let lastTime = performance.now()

    const loop = (time) => {
      rafId = requestAnimationFrame(loop)
      const dt = (time - lastTime) / 1000
      lastTime = time
      if (dt > 0.1) return

      const pigEl = document.querySelector('.pig-container:not(.pig-follower)')
      const pigRect = pigEl?.getBoundingClientRect()

      const st = birdStateRef.current
      if (bird && !bird.caught && st && birdRef.current) {

        // [LOG]: Lấy trạng thái hiện tại trước khi xử lý frame
        const previousPhase = st.phase;

        st.frameTimer += dt
        if (st.frameTimer > 1 / 12) {
          st.frameTimer -= 1 / 12

          if (st.phase === 'flyaway' || st.phase === 'foraging' || st.phase === 'scared') {
            const p = BIRD_GROUND_PHASES[st.phase]
            st.frameIdx++
            // SỬA Ở ĐÂY: Cứ chạy lố frame cuối thì quay lại frame đầu, áp dụng cho cả 3 phase
            if (st.frameIdx > p.end) {
              st.frameIdx = p.start
            }
          } else {
            const isHostagePatrol = st.phase === 'patrol' && st.pigletsEaten.length > 0
            const p = isHostagePatrol ? BIRD_PHASES.rising : BIRD_PHASES[st.phase]
            st.frameIdx++
            if (st.frameIdx > p.end) {
              if (isHostagePatrol) {
                st.frameIdx = p.start
              } else if (st.phase === 'diving') {
                st.frameIdx = p.end
              } else if (st.phase === 'catching') {
                st.phase = 'rising'
                st.frameIdx = BIRD_PHASES.rising.start
              } else {
                st.frameIdx = p.start
              }
            }
          }
        }

        // [KIỂM TRA LOGIC]: Cắt logic timeout ở đây để log lại
        if ((st.phase === 'foraging' || st.phase === 'swim') && Date.now() > (st.forageUntil || 0)) {
          safeLog(`[Bird AI] ⚠️ BỘ ĐẾM GIỜ ĐÃ KÍCH HOẠT: Hành động hiện tại là "${st.phase}" đã hết thời gian (forageUntil). ÉP CHUYỂN SANG FLYAWAY!`);
          st.phase = 'flyaway'
          st.frameIdx = BIRD_GROUND_PHASES.flyaway.start
        }

        if (st.phase === 'patrol') {
          if (st.pigletsEaten.length > 0) {
            // ĐANG GIỮ CON TIN
          } else if (fishRef.current && !fish?.caught) {
            const fishRect = fishRef.current.getBoundingClientRect()
            if (Math.abs(st.x - (fishRect.left + fishRect.width / 2)) < 150) {
              st.phase = 'diving'
              st.frameIdx = BIRD_PHASES.diving.start
              st.vy = 400
              st.targetY = window.innerHeight * (1 - (waterLevelRef.current / 2) / 100)
              st.targetGrain = false
              st.targetWater = false
              st.targetPigletId = undefined
              safeLog(`[Bird AI] Bắt đầu lao xuống bắt cá!`);
            }
          } else {
            let targetPigletEl = null
            const followers = document.querySelectorAll('.pig-follower')
            for (const el of followers) {
              const scale = parseFloat(el.getAttribute('data-scale') || '0.4')
              if (scale <= 0.6) {
                const rect = el.getBoundingClientRect()
                if (Math.abs(st.x - (rect.left + rect.width / 2)) < 150) {
                  targetPigletEl = el
                  break
                }
              }
            }

            if (targetPigletEl) {
              st.phase = 'diving'
              st.frameIdx = BIRD_PHASES.diving.start
              st.vy = 400
              if (Math.random() < 0.65) {
                st.targetGrain = false
                st.targetWater = false
                st.targetPigletId = targetPigletEl.getAttribute('data-index')
                safeLog(`[Bird AI] Lao xuống bắt heo con!`);
              } else {
                st.targetPigletId = undefined
                st.targetGrain = true
                st.targetWater = false
                safeLog(`[Bird AI] Bỏ qua heo con, chọn mổ thóc.`);
              }
            } else if (Date.now() > (st.nextGrainTime || 0)) {
              st.phase = 'diving'
              st.frameIdx = BIRD_PHASES.diving.start
              st.vy = 400
              st.targetPigletId = undefined

              if (poolMode && waterLevelRef.current > 0) {
                st.targetY = window.innerHeight - 50 - (waterLevelRef.current / 100) * window.innerHeight
                st.targetWater = true
                st.targetGrain = false
                safeLog(`[Bird AI] Đã đến giờ kiếm ăn: Quyết định ĐÁP XUỐNG MẶT NƯỚC.`);
              } else {
                st.targetY = window.innerHeight - 50
                st.targetGrain = true
                st.targetWater = false
                safeLog(`[Bird AI] Đã đến giờ kiếm ăn: Quyết định ĐÁP XUỐNG ĐẤT mổ thóc.`);
              }

              st.nextGrainTime = Date.now() + randomBetween(4000, 8000)
            }
          }
        } else if (st.phase === 'flyaway') {
          st.vy = -140
          st.vx = (st.fromLeft ? 1 : -1) * randomBetween(80, 120)
          if (st.y < 80) {
            st.vy = 0
            st.phase = 'patrol'
            st.frameIdx = BIRD_PHASES.patrol.start
          }
        } else if (st.phase === 'foraging') {
          st.vy = 0
          st.vx = 0
        } else if (st.phase === 'swim') {
          st.vy = 0
        } else if (st.phase === 'diving') {
          let hitFish = false
          let hitPiglet = false

          if (!st.targetGrain && !st.targetWater && fishRef.current && !fish?.caught) {
            const bRect = birdRef.current.getBoundingClientRect()
            const fRect = fishRef.current.getBoundingClientRect()
            const fCenterX = fRect.left + fRect.width / 2
            const bCenterX = bRect.left + bRect.width / 2
            st.vx = Math.sign(fCenterX - bCenterX || 1) * Math.max(Math.abs(st.vx), 200)
            st.targetY = fRect.top + fRect.height / 2 - bRect.height / 2

            const overlap = !(bRect.right < fRect.left || bRect.left > fRect.right || bRect.bottom < fRect.top || bRect.top > fRect.bottom)
            if (overlap) {
              hitFish = true
              catchPrey(fish, setFish, fishRef, 'fish', birdRef.current)
              st.scale += 0.15
            }
          } else if (st.targetPigletId !== undefined) {
            const followers = document.querySelectorAll('.pig-follower')
            for (const el of followers) {
              if (el.getAttribute('data-index') === st.targetPigletId) {
                const rect = el.getBoundingClientRect()
                const bRect = birdRef.current.getBoundingClientRect()
                const pCenterX = rect.left + rect.width / 2
                const bCenterX = bRect.left + bRect.width / 2
                st.vx = Math.sign(pCenterX - bCenterX || 1) * Math.max(Math.abs(st.vx), 200)
                st.targetY = rect.top + rect.height / 2 - bRect.height / 2

                const overlap = !(bRect.right < rect.left || bRect.left > rect.right || bRect.bottom < rect.top || bRect.top > rect.bottom)
                if (overlap) {
                  hitPiglet = true
                  try {
                    const pigletData = JSON.parse(el.getAttribute('data-piglet'))
                    st.pigletsEaten.push(pigletData)
                  } catch (e) {
                    const pigletScale = parseFloat(el.getAttribute('data-scale') || '0.4')
                    const pigletHue = el.getAttribute('data-hue')
                    st.pigletsEaten.push({ id: Math.random().toString(), scale: pigletScale, hue: pigletHue ? parseInt(pigletHue, 10) : 0, eatenScale: 0 })
                  }

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
            st.vx = Math.sign(st.vx || 1) * randomBetween(150, 200)
            st.fromLeft = st.vx > 0
            st.phase = 'catching'
            st.frameIdx = BIRD_PHASES.catching.start
            safeLog(`[Bird AI] Vừa bắt trúng mồi (Heo/Cá)!`);
          } else if (st.targetGrain && st.y >= st.targetY && poolMode === false) {
            st.y = st.targetY
            st.vy = 0
            st.vx = 0
            st.targetGrain = false
            st.phase = 'foraging'
            st.frameIdx = BIRD_GROUND_PHASES.foraging.start
            st.forageUntil = Date.now() + randomBetween(4000, 8000)
            safeLog(`[Bird AI] Chạm đất -> Chuyển sang MỔ THÓC.`);
          } else if (st.targetWater && st.y >= st.targetY) {
            st.y = st.targetY + 10
            st.vy = 0
            st.vx = (st.fromLeft ? 1 : -1) * randomBetween(30, 60)
            st.targetWater = false
            st.phase = 'swim'
            st.frameIdx = BIRD_PHASES.swim.start
            st.forageUntil = Date.now() + randomBetween(4000, 8000)
            safeLog(`[Bird AI] Chạm mặt nước -> Chuyển sang BƠI (Swim).`);
          } else if (st.y >= st.targetY) {
            st.y = st.targetY
            st.vy = 0
            st.vx *= 0.5
            st.targetPigletId = undefined
            st.phase = 'flyaway'
            st.frameIdx = BIRD_GROUND_PHASES.flyaway.start
            safeLog(`[Bird AI] Bay trượt mục tiêu -> Hủy bỏ, chuẩn bị bay lên (Flyaway).`);
          }
        } else if (st.phase === 'rising' || st.phase === 'scared') {
          st.vy = -150
          if (st.y < 50) {
            st.vy = 0
            st.phase = 'patrol'
            st.frameIdx = st.pigletsEaten.length > 0 ? BIRD_PHASES.rising.start : BIRD_PHASES.patrol.start
          }
        }

        // [LOG CUỐI]: Nếu vòng lặp này thay đổi trạng thái, báo cáo ra terminal
        if (st.phase !== previousPhase) {
          safeLog(`[Bird AI] 🔄 Đổi trạng thái: [${previousPhase}] ---> [${st.phase}]`);
        }

        // Lực gió đẩy
        let windEffectX = 0;
        const wx = weatherRef.current;
        if (wx && wx.windSpeed > 10 && st.phase !== 'diving' && st.phase !== 'foraging' && st.phase !== 'flyaway' && st.phase !== 'swim') {
          windEffectX = wx.windForceX * (wx.windSpeed * 1.5);
        }

        st.x += (st.vx + windEffectX) * dt
        st.y += st.vy * dt

        if ((st.vx > 0 && st.x > window.innerWidth + 200) || (st.vx < 0 && st.x < -200)) {
          safeLog(`[Bird AI] Đã bay khỏi màn hình. Hủy đối tượng chim.`);
          setBird(null)
        } else {
          const frameSet = (st.phase === 'flyaway' || st.phase === 'scared') ? BIRD_WALK_FRAMES
            : st.phase === 'foraging' ? BIRD_PECK_FRAMES
              : BIRD_FRAMES
          birdRef.current.src = frameSet[st.frameIdx] || frameSet[0]
          birdRef.current.style.transform = `translate(${st.x}px, ${st.y}px) scaleX(${st.fromLeft ? 1 : -1}) scale(${st.scale})`
        }

        if (pigRect) {
          const birdRect = birdRef.current.getBoundingClientRect()
          const overlap = !(birdRect.right < pigRect.left || birdRect.left > pigRect.right || birdRect.bottom < pigRect.top || birdRect.top > pigRect.bottom)

          if (overlap) {
            catchPrey(bird, setBird, birdRef, 'bird')
          } else if (st.phase !== 'rising' && st.phase !== 'flyaway' && st.phase !== 'scared' && !bird.caught) {
            const birdCenterX = birdRect.left + birdRect.width / 2;
            const birdCenterY = birdRect.top + birdRect.height / 2;
            const pigCenterX = pigRect.left + pigRect.width / 2;
            const pigCenterY = pigRect.top + pigRect.height / 2;
            const dx = birdCenterX - pigCenterX;
            const dy = birdCenterY - pigCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 140) {
              st.phase = 'scared';
              st.frameIdx = BIRD_GROUND_PHASES.scared.start;
              st.vy = -350;
              st.vx = (dx > 0 ? 1 : -1) * (200 + Math.random() * 100);
              st.fromLeft = st.vx > 0;
              st.targetPigletId = undefined;
              st.targetGrain = false;
              st.targetWater = false;
              safeLog(`[Bird AI] Bị dọa! Heo đến quá gần, bỏ chạy!`);
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

  if (!showRain && !showSnow && !showWind && !showLightning && waterLevel <= 0 && snowLevel <= 0 && !poolMode && !bird) return null

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