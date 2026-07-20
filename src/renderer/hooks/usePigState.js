import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// Hàm tiện ích: Tạo màu ngẫu nhiên (từ 0 đến 360 độ)
export const getRandomHue = () => Math.floor(Math.random() * 360)

// Trạng thái: idle → walking → sniffing → eating → sleeping → full
// Cycle ngẫu nhiên dựa trên context

export function usePigState(trashInfo, petType = 'pig') {
  const { t } = useTranslation()
  const [mode, setMode] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const [pigScale, setPigScale] = useState(1.0)
  const [totalEaten, setTotalEaten] = useState(0) // in KB
  const [cameraFollowsPig, setCameraFollowsPig] = useState(true)
  const [unlimitedPigSize, setUnlimitedPigSize] = useState(false)
  const [explosionEvent, setExplosionEvent] = useState(null) // { id } khi vừa "nổ" tách nhỏ, null khi bình thường
  const [followers, setFollowers] = useState([])

  const scaleRef = useRef(1.0)
  const eatenRef = useRef(0)
  const unlimitedRef = useRef(false)
  const followersRef = useRef([])

  // Keep refs in sync
  useEffect(() => { scaleRef.current = pigScale }, [pigScale])
  useEffect(() => { eatenRef.current = totalEaten }, [totalEaten])
  useEffect(() => { unlimitedRef.current = unlimitedPigSize }, [unlimitedPigSize])
  useEffect(() => { followersRef.current = followers }, [followers])

  const reloadSettings = async () => {
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      if (s.pigScale) setPigScale(s.pigScale)
      if (s.totalEaten) setTotalEaten(s.totalEaten)
      if (s.cameraFollowsPig !== undefined) setCameraFollowsPig(s.cameraFollowsPig)
      if (s.unlimitedPigSize !== undefined) setUnlimitedPigSize(s.unlimitedPigSize)
      if (s.followers) {
        // Cấp màu ngẫu nhiên cho heo cũ nếu chưa có thuộc tính hue
        setFollowers(s.followers.map(f => ({ ...f, hue: f.hue ?? getRandomHue() })))
      } else if (s.followersCount > 0) {
        // Migrate old settings
        setFollowers(Array.from({ length: s.followersCount }).map(() => ({
          id: Math.random().toString(),
          scale: 0.4,
          hue: getRandomHue()
        })))
      }
    }
  }

  // 1. Load initial settings
  useEffect(() => {
    reloadSettings()
  }, [])

  // 2. Heo mẹ tự giảm kích thước dần theo thời gian (0.001/giây, không dưới mức mặc định 1.0).
  // Heo con (followers) KHÔNG bị giảm — scale của chúng chỉ tăng khi ăn (xem pigletGrowths bên dưới).
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
      if (s.pigScale !== scaleRef.current || s.totalEaten !== eatenRef.current || JSON.stringify(s.followers) !== JSON.stringify(followersRef.current)) {
        s.pigScale = scaleRef.current
        s.totalEaten = eatenRef.current
        s.followers = followersRef.current
        await window.pigAPI.saveSettings(s)
      }
    }, 10000)
    return () => clearInterval(saveInterval)
  }, [])

  // Xử lý khi chim bắt heo con
  useEffect(() => {
    const handleBirdCaught = (e) => {
      const idx = e.detail?.index
      if (idx !== undefined) {
        setFollowers(prev => prev.filter((_, i) => i !== idx))
      }
    }
    window.addEventListener('bird-caught-follower', handleBirdCaught)
    return () => window.removeEventListener('bird-caught-follower', handleBirdCaught)
  }, [])

  // Xử lý giải cứu heo con khi heo mẹ ăn chim
  useEffect(() => {
    const handleRescue = (e) => {
      const rescued = e.detail?.piglets
      if (rescued && rescued.length > 0) {
        setFollowers(prev => [...prev, ...rescued])

        // Hiện bong bóng thoại tức giận
        const msg = petType === 'duck'
          ? 'Quắc! Nhả con ta ra! 🦆😡'
          : 'Oink! Dám bắt con ta à! 🐽😡'
        setBubble(msg)
        setTimeout(() => setBubble(null), 4000)
      }
    }
    window.addEventListener('rescue-piglets', handleRescue)
    return () => window.removeEventListener('rescue-piglets', handleRescue)
  }, [petType])

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
          { mode: 'sleeping', weight: 80 },
        ]
      } else if (isEvening) {
        return [
          { mode: 'idle', weight: 30 },
          { mode: 'walking', weight: 20 },
          { mode: 'sniffing', weight: 15 },
          { mode: 'sleeping', weight: 35 },
        ]
      } else {
        return [
          { mode: 'idle', weight: 40 },
          { mode: 'walking', weight: 30 },
          { mode: 'sniffing', weight: 15 },
          { mode: 'sleeping', weight: 10 },
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

  // Hành động ăn
  const triggerEat = useCallback((freedKB) => {
    setMode('eating')

    const growth = freedKB > 0
      ? 0.05 + Math.min(1.5, Math.log10(1 + freedKB) * 0.06)
      : 0

    const EXPLODE_THRESHOLD = 5.0

    const totalEntities = 1 + followersRef.current.length
    let randomWeights = Array.from({ length: totalEntities }).map(() => Math.random() + 0.1)
    const weightSum = randomWeights.reduce((a, b) => a + b, 0)
    randomWeights = randomWeights.map(w => w / weightSum)

    const motherGrowth = growth * randomWeights[0]
    const pigletGrowths = randomWeights.slice(1).map(w => growth * w)

    let nextMotherScale = scaleRef.current + (isNaN(motherGrowth) ? 0 : motherGrowth)
    let exploded = false;

    if (unlimitedRef.current) {
      if (isNaN(nextMotherScale)) nextMotherScale = 1.0;
      if (nextMotherScale >= EXPLODE_THRESHOLD) {
        exploded = true;
        nextMotherScale = 1.0;
      }
    } else {
      nextMotherScale = isNaN(nextMotherScale) ? 1.0 : Math.min(nextMotherScale, 2.5)
    }

    setPigScale(nextMotherScale)

    if (exploded) {
      setExplosionEvent({ id: Date.now() })
    }

    setFollowers(fc => {
      let updated = fc.map((f, i) => ({
        ...f,
        scale: f.scale + (pigletGrowths[i] || 0)
      }))

      if (exploded) {
        // Sinh heo con mới kèm màu ngẫu nhiên
        const newPiglets = Array.from({ length: 8 }).map(() => ({
          id: Math.random().toString(),
          scale: 0.4,
          hue: getRandomHue()
        }))
        updated = [...updated, ...newPiglets].slice(0, 24)
      }

      // Tách đàn: Heo nhỏ ở lại, heo đã đạt kích thước trưởng thành (scale >= 1.0) rời đi
      const ADULT_SCALE = 1.0
      const remaining = []
      const departing = []
      updated.forEach(f => {
        if (f.scale >= ADULT_SCALE) {
          departing.push(f)
        } else {
          remaining.push(f)
        }
      })

      if (departing.length > 0) {
        window.dispatchEvent(new CustomEvent('piglets-departing', { detail: { piglets: departing } }))
      }

      return remaining
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

  // Cập nhật pigScale VÀ lưu ngay xuống settings (không đợi auto-save mỗi 10s),
  // để tránh trường hợp người dùng kéo thanh trượt kích thước trong Settings rồi
  // đóng panel ngay -> reloadSettings() đọc lại giá trị cũ chưa kịp lưu, ghi đè mất.
  const setPigScaleAndSave = async (newScale) => {
    setPigScale(newScale)
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      s.pigScale = newScale
      await window.pigAPI.saveSettings(s)
    }
  }

  return { mode, bubble, pigScale, setPigScale: setPigScaleAndSave, totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble, explosionEvent, clearExplosionEvent: () => setExplosionEvent(null), followers }
}