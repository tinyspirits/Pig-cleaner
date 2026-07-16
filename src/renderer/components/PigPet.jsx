import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePigMovement } from '../hooks/usePigMovement'
import SkyClouds from './SkyClouds'
import GrassTrail from './GrassTrail'
import ExplosionBurst from './ExplosionBurst'

// ─── Sprite imports ───────────────────────────────────────────────────────────
import idle1 from '../assets/sprites/idle.png'
import idle2 from '../assets/sprites/idle2.png'
import idle3 from '../assets/sprites/idle3.png'
import wink from '../assets/sprites/wink.png'
import walk1 from '../assets/sprites/walk1.png'
import walk2 from '../assets/sprites/walk2.png'
import walk3 from '../assets/sprites/walk3.png'
import walk4 from '../assets/sprites/walk4.png'
import walk5 from '../assets/sprites/walk5.png'
import walk6 from '../assets/sprites/walk6.png'
import sniff from '../assets/sprites/sniff.png'
import happy1 from '../assets/sprites/happy.png'
import happy2 from '../assets/sprites/happy2.png'
import sleep1 from '../assets/sprites/sleep1.png'
import sleep2 from '../assets/sprites/sleep2.png'
import sleep3 from '../assets/sprites/sleep3.png'
import sleep4 from '../assets/sprites/sleep4.png'
import drag1 from '../assets/sprites/drag1.png'
import drag2 from '../assets/sprites/drag2.png'
import drag3 from '../assets/sprites/drag3.png'
// Dive frames (kỹ năng lặn sau khi tỉnh)
import diveBottom1 from '../assets/sprites/dive_bottom1.png'
import diveBottom2 from '../assets/sprites/dive_bottom2.png'
import diveBottom3 from '../assets/sprites/dive_bottom3.png'
import diveBottom4 from '../assets/sprites/dive_bottom4.png'
import diveBottom5 from '../assets/sprites/dive_bottom5.png'
import diveDown1 from '../assets/sprites/dive_down1.png'
import diveDown2 from '../assets/sprites/dive_down2.png'
import diveDown3 from '../assets/sprites/dive_down3.png'
import diveUp from '../assets/sprites/dive_up.png'
import diveFloat from '../assets/sprites/dive_float.png'

// Drowning frames
import drown1 from '../assets/sprites/drown1.png'
import drown2 from '../assets/sprites/drown2.png'
import drown3 from '../assets/sprites/drown3.png'
import drown4 from '../assets/sprites/drown4.png'
import drown5 from '../assets/sprites/drown5.png'
import struggle1 from '../assets/sprites/struggle1.png'
import struggle2 from '../assets/sprites/struggle2.png'
import struggle3 from '../assets/sprites/struggle3.png'

// ─── Animation configs ────────────────────────────────────────────────────────
// fps: frames per second, frames: array of images, loop: boolean
const ANIMATIONS = {
  idle: { frames: [idle1, idle1, idle1, wink, idle2, idle1, idle3], fps: 3, loop: true },
  walking: { frames: [walk1, walk5, walk6, walk3, walk1, walk5, walk6, walk3], fps: 10, loop: true },
  sniffing: { frames: [sniff, idle1], fps: 2, loop: true },
  eating: { frames: [happy1, happy2, happy1, happy2], fps: 6, loop: true },
  full: { frames: [happy2, happy1], fps: 2, loop: true },
  sleeping: { frames: [sleep1, sleep2, sleep3, sleep4], fps: 1.5, loop: true },
  scared: { frames: [drag3], fps: 1, loop: true },
  drag_held: { frames: [drag1], fps: 1, loop: false },
  drag_falling: { frames: [drag2], fps: 1, loop: false },
  drag_landed: { frames: [drag3], fps: 1, loop: false },
  diving_float: { frames: [diveFloat], fps: 1, loop: true }, // Nổi lơ lửng, không di chuyển
  diving_down: { frames: [diveDown1, diveDown2, diveDown3], fps: 6, loop: true }, // Đang lặn xuống
  diving_up: { frames: [diveUp], fps: 1, loop: true }, // Đang ngoi lên
  diving_bottom: { frames: [diveBottom1, diveBottom2, diveBottom3, diveBottom2, diveBottom4, diveBottom5], fps: 8, loop: true }, // Bơi dưới đáy nước
  drowning: { frames: [drown1, drown2, drown3, drown4, drown5], fps: 6, loop: true },
  drowning_sink: { frames: [struggle2], fps: 1, loop: false },
  drowning_bottom: { frames: [sleep1, sleep2, sleep3, sleep4], fps: 1.5, loop: true },
  struggling: { frames: [struggle1, struggle2, struggle3], fps: 6, loop: true },
}

