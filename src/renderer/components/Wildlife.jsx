import React, { useEffect, useState, useRef } from 'react'

// ─── Sprite cá bơi (pool mode) ───────────────────────────────────────────
import fishFrame1 from '../assets/Fish_swim_aligned/Fish1.png'
import fishFrame2 from '../assets/Fish_swim_aligned/Fish2.png'
import fishFrame3 from '../assets/Fish_swim_aligned/Fish3.png'
import fishFrame4 from '../assets/Fish_swim_aligned/Fish4.png'
import fishFrame5 from '../assets/Fish_swim_aligned/Fish5.png'
import fishFrame6 from '../assets/Fish_swim_aligned/Fish6.png'
import fishFrame7 from '../assets/Fish_swim_aligned/Fish7.png'
import fishFrame8 from '../assets/Fish_swim_aligned/Fish8.png'

const FISH_FRAMES = [fishFrame1, fishFrame2, fishFrame3, fishFrame4, fishFrame5, fishFrame6, fishFrame7, fishFrame8]

// ─── Sprite chim săn mồi (pool mode) ───────────────────────────────────────
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

            // Cá
            setFish(prev => {
                if (prev) return prev
                if (!poolMode || waterLevelRef.current < 15) return null
                if (now < nextFishTimeRef.current) return null

                const fromLeft = Math.random() < 0.5
                const duration = randomBetween(6, 11)
                const bottomVh = randomBetween(3, Math.max(6, waterLevelRef.current - 4))
                nextFishTimeRef.current = now + duration * 1000 + randomBetween(15000, 40000)

                const randomHue = Math.floor(Math.random() * 360)

                return { id: now, fromLeft, duration, bottomVh, caught: false, hue: randomHue }
            })

            // Chim
            setBird(prev => {
                if (prev) return prev
                if (!poolMode) return null
                if (now < nextBirdTimeRef.current) return null
                const fromLeft = Math.random() < 0.5
                nextBirdTimeRef.current = now + randomBetween(15000, 35000)

                const randomHue = Math.floor(Math.random() * 360)

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
                    hue: randomHue
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

                if (st.phase === 'patrol') {
                    if (fishRef.current && !fish?.caught) {
                        const fishRect = fishRef.current.getBoundingClientRect()
                        if (Math.abs(st.x - (fishRect.left + fishRect.width / 2)) < 150) {
                            st.phase = 'diving'
                            st.frameIdx = BIRD_PHASES.diving.start
                            st.vy = 400
                            st.targetY = window.innerHeight * (1 - (waterLevelRef.current / 2) / 100)
                        }
                    } else {
                        const followers = document.querySelectorAll('.pig-follower')
                        for (const el of followers) {
                            const scale = parseFloat(el.getAttribute('data-scale') || '0.4')
                            if (scale <= 0.6) {
                                const rect = el.getBoundingClientRect()
                                if (Math.abs(st.x - (rect.left + rect.width / 2)) < 150) {
                                    st.phase = 'diving'
                                    st.frameIdx = BIRD_PHASES.diving.start
                                    st.vy = 400
                                    st.targetY = window.innerHeight - 50
                                    st.targetPigletId = el.getAttribute('data-index')
                                    break
                                }
                            }
                        }
                    }
                } else if (st.phase === 'diving') {
                    let hitFish = false
                    let hitPiglet = false

                    if (fishRef.current && !fish?.caught) {
                        const bRect = birdRef.current.getBoundingClientRect()
                        const fRect = fishRef.current.getBoundingClientRect()
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
                                const overlap = !(bRect.right < rect.left || bRect.left > rect.right || bRect.bottom < rect.top || bRect.top > rect.bottom)
                                if (overlap) {
                                    hitPiglet = true
                                    const pigletScale = parseFloat(el.getAttribute('data-scale') || '0.4')
                                    st.pigletsEaten.push({ id: Math.random().toString(), scale: pigletScale })
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
                    } else if (st.y >= st.targetY) {
                        st.y = st.targetY
                        st.vy = 0
                        st.vx *= 0.5
                        st.phase = 'rising'
                        st.frameIdx = BIRD_PHASES.rising.start
                    }
                } else if (st.phase === 'rising') {
                    st.vy = -150
                    if (st.y < 50) {
                        st.vy = 0
                        st.phase = 'patrol'
                        st.frameIdx = BIRD_PHASES.patrol.start
                    }
                }

                st.x += st.vx * dt
                st.y += st.vy * dt

                if ((st.vx > 0 && st.x > window.innerWidth + 200) || (st.vx < 0 && st.x < -200)) {
                    setBird(null)
                } else {
                    birdRef.current.src = BIRD_FRAMES[st.frameIdx]
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
            {/* ─── CÁ ĐANG BƠI ─── */}
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
            {/* ─── CÁ BỊ NUỐT ─── */}
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

            {/* ─── CHIM ĐANG BAY ─── */}
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
            {/* ─── CHIM BỊ NUỐT ─── */}
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