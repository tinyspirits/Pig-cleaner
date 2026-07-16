import React, { useEffect, useState } from 'react'
import idlePig from '../assets/sprites/idle.png'

const duckModules = import.meta.glob('../assets/duck_sprites/*.png', { eager: true, import: 'default' })
const idleDuck = duckModules['../assets/duck_sprites/duck_1.png']

const PARTICLE_COUNT = 8
const DURATION_MS = 2200

// Hiệu ứng "nổ bùm" khi heo/vịt đạt 500% kích thước: tách thành nhiều con
// nhỏ bắn ra xung quanh rồi rơi xuống và biến mất, trong lúc con chính đã
// quay về kích thước gốc (xử lý ở usePigState). Component này được đặt bởi
// component cha ngay tại vị trí hiện tại của heo/vịt (position: absolute,
// relative tới điểm 0,0 của chính nó) — không tự tính toạ độ màn hình.
export default function ExplosionBurst({ petType = 'pig', onDone }) {
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
      const distance = 60 + Math.random() * 90
      return {
        id: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 40, // bắn lên trên một chút trước khi rơi
        rotation: (Math.random() - 0.5) * 360,
        delay: Math.random() * 120,
        scale: 0.35 + Math.random() * 0.2,
      }
    })
  )

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), DURATION_MS + 150)
    return () => clearTimeout(timer)
  }, [onDone])

  const sprite = petType === 'duck' ? idleDuck : idlePig

  return (
    <div style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, zIndex: 5, pointerEvents: 'none' }}>
      {particles.map(p => (
        <img
          key={p.id}
          src={sprite}
          alt=""
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 150,
            height: 100,
            transform: 'translate(-50%, 0) scale(1)',
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--rot': `${p.rotation}deg`,
            '--start-scale': p.scale,
            animation: `pig-burst-scatter ${DURATION_MS}ms ease-out ${p.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  )
}
