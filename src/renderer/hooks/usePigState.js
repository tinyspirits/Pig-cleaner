import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// Hàm tiện ích: Tạo màu ngẫu nhiên (từ 0 đến 360 độ)
export const getRandomHue = () => Math.floor(Math.random() * 360)

// Trạng thái: idle → walking → sniffing → eating → sleeping → full
// Cycle ngẫu nhiên dựa trên context

// pigScale (render) = pigBaseScale + pigEatenScale
//   pigBaseScale: do người dùng set qua slider (0.05-1.0), tồn tại lâu dài
//   pigEatenScale: tăng khi ăn rác, tự giảm dần về 0 theo thời gian

export function usePigState(trashInfo, petType = 'pig') {
  const { t } = useTranslation()
  const [mode, setMode] = useState('idle')
  const [bubble, setBubble] = useState(null)
  const [pigBaseScale, setPigBaseScale] = useState(1.0)   // do slider set
  const [pigEatenScale, setPigEatenScale] = useState(0.0) // tăng khi ăn
  const [totalEaten, setTotalEaten] = useState(0) // in KB
  const [cameraFollowsPig, setCameraFollowsPig] = useState(true)
  const [unlimitedPigSize, setUnlimitedPigSize] = useState(false)
  const [explosionEvent, setExplosionEvent] = useState(null)
  const [followers, setFollowers] = useState([])
  const [neverGrow, setNeverGrow] = useState(false)

  const baseScaleRef = useRef(1.0)
  const eatenScaleRef = useRef(0.0)
  const eatenRef = useRef(0)
  const unlimitedRef = useRef(false)
  const neverGrowRef = useRef(false)
  const followersRef = useRef([])

  // Keep refs in sync
  useEffect(() => { baseScaleRef.current = pigBaseScale }, [pigBaseScale])
  useEffect(() => { eatenScaleRef.current = pigEatenScale }, [pigEatenScale])
  useEffect(() => { eatenRef.current = totalEaten }, [totalEaten])
  useEffect(() => { unlimitedRef.current = unlimitedPigSize }, [unlimitedPigSize])
  useEffect(() => { neverGrowRef.current = neverGrow }, [neverGrow])
  useEffect(() => { followersRef.current = followers }, [followers])

  // pigScale hiện tại = base + eaten
  const pigScale = pigBaseScale + pigEatenScale

  const reloadSettings = async () => {
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      // pigBaseScale: ưu tiên field mới, fallback về pigScale cũ (clamp về 1.0)
      if (s.pigBaseScale !== undefined && s.pigBaseScale !== null) {
        setPigBaseScale(Math.min(s.pigBaseScale, 1.0))
      } else if (s.pigScale !== undefined && s.pigScale !== null) {
        // Migrate: pigScale cũ → pigBaseScale (clamp về [0.05, 1.0])
        setPigBaseScale(Math.min(Math.max(s.pigScale, 0.05), 1.0))
      }
      // pigEatenScale: load nếu có, không thì 0
      if (s.pigEatenScale !== undefined && s.pigEatenScale !== null) {
        setPigEatenScale(Math.max(0, s.pigEatenScale))
      }
      if (s.totalEaten) setTotalEaten(s.totalEaten)
      if (s.cameraFollowsPig !== undefined) setCameraFollowsPig(s.cameraFollowsPig)
      if (s.unlimitedPigSize !== undefined) setUnlimitedPigSize(s.unlimitedPigSize)
      if (s.neverGrow !== undefined) setNeverGrow(s.neverGrow)
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

  // 2. Shrink: chỉ giảm pigEatenScale (phần ăn được), không đụng pigBaseScale.
  // pigEatenScale giảm 0.001/giây, sàn là 0.
  useEffect(() => {
    const shrinkInterval = setInterval(() => {
      setPigEatenScale(prev => {
        if (isNaN(prev) || prev <= 0) return 0
        // Giảm 0.1% mỗi giây (khoảng 45% sau 10 phút) để người dùng có thể nhận thấy
        const shrinkRate = prev * 0.001
        return Math.max(0, prev - shrinkRate)
      })

      setFollowers(prev => prev.map(f => {
        // Tạm thời chỉ đảm bảo dữ liệu f không bị lỗi, không trừ eatenScale
        if (!f.eatenScale || f.eatenScale <= 0) return f
        return f
      }))
    }, 1000)
    return () => clearInterval(shrinkInterval)
  }, [])

  // 3. Save to settings every 10s if changed
  useEffect(() => {
    if (!window.pigAPI) return
    const saveInterval = setInterval(async () => {
      const s = await window.pigAPI.getSettings()
      if (
        s.pigBaseScale !== baseScaleRef.current ||
        s.pigEatenScale !== eatenScaleRef.current ||
        s.totalEaten !== eatenRef.current ||
        JSON.stringify(s.followers) !== JSON.stringify(followersRef.current)
      ) {
        s.pigBaseScale = baseScaleRef.current
        s.pigEatenScale = eatenScaleRef.current
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
          : (petType === 'dog' ? 'Gâu! Trả con lại đây! 🐶😡' : 'Oink! Dám bắt con ta à! 🐽😡')
        setBubble(msg)
        setTimeout(() => setBubble(null), 4000)
      }
    }
    window.addEventListener('rescue-piglets', handleRescue)
    return () => window.removeEventListener('rescue-piglets', handleRescue)
  }, [petType])

  const clearPiglets = async () => {
    setFollowers([])
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      s.followers = []
      await window.pigAPI.saveSettings(s)
    }
  }

  const spawnPiglet = async () => {
    let newFollowers = []
    setFollowers(prev => {
      newFollowers = [
        ...prev,
        {
          id: Math.random().toString(),
          scale: baseScaleRef.current * 0.2,
          eatenScale: 0,
          hue: getRandomHue()
        }
      ].slice(0, 24)
      return newFollowers
    })
    
    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      s.followers = newFollowers
      await window.pigAPI.saveSettings(s)
    }
  }

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

      const key = petType === 'duck' ? 'duck.sniffQuotes' : (petType === 'dog' ? 'dog.sniffQuotes' : 'pig.sniffQuotes')
      const def = petType === 'duck' ? ['Quắc! Có rác kìa! 🦆', 'Tắm rác không ta?', 'Có gì ăn được không?'] : (petType === 'dog' ? ['Gâu! Có mùi rác! 🐕', 'Đánh hơi thấy rác! 👃', 'Khịt khịt... rác đâu?'] : ['Khứu... Có mùi rác! 👃', 'Ngửi thấy rồi! 🐽', 'Rác rác... đâu đâu?', 'Hmm... thùng rác có gì?'])
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
        const key = petType === 'duck' ? 'duck.idleQuotes' : (petType === 'dog' ? 'dog.idleQuotes' : 'pig.idleQuotes')
        const def = petType === 'duck' ? ['Quắc quắc! 🦆', 'Ăn gì chưa?', 'Buồn ngủ quá~', '*quạt cánh*', 'Hôm nay trời đẹp ghê'] : (petType === 'dog' ? ['Gâu gâu! 🐕', 'Có ai chơi cùng không?', 'Đói bụng quá', '*vẫy đuôi*', 'Woof woof!'] : ['Oink oink! 🐽', 'Ăn gì chưa? 🍖', 'Buồn ngủ quá~', '*hít thở*', 'Hôm nay có rác không ta?'])
        let quotes = t(key, { returnObjects: true, defaultValue: def })
        if (!Array.isArray(quotes)) quotes = def
        showBubble(quotes)
      }
    }, 5000 + Math.random() * 5000)

    return () => clearInterval(interval)
  }, [mode, petType])

  // Hành động ăn — tăng pigEatenScale, không đụng pigBaseScale
  const triggerEat = useCallback((freedKB) => {
    setMode('eating')

    const growth = freedKB > 0
      ? 0.05 + Math.min(1.5, Math.log10(1 + freedKB) * 0.06)
      : 0

    let motherGrowth = growth
    let pigletGrowths = []
    
    const numPiglets = followersRef.current.length
    if (numPiglets > 0) {
      // Mẹ nhường phần lớn thức ăn cho con (mẹ chỉ ăn 15%)
      motherGrowth = growth * 0.15
      
      // 85% thức ăn còn lại chia ngẫu nhiên cho các heo con
      const remainingFood = growth * 0.85
      const randomWeights = Array.from({ length: numPiglets }).map(() => Math.random() + 0.2)
      const sumWeights = randomWeights.reduce((a, b) => a + b, 0)
      
      pigletGrowths = randomWeights.map(w => remainingFood * (w / sumWeights))
    }

    if (neverGrowRef.current) {
      motherGrowth = 0
      pigletGrowths = []
    }

    let nextEatenScale = eatenScaleRef.current + (isNaN(motherGrowth) ? 0 : motherGrowth)
    let exploded = false
    // totalScaleAtBirth dùng để tính size heo con (dựa vào base, không phải tổng)
    const baseAtBirth = baseScaleRef.current

    // Ngưỡng nổ cố định: pigEatenScale >= 4.0 (400%) bất kể base bao nhiêu
    const EATEN_EXPLODE_THRESHOLD = 4.0

    if (unlimitedRef.current) {
      if (isNaN(nextEatenScale)) nextEatenScale = 0
      if (nextEatenScale >= EATEN_EXPLODE_THRESHOLD) {
        exploded = true
        // Reset phần eaten về 0 sau khi nổ
        nextEatenScale = 0
      }
    } else {
      // Không unlimited: giới hạn eaten ở 1.5 (150% bonus tối đa), không nổ
      nextEatenScale = isNaN(nextEatenScale) ? 0 : Math.min(nextEatenScale, 1.5)
    }

    setPigEatenScale(nextEatenScale)

    if (exploded) {
      setExplosionEvent({ id: Date.now() })
    }

    setFollowers(prev => {
      let updated = prev.map((f, idx) => {
        const addedGrowth = pigletGrowths[idx] || 0;
        return {
          ...f,
          scale: (f.scale !== undefined ? f.scale : (baseAtBirth * (f.relativeScale || 0.2))) + (addedGrowth * baseScaleRef.current),
          eatenScale: (f.eatenScale || 0) + addedGrowth
        };
      })

      if (exploded) {
        const newPiglets = Array.from({ length: 8 }).map(() => ({
          id: Math.random().toString(),
          scale: baseAtBirth * 0.2,
          eatenScale: 0,
          hue: getRandomHue()
        }))
        updated = [...updated, ...newPiglets].slice(0, 24)
      }

      // Tách đàn: Heo nhỏ ở lại, heo đã đạt kích thước trưởng thành (bằng 75% scale tổng hiện tại của mẹ) rời đi
      const motherCurrentScale = baseScaleRef.current * (1 + eatenScaleRef.current)
      const ADULT_SCALE = motherCurrentScale * 0.75
      const remaining = []
      const departing = []
      updated.forEach(f => {
        if (f.scale >= ADULT_SCALE && !neverGrowRef.current) {
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

    const yummyKey = petType === 'duck' ? 'duck.yummy' : (petType === 'dog' ? 'dog.yummy' : 'pig.yummy')
    const yummyDef = petType === 'duck' ? 'Quắc, ngon!' : (petType === 'dog' ? 'Gâu, ngon quá!' : 'Ngon quá!')
    forceBubble(`${sizeStr}! ${t(yummyKey, yummyDef)}`)

    setTimeout(() => {
      setMode('full')

      const key = petType === 'duck' ? 'duck.fullQuotes' : (petType === 'dog' ? 'dog.fullQuotes' : 'pig.fullQuotes')
      const def = petType === 'duck' ? ['No ứ hự! 🦆', 'Ợ~ 😮‍💨', 'Căng mỏ rồi', 'Ăn nữa không bay nổi đâu', 'Bụng to quá!'] : (petType === 'dog' ? ['No cành hông! 🐕', 'Ợ~ 😮‍💨', 'Ngon tuyệt!', 'Muốn ngủ quá...', 'Bụng tròn vo!'] : ['Căng da bụng quá! 🤰', 'No rồi... ợ~ 😮‍💨', 'Ăn thêm được nữa 💪', 'Heo mập hơn rồi nè!', 'Béo ra rồi nha 🐖'])
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

  // Set pigBaseScale (slider) và lưu ngay — pigEatenScale không bị ảnh hưởng.
  // Heo con scale theo tỉ lệ thay đổi của base.
  const setPigScaleAndSave = async (newBase) => {
    const clampedBase = Math.min(Math.max(newBase, 0.05), 1.0)
    const oldBase = baseScaleRef.current || 1
    const ratio = oldBase > 0 ? clampedBase / oldBase : 1
    const scaledFollowers = followersRef.current.map(f => ({ ...f, scale: f.scale * ratio }))

    setPigBaseScale(clampedBase)
    setFollowers(scaledFollowers)

    if (window.pigAPI) {
      const s = await window.pigAPI.getSettings()
      s.pigBaseScale = clampedBase
      s.pigEatenScale = eatenScaleRef.current
      s.followers = scaledFollowers
      await window.pigAPI.saveSettings(s)
    }
  }

  // Reset pigBaseScale về 1.0 (mặc định), pigEatenScale giữ nguyên
  const resetPigScale = async () => {
    await setPigScaleAndSave(1.0)
  }

  return {
    mode, bubble,
    pigScale,       // tổng = base + eaten, dùng để render
    pigBaseScale,   // phần slider set (0.05-1.0)
    pigEatenScale,  // phần tăng do ăn
    setPigScale: setPigScaleAndSave,
    resetPigScale,
    totalEaten, cameraFollowsPig, reloadSettings, triggerEat, setMode, forceBubble,
    explosionEvent, clearExplosionEvent: () => setExplosionEvent(null),
    followers,
    spawnPiglet,
    clearPiglets
  }
}