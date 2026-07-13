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
]

const FULL_QUOTES = [
  'Căng da bụng quá! 🤰',
  'No rồi... ợ~ 😮‍💨',
  'Ăn thêm được nữa 💪',
  'Heo mập hơn rồi nè!',
]

const SLEEP_QUOTES = null // không hiện bubble khi ngủ

export function usePigState(trashInfo) {
  const [mode, setMode] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const [pigScale, setPigScale] = useState(1.0)
  const [totalEaten, setTotalEaten] = useState(0)

  // Hiện speech bubble với timeout
  function showBubble(quotes) {
    if (!quotes) return
    const text = quotes[Math.floor(Math.random() * quotes.length)]
    setBubble(text)
    setTimeout(() => setBubble(null), 3000)
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

  // Hành động ăn
  function triggerEat(freedMB) {
    setMode('eating')
    showBubble(EAT_QUOTES)

    // Tăng kích thước
    const growth = Math.min(0.05, freedMB / 1000)
    setPigScale(prev => Math.min(prev + growth, 2.0))
    setTotalEaten(prev => prev + (freedMB || 0))

    setTimeout(() => {
      setMode('full')
      showBubble(FULL_QUOTES)
      setTimeout(() => setMode('idle'), 4000)
    }, 2000)
  }

  return { mode, bubble, pigScale, totalEaten, triggerEat, setMode }
}
