import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// Trạng thái: idle → walking → sniffing → eating → sleeping → full
// Cycle ngẫu nhiên dựa trên context

// Quotes will be fetched from i18n

export function usePigState(trashInfo, petType = 'pig') {
  const { t } = useTranslation()
  const [mode, setMode] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const [pigScale, setPigScale] = useState(1.0)
  const [totalEaten, setTotalEaten] = useState(0) // in KB
  const [cameraFollowsPig, setCameraFollowsPig] = useState(true)
  const [unlimitedPigSize, setUnlimitedPigSize] = useState(false)
  const [explosionEvent, setExplosionEvent] = useState(null) // { id } khi vừa "nổ" tách nhỏ, null khi bình thường

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
      
      const key = petType === 'duck' ? 'duck.sniffQuotes' : 'pig.sniffQuotes'
      const def = petType === 'duck' ? ['Quắc! Có rác kìa! 🦆', 'Tắm rác không ta?', 'Có gì ăn được không?'] : ['Khứu... Có mùi rác! 👃', 'Ngửi thấy rồi! 🐽', 'Rác rác... đâu đâu?', 'Hmm... thùng rác có gì?']
      let quotes = t(key, { returnObjects: true, defaultValue: def })
      if (!Array.isArray(quotes)) quotes = def
      showBubble(quotes)
      
      setTimeout(() => setMode('idle'), 4000)
    }
  }, [trashInfo, petType])

  // Auto behavior cycle
  useEffect(() => {
    function getBehaviors() {
      const hour = new Date().getHours()
      const isNight = hour >= 22 || hour < 6
      const isEvening = hour >= 19 && hour < 22

      if (isNight) {
        return [
          { mode: 'idle', weight: 10 },
          { mode: 'walking', weight: 5 },
          { mode: 'sniffing', weight: 5 },
          { mode: 'sleeping', weight: 80 }, // Ban đêm ngủ rất nhiều
        ]
      } else if (isEvening) {
        return [
          { mode: 'idle', weight: 30 },
          { mode: 'walking', weight: 20 },
          { mode: 'sniffing', weight: 15 },
          { mode: 'sleeping', weight: 35 }, // Chiều tối hay ngáp ngủ
        ]
      } else {
        return [
          { mode: 'idle', weight: 40 },
          { mode: 'walking', weight: 30 },
          { mode: 'sniffing', weight: 15 },
          { mode: 'sleeping', weight: 10 }, // Ban ngày lanh lợi
        ]
      }
    }

    function randomBehavior() {
      const behaviors = getBehaviors()
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
        const key = petType === 'duck' ? 'duck.idleQuotes' : 'pig.idleQuotes'
        const def = petType === 'duck' ? ['Quắc quắc! 🦆', 'Ăn gì chưa?', 'Buồn ngủ quá~', '*quạt cánh*', 'Hôm nay trời đẹp ghê'] : ['Oink oink! 🐽', 'Ăn gì chưa? 🍖', 'Buồn ngủ quá~', '*hít thở*', 'Hôm nay có rác không ta?']
        let quotes = t(key, { returnObjects: true, defaultValue: def })
        if (!Array.isArray(quotes)) quotes = def
        showBubble(quotes)
      }
    }, 5000 + Math.random() * 5000)

    return () => clearInterval(interval)
  }, [mode, petType])

  // Hành động ăn — freedKB là số KB đã giải phóng
  const triggerEat = useCallback((freedKB) => {
    setMode('eating')
    
    // Tăng kích thước: đảm bảo luôn có base tăng 5% (0.05) để dễ nhận thấy.
    // Trước đây cap cứng ở 0.2 khiến bất kỳ lượng rác nào từ ~30-40MB trở lên
    // đều cho growth gần như giống hệt nhau (dọn 8GB không khác gì 30MB).
    // Giờ nới rộng hệ số (0.06 thay vì 0.04) và nâng cap an toàn lên 1.5
    // (chỉ chạm tới ở mức nhiều TB, gần như không bao giờ gặp thực tế) để
    // độ lớn rác dọn được luôn phản ánh rõ vào độ tăng kích thước.
    const growth = freedKB > 0
      ? 0.05 + Math.min(1.5, Math.log10(1 + freedKB) * 0.06)
      : 0

    // Ngưỡng "nổ bùm": khi đạt 500% (chỉ có thể xảy ra ở chế độ unlimited,
    // vì chế độ thường bị chặn ở 250%), heo/vịt nổ tách thành nhiều con nhỏ
    // rồi quay về kích thước gốc (100%) để bắt đầu lại chu kỳ lớn lên.
    const EXPLODE_THRESHOLD = 5.0

    setPigScale(prev => {
      const next = prev + (isNaN(growth) ? 0 : growth)
      if (unlimitedRef.current) {
        if (isNaN(next)) return 1.0
        if (next >= EXPLODE_THRESHOLD) {
          setExplosionEvent({ id: Date.now() })
          return 1.0
        }
        return next
      }
      return isNaN(next) ? 1.0 : Math.min(next, 2.5)
    })
    setTotalEaten(prev => prev + (isNaN(freedKB) ? 0 : freedKB))

    const sizeStr = freedKB < 1024 
      ? `+${freedKB.toFixed(0)}KB` 
      : `+${(freedKB / 1024).toFixed(1)}MB`
      
    const yummyKey = petType === 'duck' ? 'duck.yummy' : 'pig.yummy'
    const yummyDef = petType === 'duck' ? 'Quắc, ngon!' : 'Ngon quá!'
    forceBubble(`${sizeStr}! ${t(yummyKey, yummyDef)}`)

    setTimeout(() => {
      setMode('full')
      
      const key = petType === 'duck' ? 'duck.fullQuotes' : 'pig.fullQuotes'
      const def = petType === 'duck' ? ['No ứ hự! 🦆', 'Ợ~ 😮‍💨', 'Căng mỏ rồi', 'Ăn nữa không bay nổi đâu', 'Bụng to quá!'] : ['Căng da bụng quá! 🤰', 'No rồi... ợ~ 😮‍💨', 'Ăn thêm được nữa 💪', 'Heo mập hơn rồi nè!', 'Béo ra rồi nha 🐖']
      let quotes = t(key, { returnObjects: true, defaultValue: def })
      if (!Array.isArray(quotes)) quotes = def
      showBubble(quotes)
      
      setTimeout(() => setMode('idle'), 4000)
    }, 5000)
  }, [petType, t])
  function forceBubble(text) {
    setBubble(text)
    setTimeout(() => setBubble(null), 4000)
  }

  return { mode, bubble, pigScale, totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble, explosionEvent, clearExplosionEvent: () => setExplosionEvent(null) }
}

