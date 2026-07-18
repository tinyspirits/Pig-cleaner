import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.pigAPI

export function usePigMovement(mode, isPanelOpen = false, windRef = null, pigScale = 1.0, weatherData = null, poolMode = false) {
  // position.y = 0 means on the floor (bottom of screen). Negative y means in the air.
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [screenSize, setScreenSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [facing, setFacing] = useState(1) // 1 = right, -1 = left

  const [dragState, setDragState] = useState(null)
  const [isAboveWater, setIsAboveWater] = useState(false)
  const [paleLevel, setPaleLevel] = useState(0)
  const [dragVelocity, setDragVelocity] = useState({ x: 0, y: 0 })
  const [isWallHit, setIsWallHit] = useState(false)
  const [swimAction, setSwimAction] = useState('none') // 'none', 'surface', 'diving', 'bottom', 'rising'

  const dragStateRef = useRef(null)
  const wallHitTimeoutRef = useRef(null)
  const landedTimeoutRef = useRef(null)
  const pigScaleRef = useRef(pigScale)
  const weatherRef = useRef(weatherData)
  const floodLevelRef = useRef(0)
  const currentFloorRef = useRef(0)
  const isDraggingRef = useRef(false)
  const paleLevelRef = useRef(0)
  const swimActionRef = useRef('none')
  const swimPhaseRef = useRef(0)
  const nextSwimChangeRef = useRef(0)
  const hoverWanderRef = useRef(0)
  const submergedTimeRef = useRef(0)
  const isSuffocatingRef = useRef(false)
  const hasImpactedRef = useRef(true)
  const lastIsDraggingRef = useRef(false)
  const poolModeRef = useRef(poolMode)

  // Cập nhật refs mỗi khi props thay đổi
  useEffect(() => { pigScaleRef.current = pigScale }, [pigScale])
  useEffect(() => { weatherRef.current = weatherData }, [weatherData])
  useEffect(() => { poolModeRef.current = poolMode }, [poolMode])

  // Mô phỏng mực nước
  useEffect(() => {
    const interval = setInterval(() => {
      const isHeavyRain = weatherRef.current?.condition === 'thunderstorm' || poolModeRef.current
      let currentFlood = floodLevelRef.current
      if (isHeavyRain) {
        currentFlood = Math.min(50, currentFlood + 1.5)
      } else {
        currentFlood = Math.max(0, currentFlood - 3)
      }
      floodLevelRef.current = currentFlood
    }, 1000)
    return () => clearInterval(interval)
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
      const floatingY = waterSurfaceY + 60
      const isInWater = floatingY < 0
      let dragVx = 0
      let dragVy = 0

      // Update swimAction state based on water presence
      if (isInWater && swimActionRef.current === 'none') {
        if (swimPhaseRef.current === 0) {
          swimActionRef.current = 'surface'
          setSwimAction('surface')
        } else {
          swimActionRef.current = 'rising'
          setSwimAction('rising')
          nextSwimChangeRef.current = performance.now() + 2000
        }
      } else if (!isInWater && swimActionRef.current !== 'none') {
        swimActionRef.current = 'none'
        setSwimAction('none')
        swimPhaseRef.current = 0 // Quên cách bơi khi cạn nước
        isSuffocatingRef.current = false
      } else if (isInWater && state.isDragging) {
        // Cập nhật trạng thái ngay khi bị người chơi kéo chìm xuống hoặc nhấc lên
        if (state.y > floatingY + 10 && ['surface', 'rising', 'hover', 'struggling'].includes(swimActionRef.current)) {
          swimActionRef.current = 'diving'
          setSwimAction('diving')
        } else if (state.y < floatingY - 5 && ['diving', 'bottom', 'drowning_sink', 'drowning_bottom'].includes(swimActionRef.current)) {
          const nextAction = swimPhaseRef.current === 0 ? 'surface' : 'rising'
          swimActionRef.current = nextAction
          setSwimAction(nextAction)
          isSuffocatingRef.current = false // Được kéo lên giữa chừng lúc đang ngất -> coi như đã cứu, huỷ trạng thái ngạt
        }
      }

      currentFloorRef.current = !isInWater || swimActionRef.current === 'bottom' || swimActionRef.current === 'diving' ? 0 : floatingY

      // ─── Ngạt nước nếu ở dưới nước quá lâu (kể cả khi bị người chơi giữ/kéo chìm) ───
      // Chỉ áp dụng khi ĐÃ biết bơi (swimPhaseRef === 1); giai đoạn học bơi ban đầu đã có
      // kịch bản chết đuối riêng (struggling -> drowning_sink -> drowning_bottom) ở trên.
      if (isInWater && state.y > floatingY + 20) {
        submergedTimeRef.current += intervalMs
      } else {
        submergedTimeRef.current = 0
      }

      const SUFFOCATE_MS = 16000 // ~16 giây liên tục dưới nước sẽ bắt đầu ngạt
      if (
        !isSuffocatingRef.current &&
        swimPhaseRef.current === 1 &&
        submergedTimeRef.current > SUFFOCATE_MS &&
        swimActionRef.current !== 'struggling' &&
        swimActionRef.current !== 'drowning_sink' &&
        swimActionRef.current !== 'drowning_bottom'
      ) {
        isSuffocatingRef.current = true
        swimActionRef.current = 'struggling'
        setSwimAction('struggling')
        nextSwimChangeRef.current = performance.now() + 2000
        submergedTimeRef.current = 0
      }

      if (state.isDragging && !lastIsDraggingRef.current) {
        hasImpactedRef.current = false
      }
      lastIsDraggingRef.current = state.isDragging

      // ─── CHIA NHÁNH LOGIC: Đang kéo thả vs Đang rơi tự do ───
      if (state.isDragging) {
        // [1] NẾU ĐANG KÉO: Vô hiệu hóa vật lý game
        updateDragState('held')
        state.vy = 0
        nextSwimChangeRef.current = performance.now() + 5000

        // Tính toán vận tốc kéo hiện tại để làm hiệu ứng quán tính (squash/stretch)
        const history = dragHistoryRef.current
        const now = performance.now()
        // Chỉ lấy history trong 100ms gần nhất
        const recent = history.filter(h => now - h.time < 100)
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
      } else {
        // [2] NẾU KHÔNG KÉO: Chạy trí tuệ nhân tạo (AI), lực hấp dẫn, lực đẩy nổi

        // AI quyết định lặn/ngoi
        if (isInWater) {
          const now = performance.now()
          if (isSuffocatingRef.current) {
            // Đang ngạt: vùng vẫy -> chìm dần -> ngất nằm ở đáy -> tỉnh lại bơi lên
            if (now > nextSwimChangeRef.current) {
              if (swimActionRef.current === 'struggling') {
                swimActionRef.current = 'drowning_sink'
                setSwimAction('drowning_sink')
                nextSwimChangeRef.current = now + 2500
              } else if (swimActionRef.current === 'drowning_sink') {
                swimActionRef.current = 'drowning_bottom'
                setSwimAction('drowning_bottom')
                nextSwimChangeRef.current = now + 4000 + Math.random() * 2000 // nằm ngất một lúc
              } else if (swimActionRef.current === 'drowning_bottom') {
                // Tỉnh lại, bơi ngược lên mặt nước
                isSuffocatingRef.current = false
                swimActionRef.current = 'rising'
                setSwimAction('rising')
                nextSwimChangeRef.current = now + 900 + Math.random() * 1600
              }
            }
          } else if (swimPhaseRef.current === 0) {
            // Phase học bơi
            if (floodLevelRef.current < 50 && swimActionRef.current !== 'struggling' && swimActionRef.current !== 'drowning_sink' && swimActionRef.current !== 'drowning_bottom') {
              if (swimActionRef.current !== 'surface') {
                swimActionRef.current = 'surface'
                setSwimAction('surface')
              }
            } else if (floodLevelRef.current >= 50 && swimActionRef.current === 'surface') {
              swimActionRef.current = 'struggling'
              setSwimAction('struggling')
              nextSwimChangeRef.current = now + 3000
            }

            if (now > nextSwimChangeRef.current && nextSwimChangeRef.current !== 0) {
              if (swimActionRef.current === 'struggling') {
                swimActionRef.current = 'drowning_sink'
                setSwimAction('drowning_sink')
                nextSwimChangeRef.current = now + 3000
              } else if (swimActionRef.current === 'drowning_sink') {
                swimActionRef.current = 'drowning_bottom'
                setSwimAction('drowning_bottom')
                nextSwimChangeRef.current = now + 5000
              } else if (swimActionRef.current === 'drowning_bottom') {
                swimPhaseRef.current = 1
                swimActionRef.current = 'bottom'
                setSwimAction('bottom')
                nextSwimChangeRef.current = now + 2000
              }
            }
          } else {
            // Đã biết bơi: bơi tự do ở nhiều độ sâu khác nhau trong nước
            if (now > nextSwimChangeRef.current) {
              if (swimActionRef.current === 'surface') {
                swimActionRef.current = 'diving'
                setSwimAction('diving')
                nextSwimChangeRef.current = now + 9999999
              } else if (swimActionRef.current === 'hover') {
                swimActionRef.current = 'diving'
                setSwimAction('diving')
                nextSwimChangeRef.current = now + 9999999
              } else if (swimActionRef.current === 'bottom') {
                swimActionRef.current = 'rising'
                setSwimAction('rising')
                nextSwimChangeRef.current = now + 700 + Math.random() * 2200
                const wanderDir = Math.random() < 0.5 ? 1 : -1
                state.facing = wanderDir
                setFacing(wanderDir)
                state.vx = wanderDir * (1 + Math.random() * 2.5)
              } else if (swimActionRef.current === 'rising') {
                swimActionRef.current = 'hover'
                setSwimAction('hover')
                nextSwimChangeRef.current = now + 900 + Math.random() * 1600
              }
            }
          }

          if (swimActionRef.current === 'hover' && now > hoverWanderRef.current) {
            const hoverDir = Math.random() < 0.5 ? 1 : -1
            state.facing = hoverDir
            setFacing(hoverDir)
            state.vx = hoverDir * (0.8 + Math.random() * 2)
            hoverWanderRef.current = now + 400 + Math.random() * 700
          }
        }

        // Y-axis physics (Lực đẩy nổi & Trọng lực)
        const inWater = isInWater && state.y > floatingY

        if (inWater) {
          if (swimActionRef.current === 'diving' || swimActionRef.current === 'drowning_sink') {
            state.vy += 0.8 * pigScaleRef.current
            state.vy *= 0.9
          } else if (swimActionRef.current === 'rising') {
            state.vy -= 1.2 * pigScaleRef.current
            state.vy *= 0.85
          } else if (swimActionRef.current === 'surface' || swimActionRef.current === 'struggling') {
            state.vy -= 1.5 * pigScaleRef.current
            state.vy *= 0.8
          } else if (swimActionRef.current === 'hover') {
            state.vy += 0.15 * pigScaleRef.current
            state.vy *= 0.85
          } else if (swimActionRef.current === 'bottom' || swimActionRef.current === 'drowning_bottom') {
            state.vy += 0.8 * pigScaleRef.current
            state.vy *= 0.9
          }
        } else {
          if (state.y < -15000) {
            // Không trọng lực trên dải ngân hà
            state.vy *= 0.95
          } else {
            state.vy += 1.5 * pigScaleRef.current
          }
        }

        // Cập nhật tọa độ Y bằng vận tốc Y
        state.y += state.vy

        // Clamping & state transitions
        if (isInWater) {
          if (swimActionRef.current === 'rising' && state.y <= floatingY) {
            state.y = floatingY
            state.vy = 0
            swimActionRef.current = 'surface'
            setSwimAction('surface')
            nextSwimChangeRef.current = performance.now() + 1000
          } else if (swimActionRef.current === 'diving' && state.y >= 0) {
            state.y = 0
            state.vy = 0
            swimActionRef.current = 'bottom'
            setSwimAction('bottom')
            nextSwimChangeRef.current = performance.now() + 2000 + Math.random() * 3000
          } else if (swimActionRef.current === 'drowning_sink' && state.y >= 0) {
            state.y = 0
            state.vy = 0
          }

          if (state.y > 0) {
            state.y = 0
            state.vy = 0
          }

          if (swimActionRef.current === 'surface' && state.y < floatingY && state.vy > 0 && state.y + state.vy >= floatingY) {
            // Hitting surface from above
            state.y = floatingY
            state.vy *= -0.2
          }
        } else {
          if (state.y >= 0) {
            state.y = 0
            state.vy = 0
          }
        }

        // Drag state UI updates (Falling / Landed logic)
        const activeFloor = (['surface', 'struggling', 'rising', 'hover'].includes(swimActionRef.current)) && isInWater ? floatingY : 0

        // SỬA LỖI SIZE TO BỊ HIỂN THỊ RƠI TRÊN MẶT NƯỚC:
        // Cấp một khoảng "khoan hồng" dập dềnh tỉ lệ thuận với độ lớn của heo (15px * pigScale)
        const bobbingTolerance = 15 * pigScaleRef.current;

        if (state.y < activeFloor - bobbingTolerance) {
          updateDragState('falling')
        } else {
          if (dragStateRef.current === 'falling' || (dragStateRef.current === 'held' && state.vy > 5)) {
            updateDragState('landed')
            if (isInWater && state.y >= floatingY) {
              if (!hasImpactedRef.current) {
                window.dispatchEvent(new CustomEvent('water-splash', { detail: { vy: Math.abs(state.vy) } }))
                hasImpactedRef.current = true
                if (state.vy > 10) state.vy *= 0.4
                else state.vy *= 0.8
              } else {
                state.vy *= 0.8
              }
            } else if (pigScaleRef.current >= 2.0 && state.y >= 0 && !poolModeRef.current) {
              if (!hasImpactedRef.current) {
                window.dispatchEvent(new CustomEvent('earthquake'))
                hasImpactedRef.current = true
              }
            }
            clearTimeout(landedTimeoutRef.current)
            landedTimeoutRef.current = setTimeout(() => {
              updateDragState(null)
            }, 600)
          } else {
            updateDragState(prev => prev === 'landed' ? 'landed' : null)
          }
        }
      } // Kết thúc nhánh !state.isDragging

      // ─── Các logic vật lý chung ───
      if (!state.isDragging) {
        setDragVelocity({ x: state.vx, y: state.vy })
      }

      // Phát sự kiện bay để hiệu ứng thời tiết bắt tốc độ
      const isFlying = state.isDragging || state.y < 0
      const currentVy = state.isDragging ? dragVy : state.vy
      window.dispatchEvent(new CustomEvent('pig-flying', { detail: { isFlying, vy: currentVy, y: state.y } }))

      // Áp dụng quán tính (vx) khi ở trên không hoặc trượt trên đất
      if (!state.isDragging && Math.abs(state.vx) > 0.1) {
        state.x += state.vx

        // Ma sát (chạm đất thì ma sát lớn hơn)
        const friction = Math.abs(state.y - currentFloorRef.current) < 2 ? 0.8 : 0.98
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

      // Xử lý đi bộ (bơi dưới đáy)
      const isBottomSwimming = swimActionRef.current === 'bottom' && mode === 'walking'
      if ((mode === 'walking' || isBottomSwimming) && state.y === currentFloorRef.current && !state.isDragging && dragStateRef.current !== 'landed' && Math.abs(state.vx) < 1) {
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
      } else if (state.y === currentFloorRef.current && Math.abs(state.vx) < 0.1) {
        // Đang không đi bộ và đã dừng trượt
        state.vx = 0
      }

      // Vật lý gió thời tiết
      const wx = weatherRef.current
      if (wx && !state.isDragging) {
        const windSpeed = wx.windSpeed || 0
        const forceX = wx.windForceX || 0 // -1..+1
        const mass = pigScaleRef.current   // heo to = nặng = ít bị gió

        if (windSpeed > 0) {
          const windAccel = (forceX * windSpeed * 0.005) / mass

          if (state.y === currentFloorRef.current) {
            const isThin = pigScaleRef.current < 1.1
            if (windSpeed >= 25 && isThin) {
              state.vx += windAccel * 1.5
            } else if (Math.abs(state.vx) > 0.3) {
              state.vx += windAccel * 0.6
            }
          } else if (state.y < 0 && windSpeed >= 25) {
            state.vx += windAccel * 4
          }
        }

        if (wx.isStorm && windSpeed > 50 && state.y === currentFloorRef.current && !state.isDragging) {
          if (Math.random() < 0.008) {
            const liftForce = -(windSpeed / mass) * (0.3 + Math.random() * 0.4)
            if (liftForce < -15) {
              state.vy = Math.max(liftForce, -35)
              state.y = currentFloorRef.current - 1
            }
          }
        }
      }

      // Xử lý hiệu ứng gió (wind lines) khi bay lên hoặc rơi xuống nhanh
      if (windRef && windRef.current) {
        if (!state.isDragging && Math.abs(state.vy) > 15) {
          windRef.current.style.opacity = Math.min(1, Math.abs(state.vy) / 40)
          if (state.vy > 0) {
            windRef.current.style.transform = 'rotate(180deg)'
          } else {
            windRef.current.style.transform = 'none'
          }
        } else {
          windRef.current.style.opacity = 0
        }
      }

      // Tính toán paleLevel (tái mép)
      if (swimActionRef.current === 'struggling') {
        paleLevelRef.current = Math.min(1.0, paleLevelRef.current + 0.015)
      } else if (swimActionRef.current === 'drowning_sink') {
        paleLevelRef.current = 1.0
      } else if (swimActionRef.current === 'drowning_bottom') {
        paleLevelRef.current = Math.max(0.0, paleLevelRef.current - 0.004)
      } else {
        paleLevelRef.current = Math.max(0.0, paleLevelRef.current - 0.05)
      }

      // Cập nhật React state
      setPosition({ x: state.x, y: state.y })

      // SỬA LỖI 2: Ngưỡng tính toán isAboveWater cũng phải co giãn theo heo to
      setIsAboveWater(isInWater ? state.y < floatingY - (20 * pigScaleRef.current) : state.y < -10)

      setPaleLevel(paleLevelRef.current)

    }, intervalMs)

    return () => {
      clearInterval(interval)
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
    stateRef.current.dragStart = { x: e.clientX, y: e.clientY }
    stateRef.current.dragOffset = { x: stateRef.current.x, y: stateRef.current.y }
    stateRef.current.hasMoved = false

    if (stateRef.current.y < 0) {
      stateRef.current.isDragging = true
      setIsDragging(true)
      stateRef.current.hasMoved = true
      stateRef.current.vx = 0
      stateRef.current.vy = 0
    }

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
        return
      }
    }

    let newX = stateRef.current.dragOffset.x + dx
    let newY = stateRef.current.dragOffset.y + dy

    newX = Math.max(0, Math.min(screenSize.width - 150, newX))
    newY = Math.min(0, newY)

    if (newX - stateRef.current.x > 2) {
      stateRef.current.facing = 1
      setFacing(1)
    } else if (stateRef.current.x - newX > 2) {
      stateRef.current.facing = -1
      setFacing(-1)
    }

    stateRef.current.x = newX
    stateRef.current.y = newY

    const history = dragHistoryRef.current
    history.push({ x: e.clientX, y: e.clientY, time: performance.now() })
    if (history.length > 5) history.shift()

    setPosition({ x: newX, y: newY })
  }, [screenSize])

  const handleDragEnd = useCallback(() => {
    stateRef.current.isMouseDown = false
    const wasDragging = stateRef.current.isDragging

    if (wasDragging) {
      stateRef.current.isDragging = false
      setIsDragging(false)

      const history = dragHistoryRef.current
      if (history.length >= 2) {
        const last = history[history.length - 1]
        const first = history[0]
        const dt = last.time - first.time
        if (dt > 0 && dt < 200) {
          const mass = pigScaleRef.current
          const rawVx = ((last.x - first.x) / dt) * 16 / mass
          const rawVy = ((last.y - first.y) / dt) * 16 / mass
          const MAX_SPEED = 120
          stateRef.current.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, rawVx))
          stateRef.current.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, rawVy))
        } else {
          stateRef.current.vx = 0
          stateRef.current.vy = 0
        }
      } else {
        stateRef.current.vx = 0
        stateRef.current.vy = 0
      }

      // TÍNH TOÁN LẠI MẶT SÀN THỰC TẾ LÚC THẢ TAY
      const waterSurfaceY = -(floodLevelRef.current / 100) * screenSize.height
      const floatingY = waterSurfaceY + 60
      const isInWater = floatingY < 0

      const effectiveFloor = (isInWater && stateRef.current.y > floatingY + 10) ? 0 : currentFloorRef.current

      if (stateRef.current.y >= effectiveFloor && stateRef.current.hasMoved) {
        stateRef.current.y = effectiveFloor
        updateDragState('landed')

        if (pigScaleRef.current >= 2.0 && !poolModeRef.current) {
          window.dispatchEvent(new CustomEvent('earthquake'))
        }

        clearTimeout(landedTimeoutRef.current)
        landedTimeoutRef.current = setTimeout(() => {
          updateDragState(null)
        }, 600)
      }
    }

    if (isElectron && !isPanelOpen) window.pigAPI.setIgnoreMouse(true)
  }, [isPanelOpen, screenSize])

  // Lắng nghe sấm sét
  useEffect(() => {
    const handleLightningDrop = () => {
      if (stateRef.current.isDragging) {
        stateRef.current.isMouseDown = false
        stateRef.current.isDragging = false
        setIsDragging(false)
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
    swimAction,
    isAboveWater,
    paleLevel,
    isSpaceFrozen: position.y < -15000
  }
}