import { useState, useEffect, useRef, useCallback } from 'react'

// Trạng thái: idle → walking → sniffing → eating → sleeping → full
// Cycle ngẫu nhiên dựa trên context

const IDLE_QUOTES = [
  'Oink oink! 🐽',
  'Ăn gì chưa? 🍖',
  'Buồn ngủ quá~',
  '*hít thở*',
  'Hôm nay có rác không ta?',
]

const SNIFF_QUOTES = [
  'Khứu... Có mùi rác! 👃',
  'Ngửi thấy rồi! 🐽',
  'Rác rác... đâu đâu?',
  'Hmm... thùng rác có gì?',
]

const EAT_QUOTES = [
  'Mmm ngon quá! 😋',
  'CHOMP CHOMP! 🍽️',
  'Ăn tiếp! Ăn tiếp!',
  'Rác này nhìn ngon há...',
  'Nom nom nom 🐷',
]

const FULL_QUOTES = [
  'Căng da bụng quá! 🤰',
  'No rồi... ợ~ 😮‍💨',
  'Ăn thêm được nữa 💪',
  'Heo mập hơn rồi nè!',
  'Béo ra rồi nha 🐖',
]

const SLEEP_QUOTES = null // không hiện bubble khi ngủ

export function usePigState(trashInfo) {
  const [mode, setMode] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const [pigScale, setPigScale] = useState(1.0)
  const [totalEaten, setTotalEaten] = useState(0) // in KB
  const [cameraFollowsPig, setCameraFollowsPig] = useState(true)
  const [unlimitedPigSize, setUnlimitedPigSize] = useState(false)

  const scaleRef = useRef(1.0)
  const eatenRef = useRef(0)
  const unlimitedRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { scaleRef.current = pigScale }, [pigScale])
  useEffect(() => { eatenRef.current = totalEaten }, [totalEaten])
  useEffect(() => { unlimitedRef.current = unlimitedPigSize }, [unlimitedPigSize])

  const reloadSettings = async () => {
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      if (s.pigScale) setPigScale(s.pigScale)
      if (s.totalEaten) setTotalEaten(s.totalEaten)
      if (s.cameraFollowsPig !== undefined) setCameraFollowsPig(s.cameraFollowsPig)
      if (s.unlimitedPigSize !== undefined) setUnlimitedPigSize(s.unlimitedPigSize)
    }
  }

  // 1. Load initial settings
  useEffect(() => {
    reloadSettings()
  }, [])

  // 2. Shrink pig over time (0.001 per second)
  useEffect(() => {
    const shrinkInterval = setInterval(() => {
      setPigScale(prev => {
        if (isNaN(prev)) return 1.0;
        return Math.max(1.0, prev - 0.001)
      })
    }, 1000)
    return () => clearInterval(shrinkInterval)
  }, [])

  // 3. Save to settings every 10s if changed
  useEffect(() => {
    if (!window.pigAPI) return
    const saveInterval = setInterval(async () => {
      const s = await window.pigAPI.getSettings()
      if (s.pigScale !== scaleRef.current || s.totalEaten !== eatenRef.current) {
        s.pigScale = scaleRef.current
        s.totalEaten = eatenRef.current
        await window.pigAPI.saveSettings(s)
      }
    }, 10000)
    return () => clearInterval(saveInterval)
  }, [])

  // Hiện speech bubble với timeout
  function showBubble(quotes, duration = 3000) {
    if (!quotes) return
    const text = quotes[Math.floor(Math.random() * quotes.length)]
    setBubble(text)
    setTimeout(() => setBubble(null), duration)
  }

  // Khi trash thay đổi → pig sniff
  useEffect(() => {
    if (!trashInfo) return
    if (trashInfo.sizeBytes > 0) {
      setMode('sniffing')
      showBubble(SNIFF_QUOTES)
      setTimeout(() => setMode('idle'), 4000)
    }
  }, [trashInfo])

  // Auto behavior cycle
  useEffect(() => {
    const behaviors = [
      { mode: 'idle', weight: 40 },
      { mode: 'walking', weight: 30 },
      { mode: 'sniffing', weight: 15 },
      { mode: 'sleeping', weight: 10 },
    ]

    function randomBehavior() {
      const total = behaviors.reduce((s, b) => s + b.weight, 0)
      let r = Math.random() * total
      for (const b of behaviors) {
        r -= b.weight
        if (r <= 0) return b.mode
      }
      return 'idle'
    }

    const interval = setInterval(() => {
      // Chỉ thay đổi nếu không đang eating/full
      if (mode === 'eating' || mode === 'full') return

      const next = randomBehavior()
      setMode(next)

      if (next === 'idle' && Math.random() < 0.3) {
        showBubble(IDLE_QUOTES)
      }
    }, 5000 + Math.random() * 5000)

    return () => clearInterval(interval)
  }, [mode])

  // Hành động ăn — freedKB là số KB đã giải phóng
  const triggerEat = useCallback((freedKB) => {
    setMode('eating')
    
    // Tăng kích thước: đảm bảo luôn có base tăng 5% (0.05) để dễ nhận thấy
    const growth = freedKB > 0
      ? 0.05 + Math.min(0.2, Math.log10(1 + freedKB) * 0.04)
      : 0

    setPigScale(prev => {
      const next = prev + (isNaN(growth) ? 0 : growth)
      if (unlimitedRef.current) return isNaN(next) ? 1.0 : next
      return isNaN(next) ? 1.0 : Math.min(next, 2.5)
    })
    setTotalEaten(prev => prev + (isNaN(freedKB) ? 0 : freedKB))

    const sizeStr = freedKB < 1024 
      ? `+${freedKB.toFixed(0)}KB` 
      : `+${(freedKB / 1024).toFixed(1)}MB`
      
    forceBubble(`${sizeStr}! Ngon quá!`)

    setTimeout(() => {
      setMode('full')
      showBubble(FULL_QUOTES)
      setTimeout(() => setMode('idle'), 4000)
    }, 5000)
  }, [])
  function forceBubble(text) {
    setBubble(text)
    setTimeout(() => setBubble(null), 4000)
  }

  return { mode, bubble, pigScale, totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble }
}