// ─── Duck Animations ────────────────────────────────────────────────────────
const duckModules = import.meta.glob('../assets/duck_sprites/*.png', { eager: true, import: 'default' })
const getDuck = (n) => duckModules[`../assets/duck_sprites/duck_${n}.png`]

const DUCK_ANIMATIONS = {
  idle: { frames: [getDuck(1), getDuck(2), getDuck(1)], fps: 2, loop: true },
  walking: { frames: [getDuck(5), getDuck(6), getDuck(7), getDuck(8), getDuck(9)], fps: 10, loop: true },
  sniffing: { frames: [getDuck(1), getDuck(3)], fps: 2, loop: true },
  eating: { frames: [getDuck(10), getDuck(11), getDuck(10), getDuck(11)], fps: 6, loop: true },
  full: { frames: [getDuck(11), getDuck(1)], fps: 2, loop: true },
  sleeping: { frames: [getDuck(13), getDuck(14), getDuck(15)], fps: 1.5, loop: true },
  scared: { frames: [getDuck(18)], fps: 1, loop: true },
  drag_held: { frames: [getDuck(16)], fps: 1, loop: false },
  drag_falling: { frames: [getDuck(17)], fps: 1, loop: false },
  drag_landed: { frames: [getDuck(18)], fps: 1, loop: false },
  diving_float: { frames: [getDuck(25)], fps: 1, loop: true },
  diving_down: { frames: [getDuck(26), getDuck(27), getDuck(28)], fps: 6, loop: true },
  diving_up: { frames: [getDuck(29)], fps: 1, loop: true },
  diving_bottom: { frames: [getDuck(30), getDuck(31), getDuck(32)], fps: 6, loop: true },
  drowning: { frames: [getDuck(19), getDuck(20), getDuck(21)], fps: 6, loop: true },
  drowning_sink: { frames: [getDuck(22)], fps: 1, loop: false },
  drowning_bottom: { frames: [getDuck(24)], fps: 1, loop: false },
  struggling: { frames: [getDuck(19), getDuck(20), getDuck(21)], fps: 6, loop: true },
}

// ─── useSprite hook ───────────────────────────────────────────────────────────
function useSprite(mode, petType = 'pig') {
  const anims = petType === 'duck' ? DUCK_ANIMATIONS : ANIMATIONS
  const config = anims[mode] || anims.idle
  const [frameIdx, setFrameIdx] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    setFrameIdx(0) // reset khi đổi mode
    const interval = 1000 / config.fps

    timerRef.current = setInterval(() => {
      setFrameIdx(prev => {
        const next = prev + 1
        if (next >= config.frames.length) {
          return config.loop ? 0 : config.frames.length - 1
        }
        return next
      })
    }, interval)

    return () => clearInterval(timerRef.current)
  }, [mode, config.fps, config.frames.length, config.loop])

  return config.frames[frameIdx] ?? config.frames[0]
}

// ─── ColdBreath hook & component ────────────────────────────────────────────────
function ColdBreath() {
  const [breaths, setBreaths] = useState([])

  useEffect(() => {
    let timer
    const spawn = () => {
      const id = Date.now() + Math.random()
      setBreaths(prev => [...prev, id])
      setTimeout(() => setBreaths(prev => prev.filter(b => b !== id)), 2500)
      timer = setTimeout(spawn, 2500 + Math.random() * 2000)
    }
    timer = setTimeout(spawn, 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ position: 'absolute', right: '35px', top: '50px', pointerEvents: 'none' }}>
      {breaths.map(id => (
        <div key={id} className="cold-breath-puff" />
      ))}
    </div>
  )
}

// ─── PigPet ───────────────────────────────────────────────────────────────────

export const PIG_WIDTH = 150
export const PIG_HEIGHT = 150

// Mảng lưu lịch sử trạng thái của heo mẹ để heo con theo sau
const HISTORY_SIZE = 400
let historyBuffer = []

