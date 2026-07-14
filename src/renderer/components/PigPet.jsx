import React, { useState, useEffect, useRef } from 'react'
import { usePigMovement } from '../hooks/usePigMovement'

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
export default function PigPet({ mode, bubble, pigScale = 1.0, isPanelOpen = false, isCleaning = false, onDoubleClick }) {
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
    wasDragged
  } = usePigMovement(mode, isPanelOpen)

  const handleClick = (e) => {
    if (!wasDragged()) {
      onDoubleClick?.(e) // Call the same handler, but it's now a single click
    }
  }

  const displayMode = dragState ? `drag_${dragState}` : mode
  const currentSprite = useSprite(displayMode)

  const containerStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${pigScale}) scaleX(${facing})`,
    transition: isDragging ? 'none' : 'transform 0.05s linear', // Fast transition for smooth walking
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      className={`pig-container pig-${mode}`}
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleDragStart}
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
      onClick={handleClick}
      title="Nhấn vào heo để dọn rác!"
    >
      {/* Speech Bubble */}
      {bubble && (
        <div className="speech-bubble" style={{ transform: `scaleX(${facing})` }}>
          {bubble}
        </div>
      )}

      {/* Cleaning indicator */}
      {isCleaning && (
        <div style={{
          position: 'absolute',
          top: -30,
          left: '50%',
          transform: `translateX(-50%) scaleX(${facing})`,
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
      {mode === 'sleeping' && (
        <div className="zzz" style={{ transform: `scaleX(${facing})` }}>z z z</div>
      )}

      {/* Sprite image */}
      <img
        className={`pig-sprite pig-sprite--${mode} ${isDragging ? 'dragging' : ''}`}
        src={currentSprite}
        alt={`pig ${mode}`}
        draggable={false}
      />
    </div>
  )
}
