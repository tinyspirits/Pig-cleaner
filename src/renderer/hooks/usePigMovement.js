import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.pigAPI

export function usePigMovement(mode, isPanelOpen = false, windRef = null, pigScale = 1.0, weatherData = null) {
  // position.y = 0 means on the floor (bottom of screen). Negative y means in the air.
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [screenSize, setScreenSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [facing, setFacing] = useState(1) // 1 = right, -1 = left
  
  const [dragState, setDragState] = useState(null)
  const [dragVelocity, setDragVelocity] = useState({ x: 0, y: 0 })
  const [isWallHit, setIsWallHit] = useState(false)
  const [isStruggling, setIsStruggling] = useState(false)
  const [isSinking, setIsSinking] = useState(false)
  
  const dragStateRef = useRef(null)
  const wallHitTimeoutRef = useRef(null)
  const landedTimeoutRef = useRef(null)
  const pigScaleRef = useRef(pigScale)
  const weatherRef = useRef(weatherData)
  const floodLevelRef = useRef(0)
  const currentFloorRef = useRef(0)
  const drowningTimerRef = useRef(null)
  const isSinkingRef = useRef(false)
  
  // Cập nhật refs mỗi khi props thay đổi
  useEffect(() => { pigScaleRef.current = pigScale }, [pigScale])
  useEffect(() => { weatherRef.current = weatherData }, [weatherData])

  // Mô phỏng mực nước (giống hệt WeatherEffects)
  useEffect(() => {
    const interval = setInterval(() => {
      const isHeavyRain = weatherRef.current?.condition === 'thunderstorm'
      let currentFlood = floodLevelRef.current
      if (isHeavyRain) {
        currentFlood = Math.min(100, currentFlood + 1.5)
      } else {
        currentFlood = Math.max(0, currentFlood - 3)
      }
      floodLevelRef.current = currentFlood

      // Vùng vẫy và chìm
      if (currentFlood >= 100) {
        if (!drowningTimerRef.current && !isSinkingRef.current) {
          setIsStruggling(true)
          drowningTimerRef.current = setTimeout(() => {
            setIsStruggling(false)
            setIsSinking(true)
            isSinkingRef.current = true
          }, 10000)
        }
      } else {
        if (drowningTimerRef.current) {
          clearTimeout(drowningTimerRef.current)
          drowningTimerRef.current = null
        }
        if (currentFlood === 0 && isSinkingRef.current) {
          setIsStruggling(false)
          setIsSinking(false)
          isSinkingRef.current = false
        }
      }
    }, 1000)
    return () => {
      clearInterval(interval)
      if (drowningTimerRef.current) clearTimeout(drowningTimerRef.current)
    }
  }, [])

  const updateDragState = useCallback((newState) => {
    let resolvedState = typeof newState === 'function' ? newState(dragStateRef.current) : newState
    dragStateRef.current = resolvedState
    setDragState(resolvedState)
  }, [])

  const stateRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    isMouseDown: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 }
  })
  
  const dragHistoryRef = useRef([])

  // Khởi tạo kích thước màn hình
  useEffect(() => {
    async function init() {
      let width, height;
      if (isElectron) {
        const size = await window.pigAPI.getScreenSize()
        width = size.width
        height = size.height
      } else {
        width = window.innerWidth
        height = window.innerHeight
      }
      setScreenSize({ width, height })
      
      // Khởi tạo vị trí heo ở giữa màn hình
      const startX = Math.floor(width / 2 - 75)
      stateRef.current.x = startX
      setPosition({ x: startX, y: 0 })
    }
    init()

    if (isElectron) {
      const unsub = window.pigAPI.onPigCalledHome(() => {
        setScreenSize(prev => {
          const newX = prev.width - 150 - 20 // 20px padding
          stateRef.current.x = newX
          stateRef.current.y = 0
          stateRef.current.vy = 0
          setPosition({ x: newX, y: 0 })
          return prev
        })
      })
      return () => unsub()
    }
  }, [])

  // Vòng lặp vật lý và di chuyển (Physics loop)
  useEffect(() => {
    const PIG_WIDTH = 150
    const FPS = 30
    const intervalMs = 1000 / FPS
    
    const interval = setInterval(() => {
      const state = stateRef.current
      const waterSurfaceY = -(floodLevelRef.current / 100) * screenSize.height
      const currentFloor = isSinkingRef.current ? 0 : waterSurfaceY
      currentFloorRef.current = currentFloor
      
      if (state.isDragging) {
        // Nếu đang kéo thả, không chạy vật lý
        updateDragState('held')
        state.vy = 0

        // Tính toán vận tốc kéo hiện tại để làm hiệu ứng quán tính (squash/stretch)
        const history = dragHistoryRef.current
        const now = performance.now()
        // Chỉ lấy history trong 100ms gần nhất
        const recent = history.filter(h => now - h.time < 100)
        let dragVx = 0
        let dragVy = 0
        if (recent.length > 1) {
          const first = recent[0]
          const last = recent[recent.length - 1]
          const dt = last.time - first.time
          if (dt > 0) {
            dragVx = ((last.x - first.x) / dt) * 16 // multiplier scale for effect
            dragVy = ((last.y - first.y) / dt) * 16
          }
        }
        setDragVelocity({ x: dragVx, y: dragVy })
      } else if (state.y < currentFloor) {
        // Vật lý rơi rớt
        if (isSinkingRef.current && state.y > waterSurfaceY) {
          // Đang chìm trong nước
          state.vy += 0.3 * pigScaleRef.current
          state.vy *= 0.9
        } else {
          // Rơi trong không khí
          state.vy += 1.5 * pigScaleRef.current // Gia tốc rơi, tỷ lệ theo khối lượng heo
        }
        state.y += state.vy
        updateDragState('falling')
        
        // Chạm đất hoặc mặt nước
        if (state.y >= currentFloor) {
          state.y = currentFloor
          state.vy = 0
          updateDragState('landed')
          
          if (pigScaleRef.current >= 2.0 && currentFloor === 0) {
            window.dispatchEvent(new CustomEvent('earthquake'))
          }

          // Xóa trạng thái landed sau 500ms
          clearTimeout(landedTimeoutRef.current)
          landedTimeoutRef.current = setTimeout(() => {
            updateDragState(null)
          }, 600)
        }
      } else if (state.y > currentFloor) {
        // Đang chìm trong nước (hoặc nước đang dâng) -> Lực đẩy nổi
        state.vy -= 1.5 * pigScaleRef.current
        state.vy *= 0.8 // Lực cản nước
        state.y += state.vy
        
        if (state.y <= currentFloor) {
          state.y = currentFloor
          state.vy = 0
          updateDragState(prev => prev === 'landed' ? 'landed' : null)
        }
      } else {
        state.y = currentFloor
        state.vy = 0
        // Chỉ set null nếu đang không phải trạng thái landed (để không đè mất 500ms landed)
        updateDragState(prev => prev === 'landed' ? 'landed' : null)
      }
      
      if (!state.isDragging) {
        setDragVelocity({ x: state.vx, y: state.vy })
      }

      // Phát sự kiện bay để hiệu ứng thời tiết bắt tốc độ
      const isFlying = state.isDragging || state.y < 0
      const currentVy = state.isDragging ? dragVy : state.vy
      window.dispatchEvent(new CustomEvent('pig-flying', { detail: { isFlying, vy: currentVy } }))

      // Áp dụng quán tính (vx) khi ở trên không hoặc trượt trên đất
      if (!state.isDragging && Math.abs(state.vx) > 0.1) {
        state.x += state.vx
        
        // Ma sát (chạm đất thì ma sát lớn hơn)
        const friction = state.y === currentFloor ? 0.8 : 0.98
        state.vx *= friction
        
        // Chạm biên màn hình -> dội lại hoặc dừng
        if (state.x <= 0) {
          state.x = 0
          if (Math.abs(state.vx) > 5 && !isWallHit) {
            setIsWallHit(true)
            clearTimeout(wallHitTimeoutRef.current)
            wallHitTimeoutRef.current = setTimeout(() => setIsWallHit(false), 400)
          }
          state.vx *= -0.5
          state.facing = 1
          setFacing(1)
        } else if (state.x >= screenSize.width - PIG_WIDTH) {
          state.x = screenSize.width - PIG_WIDTH
          if (Math.abs(state.vx) > 5 && !isWallHit) {
            setIsWallHit(true)
            clearTimeout(wallHitTimeoutRef.current)
            wallHitTimeoutRef.current = setTimeout(() => setIsWallHit(false), 400)
          }
          state.vx *= -0.5
          state.facing = -1
          setFacing(-1)
        }
      }

      // Xử lý đi bộ
      if (mode === 'walking' && state.y === currentFloor && !state.isDragging && dragStateRef.current !== 'landed' && Math.abs(state.vx) < 1) {
        // Vận tốc đi bộ
        const walkSpeed = 3
        state.vx = state.facing * walkSpeed
        state.x += state.vx
        
        // Chạm biên màn hình -> quay đầu
        if (state.x <= 0) {
          state.x = 0
          state.facing = 1
          setFacing(1)
        } else if (state.x >= screenSize.width - PIG_WIDTH) {
          state.x = screenSize.width - PIG_WIDTH
          state.facing = -1
          setFacing(-1)
        }
      } else if (state.y === currentFloor && Math.abs(state.vx) < 0.1) {
        // Đang không đi bộ và đã dừng trượt
        state.vx = 0
      }

      // ─── Vật lý gió thời tiết ────────────────────────────────────────────
      const wx = weatherRef.current
      if (wx && !state.isDragging) {
        const windSpeed = wx.windSpeed || 0
        const forceX = wx.windForceX || 0 // -1..+1
        const mass = pigScaleRef.current   // heo to = nặng = ít bị gió

        if (windSpeed > 0) {
          const windAccel = (forceX * windSpeed * 0.005) / mass

          if (state.y === currentFloor) {
            // Lực gió ngang khi đứng trên đất
            const isThin = pigScaleRef.current < 1.1
            if (windSpeed >= 25 && isThin) {
              state.vx += windAccel * 1.5
            } else if (Math.abs(state.vx) > 0.3) {
              // Heo đang di chuyển → tăng tốc hoặc giảm tốc theo hướng gió
              state.vx += windAccel * 0.6
            }
          } else if (state.y < 0 && windSpeed >= 25) {
            // Khi bay trên không (bị quăng lên) và gió từ 25 trở lên, heo bị thổi mạnh hơn nhiều
            state.vx += windAccel * 4
          }
        }

        // Bão gió giật (windSpeed > 50) → thỉnh thoảng thổi bay heo lên trời
        if (wx.isStorm && windSpeed > 50 && state.y === currentFloor && !state.isDragging) {
          if (Math.random() < 0.008) { // ~0.8% mỗi frame
            const liftForce = -(windSpeed / mass) * (0.3 + Math.random() * 0.4)
            // Chỉ kích hoạt nếu lực đẩy đủ mạnh (tránh trường hợp heo chỉ nhích nhẹ rồi rơi tạo ra hiệu ứng thud liên tục)
            if (liftForce < -15) {
              state.vy = Math.max(liftForce, -35) // giới hạn tối đa
              state.y = currentFloor - 1 // thoát khỏi đất/nước để vật lý rơi kích hoạt
            }
          }
        }
      }

      // Xử lý hiệu ứng gió (wind lines) khi bay lên hoặc rơi xuống nhanh
      if (windRef && windRef.current) {
        if (!state.isDragging && Math.abs(state.vy) > 15) {
          // Bay lên hoặc rơi xuống đủ nhanh
          windRef.current.style.opacity = Math.min(1, Math.abs(state.vy) / 40)
          
          if (state.vy > 0) {
            // Đang rơi xuống -> Lộn ngược tia gió để nó hướng lên trên
            windRef.current.style.transform = 'rotate(180deg)'
          } else {
            // Bay lên
            windRef.current.style.transform = 'none'
          }
        } else {
          windRef.current.style.opacity = 0
        }
      }
      
      // Cập nhật React state
      setPosition({ x: state.x, y: state.y })
      
    }, intervalMs)

    return () => {
      clearInterval(interval)
      // Không clearTimeout ở đây để đảm bảo state landed luôn được giải phóng sau 600ms
      // kể cả khi effect bị re-run do thay đổi mode
    }
  }, [mode, screenSize])

  // Drag handlers
  const handleMouseEnter = useCallback(() => {
    if (isElectron) window.pigAPI.setIgnoreMouse(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!stateRef.current.isDragging && !isPanelOpen && isElectron) {
      window.pigAPI.setIgnoreMouse(true)
    }
  }, [isPanelOpen])

  const handleDragStart = useCallback((e) => {
    if (mode === 'eating' || mode === 'sniffing' || mode === 'full') return

    stateRef.current.isMouseDown = true
    
    // Lưu vị trí chuột ban đầu để tính delta
    stateRef.current.dragStart = { x: e.clientX, y: e.clientY }
    // Lưu vị trí heo ban đầu khi bắt đầu kéo
    stateRef.current.dragOffset = { x: stateRef.current.x, y: stateRef.current.y }
    stateRef.current.hasMoved = false
    
    // Nếu heo đang bay/rơi (y < 0), lập tức tóm được heo (bỏ qua ngưỡng 5px)
    if (stateRef.current.y < 0) {
      stateRef.current.isDragging = true
      setIsDragging(true)
      stateRef.current.hasMoved = true
      // Reset vận tốc ngay khi tóm
      stateRef.current.vx = 0
      stateRef.current.vy = 0
    }

    // Khởi tạo history
    dragHistoryRef.current = [{ x: e.clientX, y: e.clientY, time: performance.now() }]

    if (isElectron) window.pigAPI.setIgnoreMouse(false)
  }, [])

  const handleDrag = useCallback((e) => {
    if (!stateRef.current.isMouseDown) return
    
    const dx = e.clientX - stateRef.current.dragStart.x
    const dy = e.clientY - stateRef.current.dragStart.y
    
    if (!stateRef.current.isDragging) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        stateRef.current.isDragging = true
        setIsDragging(true)
        stateRef.current.hasMoved = true
      } else {
        return // Chưa di chuyển đủ xa
      }
    }
    
    let newX = stateRef.current.dragOffset.x + dx
    let newY = stateRef.current.dragOffset.y + dy
    
    // Giới hạn trong màn hình
    newX = Math.max(0, Math.min(screenSize.width - 150, newX))
    // Không cho phép kéo xuống dưới đất (y > 0)
    newY = Math.min(0, newY)
    
    stateRef.current.x = newX
    stateRef.current.y = newY
    
    // Ghi lại history
    const history = dragHistoryRef.current
    history.push({ x: e.clientX, y: e.clientY, time: performance.now() })
    if (history.length > 5) history.shift() // Giữ lại 5 frame gần nhất

    setPosition({ x: newX, y: newY })
  }, [screenSize])

  const handleDragEnd = useCallback(() => {
    stateRef.current.isMouseDown = false
    const wasDragging = stateRef.current.isDragging
    
    if (wasDragging) {
      stateRef.current.isDragging = false
      setIsDragging(false)
      
      // Tính toán quán tính (vận tốc lúc nhả chuột)
      const history = dragHistoryRef.current
      if (history.length >= 2) {
        const last = history[history.length - 1]
        const first = history[0]
        const dt = last.time - first.time
        if (dt > 0 && dt < 200) { // Nếu nhả chuột trong vòng 200ms từ lúc di chuyển 5 frame cuối
          // Heo càng to thì càng nặng: scale = 1.0 → mass = 1.0, scale = 2.5 → mass = 2.5
          const mass = pigScaleRef.current
          stateRef.current.vx = ((last.x - first.x) / dt) * 16 / mass
          stateRef.current.vy = ((last.y - first.y) / dt) * 16 / mass
        } else {
          stateRef.current.vx = 0
          stateRef.current.vy = 0
        }
      } else {
        stateRef.current.vx = 0
        stateRef.current.vy = 0
      }

      // Nếu thả heo ngay trên mặt đất/nước (y >= currentFloor) và ĐÃ DRAG
      if (stateRef.current.y >= currentFloorRef.current && stateRef.current.hasMoved) {
        stateRef.current.y = currentFloorRef.current
        updateDragState('landed')
        
        if (pigScaleRef.current >= 2.0) {
          window.dispatchEvent(new CustomEvent('earthquake'))
        }

        clearTimeout(landedTimeoutRef.current)
        landedTimeoutRef.current = setTimeout(() => {
          updateDragState(null)
        }, 600)
      }
    }
    
    if (isElectron && !isPanelOpen) window.pigAPI.setIgnoreMouse(true)
  }, [isPanelOpen])

  // Lắng nghe sấm sét: nếu đang cầm trên tay thì heo giật mình rớt xuống
  useEffect(() => {
    const handleLightningDrop = () => {
      if (stateRef.current.isDragging) {
        stateRef.current.isMouseDown = false
        stateRef.current.isDragging = false
        setIsDragging(false)
        
        // Thêm một lực đẩy nhẹ để tạo cảm giác heo giãy giụa tuột khỏi tay
        stateRef.current.vx = (Math.random() - 0.5) * 20
        stateRef.current.vy = -10
      }
    }
    window.addEventListener('lightning-strike', handleLightningDrop)
    return () => window.removeEventListener('lightning-strike', handleLightningDrop)
  }, [])

  // Bind global drag events
  useEffect(() => {
    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', handleDragEnd)
    return () => {
      window.removeEventListener('mousemove', handleDrag)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [handleDrag, handleDragEnd])

  return {
    position,
    facing,
    isDragging,
    dragState,
    handleMouseEnter,
    handleMouseLeave,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    wasDragged: useCallback(() => stateRef.current.hasMoved, []),
    isWallHit,
    dragVelocity,
    isStruggling,
    isSinking
  }
}
