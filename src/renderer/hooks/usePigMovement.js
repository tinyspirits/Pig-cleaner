import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.pigAPI

export function usePigMovement(mode, isPanelOpen = false) {
  // position.y = 0 means on the floor (bottom of screen). Negative y means in the air.
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [screenSize, setScreenSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [facing, setFacing] = useState(1) // 1 = right, -1 = left
  
  // New state to manage drag stages: 'held', 'falling', 'landed', null
  const [dragState, setDragState] = useState(null)
  const landedTimeoutRef = useRef(null)
  
  const stateRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 }
  })

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
        setDragState('held')
        return
      }
      
      // Áp dụng trọng lực (Gravity)
      if (state.y < 0) {
        state.vy += 1.5 // Gia tốc rơi
        state.y += state.vy
        setDragState('falling')
        
        // Chạm đất
        if (state.y >= 0) {
          state.y = 0
          state.vy = 0
          setDragState('landed')
          // Xóa trạng thái landed sau 500ms
          clearTimeout(landedTimeoutRef.current)
          landedTimeoutRef.current = setTimeout(() => {
            setDragState(null)
          }, 600)
        }
      } else {
        state.y = 0
        state.vy = 0
        // Chỉ set null nếu đang không phải trạng thái landed (để không đè mất 500ms landed)
        setDragState(prev => prev === 'landed' ? 'landed' : null)
      }
      
      // Xử lý đi bộ
      if (mode === 'walking' && state.y === 0) {
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
      } else {
        // Đang không đi bộ hoặc đang trên không
        state.vx = 0
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
    stateRef.current.isDragging = true
    setIsDragging(true)
    
    // Lưu vị trí chuột ban đầu để tính delta
    stateRef.current.dragStart = { x: e.clientX, y: e.clientY }
    // Lưu vị trí heo ban đầu khi bắt đầu kéo
    stateRef.current.dragOffset = { x: stateRef.current.x, y: stateRef.current.y }
    
    if (isElectron) window.pigAPI.setIgnoreMouse(false)
  }, [])

  const handleDrag = useCallback((e) => {
    if (!stateRef.current.isDragging) return
    
    const dx = e.clientX - stateRef.current.dragStart.x
    const dy = e.clientY - stateRef.current.dragStart.y
    
    let newX = stateRef.current.dragOffset.x + dx
    let newY = stateRef.current.dragOffset.y + dy
    
    // Giới hạn trong màn hình
    newX = Math.max(0, Math.min(screenSize.width - 150, newX))
    // Không cho phép kéo xuống dưới đất (y > 0)
    newY = Math.min(0, newY)
    
    stateRef.current.x = newX
    stateRef.current.y = newY
    
    setPosition({ x: newX, y: newY })
  }, [screenSize])

  const handleDragEnd = useCallback(() => {
    stateRef.current.isDragging = false
    setIsDragging(false)
    stateRef.current.vy = 0 // Reset vận tốc rơi khi thả ra
    
    if (isElectron && !isPanelOpen) window.pigAPI.setIgnoreMouse(true)

    // Nếu thả heo ngay trên mặt đất (y >= 0), vòng lặp vật lý sẽ không bao giờ
    // đi qua bước "falling" nên "landed" sẽ không tự kích hoạt -> heo nhảy thẳng
    // sang di chuyển. Ép trạng thái "landed" ngay lập tức trong trường hợp này.
    // Nếu vẫn đang ở trên không (y < 0), để vòng lặp vật lý tự xử lý rơi -> landed.
    if (stateRef.current.y >= 0) {
      stateRef.current.y = 0
      setDragState('landed')
      clearTimeout(landedTimeoutRef.current)
      landedTimeoutRef.current = setTimeout(() => {
        setDragState(null)
      }, 600)
    }
  }, [])

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
  }
}
