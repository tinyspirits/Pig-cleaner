import React, { useState, useEffect, useRef } from 'react'
import { usePigMovement } from '../hooks/usePigMovement'
import SkyClouds from './SkyClouds'
import GrassTrail from './GrassTrail'

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

// ─── Animation configs ────────────────────────────────────────────────────────
// fps: frames per second, frames: array of images, loop: boolean
const ANIMATIONS = {
  idle: { frames: [idle1, idle1, idle1, wink, idle2, idle1, idle3], fps: 3, loop: true },
  walking: { frames: [walk3, walk4, walk5, walk1, walk6, walk2], fps: 10, loop: true },
  sniffing: { frames: [sniff, idle1], fps: 2, loop: true },
  eating: { frames: [happy1, happy2, happy1, happy2], fps: 6, loop: true },
  full: { frames: [happy2, happy1], fps: 2, loop: true },
  sleeping: { frames: [sleep1, sleep2, sleep3, sleep4], fps: 1.5, loop: true },
  scared: { frames: [drag3], fps: 1, loop: true },
  drag_held: { frames: [drag1], fps: 1, loop: false },
  drag_falling: { frames: [drag2], fps: 1, loop: false },
  drag_landed: { frames: [drag3], fps: 1, loop: false },
}

// ─── useSprite hook ───────────────────────────────────────────────────────────
function useSprite(mode) {
  const config = ANIMATIONS[mode] || ANIMATIONS.idle
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

// ─── PigPet ───────────────────────────────────────────────────────────────────

export const PIG_WIDTH = 150
export const PIG_HEIGHT = 150

const isElectron = typeof window !== 'undefined' && window.pigAPI

export default function PigPet({ mode, bubble, pigScale = 1.0, isPanelOpen = false, isCleaning = false, cameraFollowsPig, onDoubleClick, onWakeUp, weatherData = null }) {
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
    dragVelocity
  } = usePigMovement(mode, isPanelOpen, windRef, pigScale, weatherData)

  const handleClick = (e) => {
    // Chỉ ngửi rác khi heo đang ở trên mặt đất (không rơi) và không bị kéo đi
    if (!wasDragged() && !isDragging && position.y >= -10) {
      onDoubleClick?.(e) // Call the same handler, but it's now a single click
    }
  }



  let displayMode = mode
  if (isDragging) {
    displayMode = dragState ? `drag_${dragState}` : 'drag_held'
  } else if (position.y < -5) {
    displayMode = 'drag_falling'
  } else if (dragState === 'landed') {
    displayMode = 'drag_landed'
  } else if (mode === 'eating' || mode === 'sniffing' || mode === 'full' || mode === 'scared') {
    displayMode = mode
  }
  const currentSprite = useSprite(displayMode)

  const screenHeight = window.innerHeight
  const visualY = cameraFollowsPig ? Math.max(-screenHeight * 0.7, position.y) : position.y
  const altitude = cameraFollowsPig ? Math.max(0, -position.y - screenHeight * 0.7) : 0

  // Hiệu ứng thiên thạch: rơi quá nhanh sinh nhiệt (ma sát)
  const isFalling = !isDragging && dragVelocity.y > 10
  const meteoriteHeat = isFalling ? Math.min(1, (dragVelocity.y - 10) / 35) : 0
  const isFallingFast = meteoriteHeat >= 0.4 // Bật CSS tia lửa và class lắc

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

  // Áp dụng filter thiên thạch đè lên nếu đang rơi
  let meteoriteRedness = 0;
  if (meteoriteHeat > 0) {
    if (meteoriteHeat < 0.4) {
      // Vàng dần
      const p = meteoriteHeat / 0.4
      imageFilter = `sepia(${p}) hue-rotate(-10deg) saturate(${1 + p*2}) brightness(${1 + p*0.3}) drop-shadow(0 0 10px rgba(255,200,0,${p}))`
    } else if (meteoriteHeat < 0.7) {
      // Bốc cháy đỏ rực
      const p = (meteoriteHeat - 0.4) / 0.3
      meteoriteRedness = p
      imageFilter = `sepia(1) hue-rotate(${-10 - 30 * p}deg) saturate(${3 + p}) brightness(${1.3 - p*0.3}) drop-shadow(0 0 15px rgba(255,80,0,1))`
    } else {
      // Cháy đen thui
      const p = (meteoriteHeat - 0.7) / 0.3
      meteoriteRedness = 1
      imageFilter = `sepia(${1-p}) brightness(${1 - p}) contrast(${1 + p}) drop-shadow(0 0 ${15 - 15*p}px rgba(255,80,0,${1-p}))`
    }
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

  return (
    <>
      <SkyClouds altitude={altitude} />
      <GrassTrail x={position.x} y={position.y} isWalking={mode === 'walking'} />
      <div
      className={`pig-container pig-${displayMode} ${isWallHit ? 'pig-hit-wall' : ''} ${isFallingFast ? 'pig-meteorite' : ''}`}
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
          Đang ăn rác... 🐽
        </div>
      )}

      {/* ZZZ khi ngủ */}
      {mode === 'sleeping' && !isDragging && !dragState && (
        <div className="zzz-container">
          <div className="zzz z1">z</div>
          <div className="zzz z2">Z</div>
          <div className="zzz z3">Z</div>
        </div>
      )}

      {/* Sprite image */}
      <div style={{
        transform: `scaleX(${facing}) skewX(${dragSkewX}deg) scale(${dragScaleX}, ${dragScaleY})`,
        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Hiệu ứng nẩy khi dừng đột ngột
        transformOrigin: 'bottom center',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <img
            src={currentSprite}
            alt="pig pet"
            className="pig-sprite"
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
