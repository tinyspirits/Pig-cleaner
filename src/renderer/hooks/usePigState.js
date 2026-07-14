import { useState, useEffect } from 'react'

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

    // Tăng kích thước: logarithmic scale
    // 10 MB  → +0.01 (nhích nhẹ)
    // 100 MB → +0.05
    // 1 GB   → +0.10
    // 5 GB   → +0.15
    const freedMB = (freedKB || 0) / 1024
    const growth = freedMB > 0
      ? Math.min(0.15, Math.log10(1 + freedMB / 10) * 0.1)
      : 0

    setPigScale(prev => Math.min(prev + growth, 2.5))
    setTotalEaten(prev => prev + (freedKB || 0))

    setTimeout(() => {
      setMode('full')
      showBubble(FULL_QUOTES)
      setTimeout(() => setMode('idle'), 4000)
    }, 2000)
  }

  return { mode, bubble, pigScale, totalEaten, triggerEat, setMode }
}

