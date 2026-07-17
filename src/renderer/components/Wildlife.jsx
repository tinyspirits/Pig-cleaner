import React, { useEffect, useState, useRef } from 'react'
import { getRandomHue } from '../hooks/usePigState' // Gọi hàm chung

// ─── Sprite cá bơi ───────────────────────────────────────────
import fishFrame1 from '../assets/Fish_swim_aligned/Fish1.png'
import fishFrame2 from '../assets/Fish_swim_aligned/Fish2.png'
import fishFrame3 from '../assets/Fish_swim_aligned/Fish3.png'
import fishFrame4 from '../assets/Fish_swim_aligned/Fish4.png'
import fishFrame5 from '../assets/Fish_swim_aligned/Fish5.png'
import fishFrame6 from '../assets/Fish_swim_aligned/Fish6.png'
import fishFrame7 from '../assets/Fish_swim_aligned/Fish7.png'
import fishFrame8 from '../assets/Fish_swim_aligned/Fish8.png'

const FISH_FRAMES = [fishFrame1, fishFrame2, fishFrame3, fishFrame4, fishFrame5, fishFrame6, fishFrame7, fishFrame8]

// ─── Sprite chim săn mồi ───────────────────────────────────────
const birdFramesRaw = import.meta.glob('../assets/bird_sprites/bird_fly_*.png', { eager: true, import: 'default' })
const BIRD_FRAMES = Object.keys(birdFramesRaw).sort((a, b) => {
    const numA = parseInt(a.match(/bird_fly_(\d+)\.png/)[1], 10)
    const numB = parseInt(b.match(/bird_fly_(\d+)\.png/)[1], 10)
    return numA - numB
}).map(key => birdFramesRaw[key])

const BIRD_PHASES = {
    patrol: { start: 2, end: 5 },
    diving: { start: 6, end: 8 },
    catching: { start: 21, end: 22 },
    rising: { start: 23, end: 27 }
}

// ─── Sprite chim đi bộ/cất cánh & mổ thóc (bird-walk.png) ───────────────
const birdWalkFramesRaw = import.meta.glob('../assets/bird_walk_aligned/bird_walk_*.png', { eager: true, import: 'default' })
const BIRD_WALK_FRAMES = Object.keys(birdWalkFramesRaw).sort((a, b) => {
    const numA = parseInt(a.match(/bird_walk_(\d+)\.png/)[1], 10)
    const numB = parseInt(b.match(/bird_walk_(\d+)\.png/)[1], 10)
    return numA - numB
}).map(key => birdWalkFramesRaw[key])

const birdPeckFramesRaw = import.meta.glob('../assets/bird_walk_aligned/bird_peck_*.png', { eager: true, import: 'default' })
const BIRD_PECK_FRAMES = Object.keys(birdPeckFramesRaw).sort((a, b) => {
    const numA = parseInt(a.match(/bird_peck_(\d+)\.png/)[1], 10)
    const numB = parseInt(b.match(/bird_peck_(\d+)\.png/)[1], 10)
    return numA - numB
}).map(key => birdPeckFramesRaw[key])

// 'flyaway': dùng khi chim KHÔNG bắt được gì (trượt mồi, hoặc mổ thóc xong) -> đi bộ rồi cất cánh
// 'foraging': cúi đầu mổ thóc dưới đất, lặp lại cho tới khi hết giờ
const BIRD_GROUND_PHASES = {
    flyaway: { start: 0, end: BIRD_WALK_FRAMES.length - 1 },
    foraging: { start: 0, end: BIRD_PECK_FRAMES.length - 1 },
}

function useFishFrame(fps = 9) {
    const [frameIdx, setFrameIdx] = useState(0)
    useEffect(() => {
        const interval = setInterval(() => {
            setFrameIdx(prev => (prev + 1) % FISH_FRAMES.length)
        }, 1000 / fps)
        return () => clearInterval(interval)
    }, [fps])
    return FISH_FRAMES[frameIdx]
}

function randomBetween(a, b) {
    return a + Math.random() * (b - a)
}

