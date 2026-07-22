import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const isElectron = typeof window !== 'undefined' && window.pigAPI

const ANIMATION_STATES = [
  { key: 'idle', defaultFps: 2 },
  { key: 'walking', defaultFps: 6 },
  { key: 'sniffing', defaultFps: 2 },
  { key: 'eating', defaultFps: 6 },
  { key: 'full', defaultFps: 2 },
  { key: 'sleeping', defaultFps: 1.5 },
  { key: 'scared', defaultFps: 1 },
  { key: 'drag_held', defaultFps: 1 },
  { key: 'drag_falling', defaultFps: 1 },
  { key: 'drag_landed', defaultFps: 1 },
  { key: 'diving_float', defaultFps: 1 },
  { key: 'diving_down', defaultFps: 6 },
  { key: 'diving_up', defaultFps: 1 },
  { key: 'diving_bottom', defaultFps: 6 },
  { key: 'drowning', defaultFps: 6 },
  { key: 'drowning_sink', defaultFps: 1 },
  { key: 'drowning_bottom', defaultFps: 1 },
  { key: 'struggling', defaultFps: 6 },
]

export default function CustomCharacterPanel({ onClose, onSaved }) {
  const { t } = useTranslation()
  const [config, setConfig] = useState({})
  const [imagePreviews, setImagePreviews] = useState({})
  const [activeTab, setActiveTab] = useState('idle')
  const [saving, setSaving] = useState(false)

  // Load existing settings
  useEffect(() => {
    async function loadConfig() {
      if (isElectron) {
        const s = await window.pigAPI.getSettings()
        const currentCustom = s.customCharacter || {}
        
        // Ensure all states exist
        const initial = {}
        ANIMATION_STATES.forEach(st => {
          initial[st.key] = {
            frames: currentCustom[st.key]?.frames || [],
            fps: currentCustom[st.key]?.fps ?? st.defaultFps,
            loop: currentCustom[st.key]?.loop ?? true
          }
        })
        setConfig(initial)
      }
    }
    loadConfig()
  }, [])

  // Load base64 previews for active tab frames
  useEffect(() => {
    async function loadPreviews() {
      if (!isElectron || !config[activeTab]) return
      const paths = config[activeTab].frames || []
      const previews = {}
      for (const p of paths) {
        if (p.startsWith('data:') || p.startsWith('http')) {
          previews[p] = p
        } else {
          const b64 = await window.pigAPI.readImageFile(p)
          if (b64) previews[p] = b64
        }
      }
      setImagePreviews(prev => ({ ...prev, ...previews }))
    }
    loadPreviews()
  }, [activeTab, config])

  const handleSelectFrames = async (stateKey) => {
    if (!isElectron) return
    const filePaths = await window.pigAPI.selectCharacterFrames()
    if (!filePaths || filePaths.length === 0) return

    setConfig(prev => {
      const currentFrames = prev[stateKey]?.frames || []
      // Combined & capped at 10 frames
      const combined = [...currentFrames, ...filePaths].slice(0, 10)
      return {
        ...prev,
        [stateKey]: {
          ...(prev[stateKey] || { fps: 2, loop: true }),
          frames: combined
        }
      }
    })
  }

  const handleRemoveFrame = (stateKey, index) => {
    setConfig(prev => {
      const currentFrames = [...(prev[stateKey]?.frames || [])]
      currentFrames.splice(index, 1)
      return {
        ...prev,
        [stateKey]: {
          ...prev[stateKey],
          frames: currentFrames
        }
      }
    })
  }

  const handleClearFrames = (stateKey) => {
    setConfig(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        frames: []
      }
    }))
  }

  const handleFpsChange = (stateKey, fpsVal) => {
    const fps = parseFloat(fpsVal) || 1
    setConfig(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        fps: Math.max(0.5, Math.min(30, fps))
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    if (isElectron) {
      const currentSettings = await window.pigAPI.getSettings()
      await window.pigAPI.saveSettings({
        ...currentSettings,
        customCharacter: config
      })
    }
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const currentStateConfig = config[activeTab] || { frames: [], fps: 2, loop: true }
  const currentFrames = currentStateConfig.frames || []

  return (
    <div className="cache-panel-overlay" onClick={onClose}>
      <div className="cache-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', height: '620px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎨 {t('customCharacter.title')}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, gap: '15px', minHeight: 0 }}>
          
          {/* Sidebar Tabs for 18 States */}
          <div style={{ width: '240px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '6px' }}>
            {ANIMATION_STATES.map(st => {
              const frameCount = (config[st.key]?.frames || []).length
              const isActive = activeTab === st.key
              return (
                <button
                  key={st.key}
                  onClick={() => setActiveTab(st.key)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    marginBottom: '4px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isActive ? 'rgba(120, 80, 220, 0.4)' : 'transparent',
                    color: isActive ? '#fff' : '#ccc',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t(`customCharacter.states.${st.key}`)}>{st.key}</span>
                  <span style={{ fontSize: '10px', opacity: 0.7, background: frameCount > 0 ? '#2a6' : '#555', padding: '2px 6px', borderRadius: '10px', color: '#fff' }}>
                    {frameCount}/10
                  </span>
                </button>
              )
            })}
          </div>

          {/* Main Config Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '15px', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#fff', fontSize: '15px' }}>
              {t('customCharacter.state')}: <span style={{ color: '#a7f' }}>{activeTab}</span> <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>({t(`customCharacter.states.${activeTab}`)})</span>
            </h3>

            {/* Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSelectFrames(activeTab)}
                disabled={currentFrames.length >= 10}
                style={{
                  background: currentFrames.length >= 10 ? '#555' : '#7289da',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: currentFrames.length >= 10 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                📂 {t('customCharacter.addFrames')}
              </button>

              {currentFrames.length > 0 && (
                <button
                  onClick={() => handleClearFrames(activeTab)}
                  style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  🗑️ {t('customCharacter.clearAllFrames')}
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#eee', marginLeft: 'auto' }}>
                <span>FPS:</span>
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={currentStateConfig.fps}
                  onChange={e => handleFpsChange(activeTab, e.target.value)}
                  style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff', textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Frame List Thumbnails */}
            <div style={{ flex: 1, minHeight: '180px', marginBottom: '15px' }}>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                {t('customCharacter.frameList')} ({currentFrames.length}/10):
              </div>
              {currentFrames.length === 0 ? (
                <div
                  style={{ padding: '30px', textAlign: 'center', color: '#777', border: '2px dashed #444', borderRadius: '8px', fontSize: '13px' }}
                  dangerouslySetInnerHTML={{ __html: t('customCharacter.noFramesYet') }}
                />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {currentFrames.map((framePath, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', background: '#111', borderRadius: '6px', border: '1px solid #444', overflow: 'hidden' }}>
                      <img
                        src={imagePreviews[framePath] || ''}
                        alt={`Frame ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: imagePreviews[framePath] ? 'block' : 'none' }}
                      />
                      <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '3px' }}>
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() => handleRemoveFrame(activeTab, idx)}
                        style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(200,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '10px', lineHeight: '18px', textAlign: 'center' }}
                        title={t('customCharacter.deleteFrame')}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Animation Preview Box */}
            {currentFrames.length > 0 && (
              <div style={{ background: '#1a1a24', padding: '10px', borderRadius: '8px', border: '1px solid #334', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>{t('customCharacter.livePreview')}:</span>
                <AnimationPreview frames={currentFrames} fps={currentStateConfig.fps} previews={imagePreviews} />
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#444', color: '#fff', cursor: 'pointer', transition: 'background 0.2s' }}>
            {t('customCharacter.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', background: 'linear-gradient(90deg, #7850dc, #a7f)', color: '#fff', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? t('customCharacter.saving') : t('customCharacter.saveAndDone')}
          </button>
        </div>

      </div>
    </div>
  )
}

// Subcomponent: Animated Preview Player
function AnimationPreview({ frames, fps, previews }) {
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    if (!frames || frames.length === 0) return
    const intervalMs = 1000 / (fps || 2)
    const timer = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % frames.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [frames, fps])

  const currentPath = frames[frameIdx % frames.length]
  const src = previews[currentPath] || ''

  return (
    <div style={{ width: '60px', height: '60px', background: '#000', borderRadius: '6px', border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <img src={src} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: src ? 'block' : 'none' }} />
    </div>
  )
}