function FollowerPet({ index, scale }) {
  const frameOffset = (index + 1) * 12 // Giảm nhẹ độ trễ để không bị tuột lại quá xa khi cộng thêm offset
  const currentOffsetX = React.useRef(0)

  if (historyBuffer.length <= frameOffset) return null

  const state = historyBuffer[historyBuffer.length - 1 - frameOffset]

  // Tính toán vị trí "sau đít": ngược hướng heo mẹ đang quay mặt
  // Khoảng cách mỗi bé heo con là 35px
  const distance = (index + 1) * 35
  const targetOffsetX = -state.facing * distance

  // Dùng lerp (nội suy) để heo con trượt mượt mà sang bên kia đít khi mẹ quay đầu, tránh bị giật cục (teleport)
  currentOffsetX.current += (targetOffsetX - currentOffsetX.current) * 0.08

  const containerStyle = {
    transform: `translate(${state.x + currentOffsetX.current}px, ${state.y}px) scale(${scale})`,
    transformOrigin: 'bottom center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    pointerEvents: 'none', // Heo con không tương tác chuột
    zIndex: 9, // Nằm sau heo mẹ (z-index heo mẹ = 10)
  }

  return (
    <div
      className={`pig-container pig-${state.displayMode} ${state.isWallHit ? 'pig-hit-wall' : ''} ${state.isFallingFast ? 'pig-meteorite' : ''} ${state.isShivering ? 'pig-shivering' : ''}`}
      style={containerStyle}
    >
      <div style={{
        transform: `scaleX(${state.facing}) skewX(${state.dragSkewX}deg) scale(${state.dragScaleX}, ${state.dragScaleY})`,
        transformOrigin: 'bottom center',
        display: 'flex',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <img
          src={state.sprite}
          alt="piglet"
          className={`pig-sprite ${state.displayMode === 'diving_float' ? 'breathing' : ''}`}
          style={{
            filter: state.imageFilter,
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  )
}

export default function PigPet({ mode, bubble, pigScale = 1.0, isPanelOpen = false, isCleaning = false, cameraFollowsPig, onDoubleClick, onWakeUp, weatherData = null, floodMode = false, petType = 'pig', explosionEvent = null, onExplosionDone, followers = [] }) {
  const { t } = useTranslation()
  const windRef = useRef(null)

  const {
    position,
    facing,
    isDragging,
    dragState,
    handleMouseEnter,
    handleMouseLeave,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    wasDragged,
    isWallHit,
    dragVelocity,
    swimAction,
    isAboveWater,
    paleLevel,
    isSpaceFrozen
  } = usePigMovement(mode, isPanelOpen, windRef, pigScale, weatherData, floodMode)

  const handleClick = (e) => {
    // Cho phép ngửi/ăn rác nếu không bị kéo đi và (đang trên đất hoặc đang bơi)
    if (!wasDragged() && !isDragging) {
      if (position.y >= -10 || swimAction !== 'none') {
        onDoubleClick?.(e) // Call the same handler, but it's now a single click
      }
    }
  }



  let displayMode = mode
  if (isSpaceFrozen) {
    displayMode = 'drag_falling' // Nhắm mắt, người cứng đơ
  } else if (mode === 'eating') {
    displayMode = 'eating'
  } else if (isDragging) {
    displayMode = dragState ? `drag_${dragState}` : 'drag_held'
  } else if (isAboveWater) {
    displayMode = 'drag_falling'
  } else if (swimAction !== 'none') {
    if (swimAction === 'struggling') {
      displayMode = 'struggling'
    } else if (swimAction === 'surface') {
      displayMode = 'diving_float'
    } else if (swimAction === 'diving') {
      displayMode = 'diving_down'
    } else if (swimAction === 'rising') {
      displayMode = 'diving_up'
    } else if (swimAction === 'bottom') {
      if (Math.abs(dragVelocity.x) > 0.5 || Math.abs(dragVelocity.y) > 0.5) {
        displayMode = 'diving_bottom'
      } else {
        displayMode = mode === 'walking' ? 'idle' : mode
      }
    } else if (swimAction === 'drowning_sink' || swimAction === 'drowning_bottom') {
      displayMode = swimAction
    }
  } else if (dragState === 'landed') {
    displayMode = 'drag_landed'
  } else if (mode === 'eating' || mode === 'sniffing' || mode === 'full' || mode === 'scared') {
    displayMode = mode
  }
  const currentSprite = useSprite(displayMode, petType)

  const screenHeight = window.innerHeight
  const visualY = cameraFollowsPig ? Math.max(-screenHeight * 0.7, position.y) : position.y
  const altitude = cameraFollowsPig ? Math.max(0, -position.y - screenHeight * 0.7) : 0
  const freezeLevel = Math.min(1, Math.max(0, (altitude - 12500) / 2500))
  // Hiệu ứng thiên thạch: rơi quá nhanh sinh nhiệt (ma sát)
  const isFalling = !isDragging && dragVelocity.y > 10
  const meteoriteHeat = isFalling ? Math.min(1, (dragVelocity.y - 30) / 120) : 0
  const isFallingFast = meteoriteHeat >= 0.4 // Bật CSS tia lửa và class lắc

  const [isCharred, setIsCharred] = useState(false)
  useEffect(() => {
    if (meteoriteHeat >= 0.7) {
      setIsCharred(true)
    } else if (isCharred) {
      if (isDragging) {
        setIsCharred(false) // Xoá ngay nếu bị tóm lại
      } else if (position.y >= -1) {
        // Chạm đất thì giữ đen 2 giây rồi mới hết
        const timer = setTimeout(() => {
          setIsCharred(false)
        }, 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [meteoriteHeat, isCharred, isDragging, position.y])

  // Hiệu ứng thiếu oxy: chuyển sang màu đỏ khi bay lên quá mây (altitude > 1500)
  const redness = Math.min(1, Math.max(0, (altitude - 1500) / 2000))

  // Hiệu ứng nhiệt độ thời tiết
  const temp = weatherData?.temperature ?? null
  const heatLevel = temp !== null && temp > 26 ? Math.min(1, (temp - 26) / 14) : 0
  const coldLevel = temp !== null && temp < 22 ? Math.min(1, (22 - temp) / 14) : 0

  // Cảm giác ướt do mưa/bão
  const [wetness, setWetness] = useState(0)
  const conditionStr = weatherData?.condition?.toLowerCase() || ''
  const isWetWeather = conditionStr.includes('mưa') || conditionStr.includes('bão') || conditionStr.includes('rain') || conditionStr.includes('drizzle') || conditionStr.includes('thunderstorm')

  useEffect(() => {
    const isSunny = conditionStr.includes('nắng') || conditionStr.includes('quang đãng') || conditionStr.includes('clear') || conditionStr.includes('sun')
    const isCloudy = conditionStr.includes('mây') || conditionStr.includes('âm u') || conditionStr.includes('cloud') || conditionStr.includes('overcast')

    const dryRate = isSunny ? 0.05 : (isCloudy ? 0.0125 : 0.025)

    const interval = setInterval(() => {
      setWetness(prev => {
        if (isWetWeather) return Math.min(1, prev + 0.05)
        return Math.max(0, prev - dryRate)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isWetWeather, conditionStr])

  // Tính filter bình thường
  const totalRed = Math.min(1, redness + heatLevel)
  const totalCold = Math.min(1, coldLevel + wetness * 0.6)

  let baseFilter = ''
  if (totalCold > totalRed) {
    baseFilter = `drop-shadow(0 4px 10px rgba(100, 150, 255, 0.4)) saturate(${1 - totalCold * 0.4}) hue-rotate(${30 * totalCold}deg) brightness(${1 - totalCold * 0.15})`
  } else if (totalRed > 0) {
    baseFilter = `drop-shadow(0 4px 10px rgba(255, 100, 50, 0.3)) sepia(${totalRed * 0.6}) hue-rotate(${-40 * totalRed}deg) saturate(${1 + 2 * totalRed}) contrast(${1 + 0.2 * totalRed})`
  } else {
    baseFilter = `drop-shadow(0 4px 10px rgba(0, 0, 0, 0.25))`
  }

  let imageFilter = baseFilter + (wetness > 0 ? ` contrast(${1 + 0.15 * wetness}) brightness(${1 - 0.1 * wetness}) sepia(${0.2 * wetness}) hue-rotate(${190 * wetness}deg)` : '')

  // Áp dụng filter thiên thạch đè lên nếu đang rơi hoặc đang bị cháy đen
  let meteoriteRedness = 0;
  if (isSpaceFrozen) {
    // Bị đóng băng ngoài vũ trụ
    imageFilter = `drop-shadow(0 0 25px rgba(0,255,255,0.8)) hue-rotate(180deg) saturate(0.5) brightness(1.5) contrast(1.2)`
  } else if (isCharred) {
    // Cháy đen thui còn 2 con mắt trắng
    meteoriteRedness = 1
    imageFilter = `invert(1) grayscale(1) contrast(5) brightness(0.6) drop-shadow(0 0 4px rgba(0,0,0,1))`
  } else if (meteoriteHeat > 0) {
    if (meteoriteHeat < 0.4) {
      // Vàng dần
      const p = meteoriteHeat / 0.4
      imageFilter = `sepia(${p}) hue-rotate(-10deg) saturate(${1 + p * 2}) brightness(${1 + p * 0.3}) drop-shadow(0 0 10px rgba(255,200,0,${p}))`
    } else {
      // Bốc cháy đỏ rực
      const p = (meteoriteHeat - 0.4) / 0.3
      meteoriteRedness = p
      imageFilter = `sepia(1) hue-rotate(${-10 - 30 * p}deg) saturate(${3 + p}) brightness(${1.3 - p * 0.3}) drop-shadow(0 0 15px rgba(255,80,0,1))`
    }
  } else if (temp !== null && temp <= 0) {
    // Da đổi màu xanh lạnh (cold skin) khi nhiệt độ <= 0
    imageFilter = `drop-shadow(0 0 15px rgba(150, 220, 255, 0.6)) hue-rotate(-90deg) saturate(1.2) brightness(1.1) contrast(1.1)`
  }

  if (paleLevel > 0 && !isCharred && meteoriteHeat === 0) {
    imageFilter += ` saturate(${1 - paleLevel}) brightness(${1 + paleLevel * 0.4}) hue-rotate(${paleLevel * 180}deg)`
  }

  const safeX = isNaN(position.x) ? 0 : position.x
  const safeY = isNaN(visualY) ? 0 : visualY
  const safeScale = isNaN(pigScale) ? 1.0 : pigScale

  const speedX = Math.abs(dragVelocity.x)
  const speedY = Math.abs(dragVelocity.y)

  // Tính độ co giãn
  const stretchX = 1 + Math.min(0.4, speedX / 100)
  const stretchY = 1 + Math.min(0.4, speedY / 100)
  const squashX = 1 - Math.min(0.2, speedY / 100)
  const squashY = 1 - Math.min(0.2, speedX / 100)

  const dragScaleX = stretchX * squashX
  const dragScaleY = stretchY * squashY
  const dragSkewX = -Math.min(25, Math.max(-25, dragVelocity.x / 3)) // Nghiêng ngược hướng kéo

  const containerStyle = {
    transform: `translate(${safeX}px, ${safeY}px) scale(${safeScale})`,
    transformOrigin: 'bottom center',
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const [splashes, setSplashes] = useState([])
  useEffect(() => {
    const handleSplash = (e) => {
      const vy = e.detail?.vy || 0
      const id = Date.now() + Math.random()
      setSplashes(prev => [...prev, { id, vy }])
      setTimeout(() => {
        setSplashes(prev => prev.filter(s => s.id !== id))
      }, 600)
    }
    window.addEventListener('water-splash', handleSplash)
    return () => window.removeEventListener('water-splash', handleSplash)
  }, [])

  const isShivering = temp !== null && temp <= 10;

  let trailType = 'grass'
  if (conditionStr.includes('snow')) {
    trailType = 'footprint'
  } else if (temp !== null && temp < 0) {
    trailType = 'snow'
  }

  useEffect(() => {
    historyBuffer.push({
      x: safeX,
      y: safeY,
      facing,
      sprite: currentSprite,
      displayMode,
      isWallHit,
      isFallingFast,
      isShivering,
      dragScaleX,
      dragScaleY,
      dragSkewX,
      imageFilter
    })
    if (historyBuffer.length > HISTORY_SIZE) {
      historyBuffer.shift()
    }
  })

  return (
    <>
      <SkyClouds altitude={altitude} />
      <GrassTrail x={position.x} y={position.y} isWalking={mode === 'walking'} trailType={trailType} />

      {/* Render follower piglets */}
      {followers.length > 0 && followers.map((f, i) => (
        <FollowerPet key={f.id} index={i} scale={f.scale} />
      ))}

      {explosionEvent && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, transform: `translate(${safeX}px, ${safeY}px)`, pointerEvents: 'none' }}>
          <ExplosionBurst petType={petType} onDone={onExplosionDone} />
        </div>
      )}
      <div
        className={`pig-container pig-${displayMode} ${isWallHit ? 'pig-hit-wall' : ''} ${isFallingFast ? 'pig-meteorite' : ''} ${isShivering ? 'pig-shivering' : ''}`}
        style={containerStyle}
        onMouseUp={handleDragEnd}
      >
        <div ref={windRef} className="wind-lines">
          <div className="wind-line" style={{ left: '-30px', animationDelay: '0s' }} />
          <div className="wind-line" style={{ left: '-15px', animationDelay: '0.1s', height: '80px' }} />
          <div className="wind-line" style={{ right: '-30px', animationDelay: '0.15s' }} />
          <div className="wind-line" style={{ right: '-15px', animationDelay: '0.05s', height: '60px' }} />
        </div>
        {isFallingFast && (
          <div className="meteorite-sparks" style={{ opacity: meteoriteRedness }}>
            <div className="spark s1"></div>
            <div className="spark s2"></div>
            <div className="spark s3"></div>
            <div className="spark s4"></div>
            <div className="spark s5"></div>
            <div className="spark s6"></div>
          </div>
        )}
        {meteoriteHeat >= 0.7 && (
          <div className="meteorite-fireball"></div>
        )}
        {['diving', 'bottom', 'rising', 'drowning_sink', 'drowning_bottom'].includes(swimAction) && !isAboveWater && (
          <div className="water-bubbles" style={swimAction === 'rising' ? { top: '30%', left: '50%' } : {}}>
            <div className="water-bubble" style={{ left: '10px', animationDelay: '0s' }}></div>
            <div className="water-bubble" style={{ left: '30px', animationDelay: '0.2s', width: '15px', height: '15px' }}></div>
            <div className="water-bubble" style={{ left: '20px', animationDelay: '0.6s', width: '8px', height: '8px' }}></div>
            <div className="water-bubble" style={{ left: '40px', animationDelay: '0.9s' }}></div>
            <div className="water-bubble" style={{ left: '15px', animationDelay: '1.2s', width: '12px', height: '12px' }}></div>
          </div>
        )}
        {/* Speech Bubble */}
        {bubble && (
          <div className="speech-bubble">
            {bubble}
          </div>
        )}

        {/* Cleaning indicator */}
        {(isCleaning && mode === 'eating') && (
          <div style={{
            position: 'absolute',
            top: -30,
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
            whiteSpace: 'nowrap'
          }}>
            {t(petType === 'duck' ? 'duck.cleaning' : 'pig.cleaning', 'Eating trash... 🐽')}
          </div>
        )}

        {/* ZZZ khi ngủ */}
        {(displayMode === 'sleeping' || displayMode === 'drowning_bottom') && !isDragging && !dragState && (
          <div className="zzz-container">
            <div className="zzz z1">z</div>
            <div className="zzz z2">Z</div>
            <div className="zzz z3">Z</div>
          </div>
        )}

        {/* Water Splashes */}
        {splashes.map(({ id, vy }) => {
          const isBigSplash = vy > 10;
          const dropCount = isBigSplash ? 8 : 3;
          const scatterX = isBigSplash ? 150 : 50;
          const scatterY = isBigSplash ? 80 : 20;
          const baseHeight = isBigSplash ? 30 : 10;

          return (
            <div key={id} className="water-splash-effect">
              {[...Array(dropCount)].map((_, i) => (
                <div
                  key={i}
                  className="water-splash-drop"
                  style={{
                    '--tx': `${(Math.random() - 0.5) * scatterX}px`,
                    '--ty': `${-baseHeight - Math.random() * scatterY}px`,
                    left: `${50 + (Math.random() - 0.5) * (isBigSplash ? 40 : 20)}%`,
                    transform: isBigSplash ? 'scale(1)' : 'scale(0.6)'
                  }}
                />
              ))}
            </div>
          );
        })}

        {/* Sprite image */}
        <div style={{
          transform: `scaleX(${facing}) skewX(${dragSkewX}deg) scale(${dragScaleX}, ${dragScaleY})`,
          transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Hiệu ứng nẩy khi dừng đột ngột
          transformOrigin: 'bottom center',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {temp !== null && temp <= 0 && !isDragging && <ColdBreath />}
          <img
            src={currentSprite}
            alt="pig pet"
            className={`pig-sprite ${displayMode === 'diving_float' ? 'breathing' : ''}`}
            draggable="false"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => {
              if (mode === 'sleeping') onWakeUp?.()
              handleDragStart(e)
            }}
            onClick={handleClick}
            style={{
              objectFit: 'contain',
              imageRendering: 'pixelated',
              filter: imageFilter,
              cursor: isDragging ? 'grabbing' : 'grab',
              pointerEvents: 'auto',
            }}
          />
        </div>
      </div>
    </>
  )
}
