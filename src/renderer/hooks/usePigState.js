import { useState, useEffect, useRef } from 'react'

// Trạng thái: idle → walking → sniffing → eating → sleeping → full
// Cycle ngẫu nhiên dựa trên context

const IDLE_QUOTES = [
  'Oink oink! 🐽',
  'Ăn gì chưa? 🍖',
  'Nhìn trời đẹp ghê...',
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

  const scaleRef = useRef(1.0)
  const eatenRef = useRef(0)

  // Keep refs in sync
  useEffect(() => { scaleRef.current = pigScale }, [pigScale])
  useEffect(() => { eatenRef.current = totalEaten }, [totalEaten])

  const reloadSettings = async () => {
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      if (s.pigScale) setPigScale(s.pigScale)
      if (s.totalEaten) setTotalEaten(s.totalEaten)
      if (s.cameraFollowsPig !== undefined) setCameraFollowsPig(s.cameraFollowsPig)
    }
  }

  // 1. Load initial settings
  useEffect(() => {
    reloadSettings()
  }, [])

  // 2. Shrink pig over time (0.001 per second)
  useEffect(() => {
    const shrinkInterval = setInterval(() => {
      setPigScale(prev => Math.max(1.0, prev - 0.001))
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
  function triggerEat(freedKB) {
    setMode('eating')
    showBubble(EAT_QUOTES)

    // Tăng kích thước: đảm bảo luôn có base tăng 2% (0.02) để dễ nhận thấy
    const freedMB = (freedKB || 0) / 1024
    const growth = freedMB > 0
      ? 0.02 + Math.min(0.2, Math.log10(1 + freedMB) * 0.03)
      : 0

    setPigScale(prev => Math.min(prev + growth, 2.5))
    setTotalEaten(prev => prev + (freedKB || 0))

    setTimeout(() => {
      setMode('full')
      showBubble(FULL_QUOTES)
      setTimeout(() => setMode('idle'), 4000)
    }, 5000)
  }

  function forceBubble(text) {
    setBubble(text)
    setTimeout(() => setBubble(null), 4000)
  }

  return { mode, bubble, pigScale, totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble }
}