export default function Wildlife({ poolMode, waterLevel }) {
    const waterLevelRef = useRef(waterLevel)
    useEffect(() => { waterLevelRef.current = waterLevel }, [waterLevel])

    const [bird, setBird] = useState(null)
    const nextBirdTimeRef = useRef(0)
    const birdRef = useRef(null)
    const birdStateRef = useRef(null)

    const [fish, setFish] = useState(null)
    const nextFishTimeRef = useRef(0)
    const fishRef = useRef(null)
    const fishSprite = useFishFrame(9)

    // Sinh sản Cá và Chim
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now()

            // Tạo Cá
            setFish(prev => {
                if (prev) return prev
                if (!poolMode || waterLevelRef.current < 15) return null
                if (now < nextFishTimeRef.current) return null

                const fromLeft = Math.random() < 0.5
                const duration = randomBetween(6, 11)
                const bottomVh = randomBetween(3, Math.max(6, waterLevelRef.current - 4))
                nextFishTimeRef.current = now + duration * 1000 + randomBetween(15000, 40000)

                return { id: now, fromLeft, duration, bottomVh, caught: false, hue: getRandomHue() }
            })

            // Tạo Chim
            setBird(prev => {
                if (prev) return prev
                if (!poolMode) return null
                if (now < nextBirdTimeRef.current) return null
                const fromLeft = Math.random() < 0.5
                nextBirdTimeRef.current = now + randomBetween(15000, 35000)

                birdStateRef.current = {
                    x: fromLeft ? -150 : window.innerWidth + 150,
                    y: randomBetween(80, 180),
                    vx: (fromLeft ? 1 : -1) * randomBetween(150, 220),
                    vy: 0,
                    phase: 'patrol',
                    fromLeft,
                    scale: 1.0,
                    frameIdx: BIRD_PHASES.patrol.start,
                    frameTimer: 0,
                    pigletsEaten: [],
                    nextGrainTime: now + randomBetween(6000, 14000),
                    hue: getRandomHue() // Sử dụng random hue
                }
                return { id: now, caught: false }
            })

        }, 1000)
        return () => clearInterval(interval)
    }, [poolMode])

    // Tự thu dọn khi cá bơi xong hoặc bị nuốt
    useEffect(() => {
        if (!fish) return
        const t = setTimeout(() => {
            setFish(prev => (prev && prev.id === fish.id ? null : prev))
        }, fish.caught ? 650 : fish.duration * 1000 + 300)
        return () => clearTimeout(t)
    }, [fish])

    const catchPrey = (currentPrey, setPrey, preyRef, type = 'fish') => {
        if (!currentPrey || currentPrey.caught) return;
        const rect = preyRef.current?.getBoundingClientRect();
        if (!rect) return;

        const target = document.querySelector('.pig-container')?.getBoundingClientRect();

        setPrey({
            ...currentPrey,
            caught: true,
            swallowing: false,
            frozenLeft: rect.left,
            frozenTop: rect.top,
            targetLeft: target ? target.left + target.width / 2 : rect.left,
            targetTop: target ? target.top + target.height / 2 : rect.top,
        });

        const freedKB = type === 'bird' ? randomBetween(20, 50) * 1024 : randomBetween(2, 10) * 1024;
        window.dispatchEvent(new CustomEvent('fish-caught', { detail: { freedKB } }));

        if (type === 'bird' && birdStateRef.current?.pigletsEaten?.length > 0) {
            window.dispatchEvent(new CustomEvent('rescue-piglets', { detail: { piglets: birdStateRef.current.pigletsEaten } }));
            birdStateRef.current.pigletsEaten = [];
        }
    }

    // Animation nuốt mồi
    useEffect(() => {
        if (!fish || !fish.caught || fish.swallowing) return
        const raf = requestAnimationFrame(() => setFish(prev => (prev && prev.id === fish.id ? { ...prev, swallowing: true } : prev)))
        return () => cancelAnimationFrame(raf)
    }, [fish?.caught])

    useEffect(() => {
        if (!bird || !bird.caught || bird.swallowing) return
        const raf = requestAnimationFrame(() => setBird(prev => (prev && prev.id === bird.id ? { ...prev, swallowing: true } : prev)))
        return () => cancelAnimationFrame(raf)
    }, [bird?.caught])

    useEffect(() => {
        if (!bird) return
        if (bird.caught) {
            const t = setTimeout(() => setBird(null), 650)
            return () => clearTimeout(t)
        }
    }, [bird?.caught])

    // Vòng lặp vật lý và AI của Chim/Cá
    useEffect(() => {
        let rafId
        let lastTime = performance.now()

        const loop = (time) => {
            rafId = requestAnimationFrame(loop)
            const dt = (time - lastTime) / 1000
            lastTime = time
            if (dt > 0.1) return

            const pigEl = document.querySelector('.pig-container')
            const pigRect = pigEl?.getBoundingClientRect()

            const st = birdStateRef.current
            if (bird && !bird.caught && st && birdRef.current) {
                st.frameTimer += dt
                if (st.frameTimer > 1 / 12) {
                    st.frameTimer -= 1 / 12

                    if (st.phase === 'flyaway' || st.phase === 'foraging') {
                        const p = BIRD_GROUND_PHASES[st.phase]
                        st.frameIdx++
                        if (st.frameIdx > p.end) {
                            if (st.phase === 'foraging') {
                                // Mổ thóc lặp lại cho tới khi hết giờ (forageUntil)
                                st.frameIdx = p.start
                            } else {
                                // flyaway: chạy hết 1 lượt đi bộ -> cất cánh rồi quay lại tuần tra
                                st.frameIdx = p.end
                                st.phase = 'patrol'
                                st.frameIdx = BIRD_PHASES.patrol.start
                            }
                        }
                    } else {
                        const p = BIRD_PHASES[st.phase]
                        st.frameIdx++
                        if (st.frameIdx > p.end) {
                            if (st.phase === 'diving') st.frameIdx = p.end
                            else if (st.phase === 'catching') {
                                st.phase = 'rising'
                                st.frameIdx = BIRD_PHASES.rising.start
                            } else {
                                st.frameIdx = p.start
                            }
                        }
                    }
                }

                // Mổ thóc: đợi hết giờ forageUntil rồi cất cánh bay lên (dùng animation mới)
                if (st.phase === 'foraging' && Date.now() > (st.forageUntil || 0)) {
                    st.phase = 'flyaway'
                    st.frameIdx = BIRD_GROUND_PHASES.flyaway.start
                }

                if (st.phase === 'patrol') {
                    if (fishRef.current && !fish?.caught) {
                        const fishRect = fishRef.current.getBoundingClientRect()
                        if (Math.abs(st.x - (fishRect.left + fishRect.width / 2)) < 150) {
                            st.phase = 'diving'
                            st.frameIdx = BIRD_PHASES.diving.start
                            st.vy = 400
                            st.targetY = window.innerHeight * (1 - (waterLevelRef.current / 2) / 100)
                            st.targetGrain = false
                            st.targetPigletId = undefined
                        }
                    } else {
                        const followers = document.querySelectorAll('.pig-follower')
                        let targetPigletEl = null
                        for (const el of followers) {
                            const scale = parseFloat(el.getAttribute('data-scale') || '0.4')
                            if (scale <= 0.6) {
                                const rect = el.getBoundingClientRect()
                                if (Math.abs(st.x - (rect.left + rect.width / 2)) < 150) {
                                    targetPigletEl = el
                                    break
                                }
                            }
                        }

                        if (targetPigletEl) {
                            // Có heo con gần đó: ưu tiên bắt heo (65%), nhưng thỉnh thoảng
                            // lại đổi ý xà xuống mổ thóc thay vì bắt heo (35%, random).
                            st.phase = 'diving'
                            st.frameIdx = BIRD_PHASES.diving.start
                            st.vy = 400
                            st.targetY = window.innerHeight - 50
                            if (Math.random() < 0.65) {
                                st.targetGrain = false
                                st.targetPigletId = targetPigletEl.getAttribute('data-index')
                            } else {
                                st.targetPigletId = undefined
                                st.targetGrain = true
                            }
                        } else if (Date.now() > (st.nextGrainTime || 0)) {
                            // Không có heo con nào gần -> xà xuống mổ thóc
                            st.phase = 'diving'
                            st.frameIdx = BIRD_PHASES.diving.start
                            st.vy = 400
                            st.targetY = window.innerHeight - 50
                            st.targetPigletId = undefined
                            st.targetGrain = true
                            st.nextGrainTime = Date.now() + randomBetween(10000, 20000)
                        }
                    }
                } else if (st.phase === 'diving') {
                    let hitFish = false
                    let hitPiglet = false

                    if (fishRef.current && !fish?.caught && !st.targetGrain && st.targetPigletId === undefined) {
                        const bRect = birdRef.current.getBoundingClientRect()
                        const fRect = fishRef.current.getBoundingClientRect()

                        // Bám theo cá đang bơi (cả trục ngang lẫn độ sâu thực tế của cá),
                        // thay vì lặn thẳng xuống 1 độ sâu chung chung theo mực nước —
                        // tránh trường hợp "xà trượt" vì cá đã bơi sang chỗ khác.
                        const fCenterX = fRect.left + fRect.width / 2
                        const bCenterX = bRect.left + bRect.width / 2
                        st.vx = Math.sign(fCenterX - bCenterX || 1) * Math.max(Math.abs(st.vx), 200)
                        st.targetY = fRect.top + fRect.height / 2 - bRect.height / 2

                        const overlap = !(bRect.right < fRect.left || bRect.left > fRect.right || bRect.bottom < fRect.top || bRect.top > fRect.bottom)
                        if (overlap) {
                            hitFish = true
                            catchPrey(fish, setFish, fishRef, 'fish')
                            st.scale += 0.15
                        }
                    } else if (st.targetPigletId !== undefined) {
                        const followers = document.querySelectorAll('.pig-follower')
                        for (const el of followers) {
                            if (el.getAttribute('data-index') === st.targetPigletId) {
                                const rect = el.getBoundingClientRect()
                                const bRect = birdRef.current.getBoundingClientRect()

                                // Bám theo heo con (nó cũng di chuyển) cả trục ngang lẫn dọc.
                                const pCenterX = rect.left + rect.width / 2
                                const bCenterX = bRect.left + bRect.width / 2
                                st.vx = Math.sign(pCenterX - bCenterX || 1) * Math.max(Math.abs(st.vx), 200)
                                st.targetY = rect.top + rect.height / 2 - bRect.height / 2

                                const overlap = !(bRect.right < rect.left || bRect.left > rect.right || bRect.bottom < rect.top || bRect.top > rect.bottom)
                                if (overlap) {
                                    hitPiglet = true
                                    const pigletScale = parseFloat(el.getAttribute('data-scale') || '0.4')

                                    // Nhớ kèm theo hue của heo con để khi nhả ra nó vẫn giữ được màu
                                    const pigletHue = el.getAttribute('data-hue')
                                    st.pigletsEaten.push({ id: Math.random().toString(), scale: pigletScale, hue: pigletHue ? parseInt(pigletHue, 10) : 0 })

                                    window.dispatchEvent(new CustomEvent('bird-caught-follower', { detail: { index: parseInt(st.targetPigletId) } }))
                                    st.scale += 0.15
                                    st.targetPigletId = undefined
                                }
                                break
                            }
                        }
                    }

                    if (hitFish || hitPiglet) {
                        st.vy = 0
                        st.vx *= 0.5
                        st.phase = 'catching'
                        st.frameIdx = BIRD_PHASES.catching.start
                    } else if (st.targetGrain && st.y >= st.targetY) {
                        // Chạm đất để mổ thóc (không nhắm cá/heo con)
                        st.y = st.targetY
                        st.vy = 0
                        st.vx = 0
                        st.targetGrain = false
                        st.phase = 'foraging'
                        st.frameIdx = BIRD_GROUND_PHASES.foraging.start
                        st.forageUntil = Date.now() + 1200 + Math.random() * 800
                    } else if (st.y >= st.targetY) {
                        // Trượt mồi thật (cá/heo con đã biến mất trước khi kịp bắt) -> bay lên tay không
                        st.y = st.targetY
                        st.vy = 0
                        st.vx *= 0.5
                        st.targetPigletId = undefined
                        st.phase = 'flyaway'
                        st.frameIdx = BIRD_GROUND_PHASES.flyaway.start
                    }
                } else if (st.phase === 'rising') {
                    st.vy = -150
                    if (st.y < 50) {
                        st.vy = 0
                        st.phase = 'patrol'
                        st.frameIdx = BIRD_PHASES.patrol.start
                    }
                } else if (st.phase === 'flyaway') {
                    // Đi bộ rồi cất cánh (dùng animation bird-walk) -> bay lên lại độ cao tuần tra
                    st.vy = -140
                    st.vx = (st.fromLeft ? 1 : -1) * randomBetween(80, 120)
                    if (st.y < 80) {
                        st.vy = 0
                        st.phase = 'patrol'
                        st.frameIdx = BIRD_PHASES.patrol.start
                    }
                } else if (st.phase === 'foraging') {
                    // Đứng im cúi đầu mổ thóc, chuyển phase do khối forageUntil xử lý ở trên
                    st.vy = 0
                    st.vx = 0
                }

                st.x += st.vx * dt
                st.y += st.vy * dt

                if ((st.vx > 0 && st.x > window.innerWidth + 200) || (st.vx < 0 && st.x < -200)) {
                    setBird(null)
                } else {
                    const frameSet = st.phase === 'flyaway' ? BIRD_WALK_FRAMES
                        : st.phase === 'foraging' ? BIRD_PECK_FRAMES
                            : BIRD_FRAMES
                    birdRef.current.src = frameSet[st.frameIdx] || frameSet[0]
                    birdRef.current.style.transform = `translate(${st.x}px, ${st.y}px) scaleX(${st.fromLeft ? 1 : -1}) scale(${st.scale})`
                }

                if (pigRect) {
                    const birdRect = birdRef.current.getBoundingClientRect()
                    const overlap = !(birdRect.right < pigRect.left || birdRect.left > pigRect.right || birdRect.bottom < pigRect.top || birdRect.top > pigRect.bottom)

                    if (overlap) {
                        catchPrey(bird, setBird, birdRef, 'bird')
                    } else if (st.phase !== 'rising' && !bird.caught) {
                        const birdCenterX = birdRect.left + birdRect.width / 2;
                        const birdCenterY = birdRect.top + birdRect.height / 2;
                        const pigCenterX = pigRect.left + pigRect.width / 2;
                        const pigCenterY = pigRect.top + pigRect.height / 2;
                        const dx = birdCenterX - pigCenterX;
                        const dy = birdCenterY - pigCenterY;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < 220) {
                            st.phase = 'rising';
                            st.frameIdx = BIRD_PHASES.rising.start;
                            st.vy = -350;
                            st.vx = (dx > 0 ? 1 : -1) * (200 + Math.random() * 100);
                            st.fromLeft = st.vx > 0;
                            st.targetPigletId = undefined;
                            st.targetGrain = false;
                        }
                    }
                }
            }

            if (fish && !fish.caught && fishRef.current) {
                if (pigRect) {
                    const fishRect = fishRef.current.getBoundingClientRect()
                    const overlap = !(fishRect.right < pigRect.left || fishRect.left > pigRect.right || fishRect.bottom < pigRect.top || fishRect.top > pigRect.bottom)
                    if (overlap) {
                        catchPrey(fish, setFish, fishRef, 'fish')
                    }
                }
            }
        }

        rafId = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafId)
    }, [bird, fish])

    return (
        <>
            {fish && !fish.caught && (
                <img
                    ref={fishRef}
                    src={fishSprite}
                    title="Cá"
                    draggable={false}
                    style={{
                        position: 'absolute',
                        bottom: `${fish.bottomVh}vh`,
                        left: fish.fromLeft ? '-8%' : '108%',
                        width: '46px',
                        height: 'auto',
                        zIndex: 20,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        transform: fish.fromLeft ? 'scaleX(1)' : 'scaleX(-1)',
                        animation: `${fish.fromLeft ? 'fishSwimLTR' : 'fishSwimRTL'} ${fish.duration}s linear forwards`,
                        filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.3)) hue-rotate(${fish.hue}deg)`,
                    }}
                />
            )}
            {fish && fish.caught && fish.frozenLeft != null && (
                <img
                    src={fishSprite}
                    draggable={false}
                    style={{
                        position: 'fixed',
                        left: `${fish.swallowing ? fish.targetLeft : fish.frozenLeft}px`,
                        top: `${fish.swallowing ? fish.targetTop : fish.frozenTop}px`,
                        width: '46px',
                        height: 'auto',
                        zIndex: 20,
                        pointerEvents: 'none',
                        transform: `${fish.fromLeft ? 'scaleX(-1)' : 'scaleX(1)'} scale(${fish.swallowing ? 0.15 : 1})`,
                        opacity: fish.swallowing ? 0 : 1,
                        transition: 'left 0.45s ease-in, top 0.45s ease-in, transform 0.45s ease-in, opacity 0.45s ease-in 0.15s',
                        filter: `hue-rotate(${fish.hue}deg)`,
                    }}
                />
            )}

            {bird && !bird.caught && (
                <img
                    ref={birdRef}
                    title="Chim"
                    draggable={false}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '64px',
                        height: 'auto',
                        zIndex: 21,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        filter: `drop-shadow(0 4px 6px rgba(0,0,0,0.3)) hue-rotate(${birdStateRef.current?.hue}deg)`
                    }}
                />
            )}
            {bird && bird.caught && bird.frozenLeft != null && (
                <img
                    src={BIRD_FRAMES[BIRD_PHASES.patrol.start]}
                    draggable={false}
                    style={{
                        position: 'fixed',
                        left: `${bird.swallowing ? bird.targetLeft : bird.frozenLeft}px`,
                        top: `${bird.swallowing ? bird.targetTop : bird.frozenTop}px`,
                        width: '64px',
                        height: 'auto',
                        zIndex: 21,
                        pointerEvents: 'none',
                        transform: `${birdStateRef.current?.fromLeft ? 'scaleX(-1)' : 'scaleX(1)'} scale(${bird.swallowing ? 0.15 : birdStateRef.current?.scale || 1})`,
                        opacity: bird.swallowing ? 0 : 1,
                        transition: 'left 0.45s ease-in, top 0.45s ease-in, transform 0.45s ease-in, opacity 0.45s ease-in 0.15s',
                        filter: `hue-rotate(${birdStateRef.current?.hue}deg)`
                    }}
                />
            )}
        </>
    )
}