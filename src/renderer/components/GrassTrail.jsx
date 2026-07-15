import React, { useState, useEffect, useRef } from 'react'

const GRASS_TYPES = ['🌱', '🌿', '☘️', '🍀']
const SNOW_TYPES = ['❄️', '❄️', '❄️']
const FOOTPRINT_TYPES = ['🐾']

export default function GrassTrail({ x, y, isWalking, trailType = 'grass' }) {
  const [grasses, setGrasses] = useState([])
  const lastSpawnXRef = useRef(x)

  useEffect(() => {
    // Chỉ mọc cỏ/tuyết/dấu chân khi lợn đang đi bộ và ở dưới đất
    if (!isWalking || y < 0) return

    // Khoảng cách giữa các khóm
    const SPAWN_DISTANCE = 35

    if (Math.abs(x - lastSpawnXRef.current) > SPAWN_DISTANCE) {
      lastSpawnXRef.current = x
      
      const types = trailType === 'footprint' ? FOOTPRINT_TYPES : (trailType === 'snow' ? SNOW_TYPES : GRASS_TYPES)
      const newGrass = {
        id: Date.now() + Math.random(),
        x: x + 60, // Căn giữa khoảng x (chiều rộng lợn ~150px)
        type: types[Math.floor(Math.random() * types.length)],
        size: trailType === 'footprint' ? '16px' : (Math.random() > 0.5 ? '20px' : '24px'),
        // Hơi lộn xộn một chút về y
        offsetY: trailType === 'footprint' ? 2 : Math.floor(Math.random() * 5),
      }

      setGrasses(prev => [...prev, newGrass])

      // Tự động xóa khỏi DOM sau 6 giây (phải đồng bộ với CSS animation duration)
      setTimeout(() => {
        setGrasses(prev => prev.filter(g => g.id !== newGrass.id))
      }, 6000)
    }
  }, [x, y, isWalking])

  return (
    <div 
      className="grass-trail"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        pointerEvents: 'none',
        zIndex: trailType === 'footprint' ? 51 : 0 // Hiện trên lớp tuyết
      }}
    >
      {grasses.map(grass => (
        <div 
          key={grass.id}
          style={{
            position: 'absolute',
            bottom: `${grass.offsetY}px`,
            left: `${grass.x}px`,
            fontSize: grass.size,
            animation: 'growAndFade 6s ease-in-out forwards',
            transformOrigin: 'bottom center',
            filter: trailType === 'footprint' 
              ? 'none' 
              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            opacity: trailType === 'footprint' ? 0.6 : 1
          }}
        >
          {grass.type}
        </div>
      ))}
    </div>
  )
}
