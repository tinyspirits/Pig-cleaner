import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.pigAPI

export function usePigMovement(mode, isPanelOpen = false, windRef = null) {
  // position.y = 0 means on the floor (bottom of screen). Negative y means in the air.
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [screenSize, setScreenSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [facing, setFacing] = useState(1) // 1 = right, -1 = left
  
  const [dragState, setDragState] = useState(null)
  const [isWallHit, setIsWallHit] = useState(false)
  const dragStateRef = useRef(null)
  const wallHitTimeoutRef = useRef(null)
  const landedTimeoutRef = useRef(null)

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
      
      if (state.isDragging) {
        // Nếu đang kéo thả, không chạy vật lý
        updateDragState('held')
        state.vy = 0
      } else if (state.y < 0) {
        // Vật lý rơi rớt
        state.vy += 1.5 // Gia tốc rơi
        state.y += state.vy
        updateDragState('falling')
        
        // Chạm đất
        if (state.y >= 0) {
          state.y = 0
          state.vy = 0
          updateDragState('landed')
          // Xóa trạng thái landed sau 500ms
          clearTimeout(landedTimeoutRef.current)
          landedTimeoutRef.current = setTimeout(() => {
            updateDragState(null)
          }, 600)
        }
      } else {
        state.y = 0
        state.vy = 0
        // Chỉ set null nếu đang không phải trạng thái landed (để không đè mất 500ms landed)
        updateDragState(prev => prev === 'landed' ? 'landed' : null)
      }
      
      // Áp dụng quán tính (vx) khi ở trên không hoặc trượt trên đất
      if (!state.isDragging && Math.abs(state.vx) > 0.1) {
        state.x += state.vx
        
        // Ma sát (chạm đất thì ma sát lớn hơn)
        const friction = state.y === 0 ? 0.8 : 0.98
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
      if (mode === 'walking' && state.y === 0 && !state.isDragging && dragStateRef.current !== 'landed' && Math.abs(state.vx) < 1) {
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
      } else if (state.y === 0 && Math.abs(state.vx) < 0.1) {
        // Đang không đi bộ và đã dừng trượt
        state.vx = 0
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
      clearTimeout(landedTimeoutRef.current)
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
    stateRef.current.isMouseDown = true
    
    // Lưu vị trí chuột ban đầu để tính delta
    stateRef.current.dragStart = { x: e.clientX, y: e.clientY }
    // Lưu vị trí heo ban đầu khi bắt đầu kéo
    stateRef.current.dragOffset = { x: stateRef.current.x, y: stateRef.current.y }
    stateRef.current.hasMoved = false
    
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
    
    if (stateRef.current.isDragging) {
      stateRef.current.isDragging = false
      setIsDragging(false)
      
      // Tính toán quán tính (vận tốc lúc nhả chuột)
      const history = dragHistoryRef.current
      if (history.length >= 2) {
        const last = history[history.length - 1]
        const first = history[0]
        const dt = last.time - first.time
        if (dt > 0 && dt < 200) { // Nếu nhả chuột trong vòng 200ms từ lúc di chuyển 5 frame cuối
          stateRef.current.vx = ((last.x - first.x) / dt) * 16 // Scale to frames
          stateRef.current.vy = ((last.y - first.y) / dt) * 16
        } else {
          stateRef.current.vx = 0
          stateRef.current.vy = 0
        }
      } else {
        stateRef.current.vx = 0
        stateRef.current.vy = 0
      }
    }
    
    if (isElectron && !isPanelOpen) window.pigAPI.setIgnoreMouse(true)

    // Nếu thả heo ngay trên mặt đất (y >= 0) và ĐÃ DRAG
    if (stateRef.current.y >= 0 && stateRef.current.hasMoved) {
      stateRef.current.y = 0
      updateDragState('landed')
      clearTimeout(landedTimeoutRef.current)
      landedTimeoutRef.current = setTimeout(() => {
        updateDragState(null)
      }, 600)
    }
  }, [isPanelOpen])

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
    isWallHit
  }
}
