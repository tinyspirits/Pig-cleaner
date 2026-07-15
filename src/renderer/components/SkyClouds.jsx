import React from 'react'

export default function SkyClouds({ altitude }) {
  if (altitude <= 0) return null

  // Tạo các đám mây tĩnh với vị trí cố định, nhưng sẽ trượt xuống dựa trên altitude
  // Dùng seed cố định hoặc vị trí fix sẵn để mây không bị nhảy khi re-render
  const clouds = [
    { id: 1, x: '10%', y: 200, size: '40px', opacity: 0.6 },
    { id: 2, x: '70%', y: 500, size: '60px', opacity: 0.4 },
    { id: 3, x: '40%', y: 800, size: '50px', opacity: 0.5 },
    { id: 4, x: '85%', y: 1200, size: '70px', opacity: 0.3 },
    { id: 5, x: '20%', y: 1600, size: '45px', opacity: 0.5 },
    { id: 6, x: '60%', y: 2000, size: '55px', opacity: 0.6 },
    { id: 7, x: '15%', y: 2500, size: '65px', opacity: 0.4 },
    { id: 8, x: '80%', y: 2900, size: '40px', opacity: 0.5 },
    { id: 9, x: '35%', y: 3400, size: '75px', opacity: 0.3 },
    { id: 10, x: '65%', y: 3800, size: '50px', opacity: 0.6 },
  ]

  // Các vì sao (chỉ mọc ở độ cao lớn, y > 1500)
  // Tốc độ trôi của sao sẽ chậm hơn mây (parallax)
  const stars = [
    { id: 1, x: '5%', y: 1800, size: '20px', type: '✨', opacity: 0.8 },
    { id: 2, x: '80%', y: 2200, size: '15px', type: '🌟', opacity: 0.7 },
    { id: 3, x: '25%', y: 2600, size: '25px', type: '💫', opacity: 0.9 },
    { id: 4, x: '90%', y: 3000, size: '18px', type: '✨', opacity: 0.6 },
    { id: 5, x: '45%', y: 3500, size: '20px', type: '✨', opacity: 0.8 },
    { id: 6, x: '10%', y: 4000, size: '22px', type: '🌟', opacity: 0.9 },
    { id: 7, x: '75%', y: 4500, size: '20px', type: '✨', opacity: 0.7 },
    { id: 8, x: '30%', y: 5000, size: '24px', type: '🌟', opacity: 0.8 },
    { id: 9, x: '85%', y: 5500, size: '25px', type: '💫', opacity: 0.9 },
    { id: 10, x: '50%', y: 6000, size: '35px', type: '🌟', opacity: 0.8 },
    { id: 11, x: '15%', y: 6500, size: '28px', type: '✨', opacity: 0.9 },
    { id: 12, x: '65%', y: 7000, size: '30px', type: '🌟', opacity: 1.0 },
  ]

  // Tốc độ trôi của mây (parallax)
  // Mây sẽ trôi xuống khi altitude tăng lên (nghĩa là heo bay lên)
  const cloudScrollSpeed = 0.8
  const starScrollSpeed = 0.4 // Sao ở xa nên trôi chậm hơn

  // Tính toán độ mờ của dải ngân hà dựa trên độ cao
  const milkyWayOpacity1 = Math.min(0.8, Math.max(0, (altitude - 10000) / 5000))
  const milkyWayOpacity2 = Math.min(0.7, Math.max(0, (altitude - 12500) / 2500))

  // Mây chỉ tồn tại ở bầu khí quyển, mờ dần ở 5000 và biến mất hoàn toàn ở 8000
  const cloudGlobalOpacity = Math.min(1, Math.max(0, 1 - (altitude - 5000) / 3000))

  return (
    <div 
      className="sky-clouds" 
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1, // Đằng sau heo nhưng trên một số thứ khác
      }}
    >
      {/* Simulated Milky Way 1 (Purple/Pink Glow) */}
      <div
        style={{
          position: 'absolute',
          left: '-30%',
          bottom: 3000 - (altitude * starScrollSpeed * 0.8),
          width: '160%',
          height: '1200px',
          background: 'radial-gradient(ellipse at center, rgba(138, 43, 226, 0.25) 0%, rgba(75, 0, 130, 0.1) 40%, transparent 70%)',
          transform: 'rotate(-25deg)',
          opacity: milkyWayOpacity1,
          filter: 'blur(40px)',
          transition: 'bottom 0.1s linear',
        }}
      />
      
      {/* Simulated Milky Way 2 (Blue/Cyan Glow) */}
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          bottom: 4500 - (altitude * starScrollSpeed * 0.7),
          width: '140%',
          height: '1000px',
          background: 'radial-gradient(ellipse at center, rgba(0, 191, 255, 0.2) 0%, rgba(0, 0, 139, 0.1) 50%, transparent 70%)',
          transform: 'rotate(-15deg)',
          opacity: milkyWayOpacity2,
          filter: 'blur(50px)',
          transition: 'bottom 0.1s linear',
        }}
      />

      {clouds.map(cloud => {
        // Vị trí thực tế trên màn hình = Vị trí ban đầu + khoảng cách trượt từ altitude
        // Tính theo hệ tọa độ từ bottom lên (giống heo)
        const rawY = cloud.y - (altitude * cloudScrollSpeed)
        // Loop vô hạn từ -1000 đến 8000
        const currentY = ((rawY % 9000) + 9000) % 9000 - 1000
        
        return (
          <div 
            key={`cloud-${cloud.id}`}
            style={{
              position: 'absolute',
              left: cloud.x,
              bottom: currentY,
              fontSize: cloud.size,
              opacity: cloud.opacity * cloudGlobalOpacity,
              transition: 'bottom 0.1s linear, opacity 0.1s linear', // mượt mà
              filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.8))'
            }}
          >
            ☁️
          </div>
        )
      })}

      {stars.map(star => {
        const rawY = star.y - (altitude * starScrollSpeed)
        const currentY = ((rawY % 9000) + 9000) % 9000 - 1000
        
        return (
          <div 
            key={`star-${star.id}`}
            style={{
              position: 'absolute',
              left: star.x,
              bottom: currentY,
              fontSize: star.size,
              opacity: star.opacity,
              transition: 'bottom 0.1s linear',
              filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.9))'
            }}
          >
            {star.type}
          </div>
        )
      })}
    </div>
  )
}
