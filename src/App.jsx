import { useState, useRef, useEffect, useCallback } from 'react'

// ─── STORAGE KEYS ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'kalyana_history'
const MAX_STORED = 60 // messages to keep in localStorage

// ─── LOCAL STORAGE HELPERS ───────────────────────────────────────────────────
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(msgs) {
  try {
    const trimmed = msgs.slice(-MAX_STORED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {}
}

function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
  @keyframes flicker {
    0%,100%{opacity:1;transform:translateX(-50%) scale(1)}
    33%{opacity:.85;transform:translateX(-50%) scale(1.05)}
    66%{opacity:.95;transform:translateX(-50%) scale(.97)}
  }
  @keyframes float {
    0%,100%{transform:translateY(0)}
    50%{transform:translateY(-7px)}
  }
  @keyframes fadeUp {
    from{opacity:0;transform:translateY(14px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes pulseDot {
    0%,100%{opacity:.3;transform:scale(.8)}
    50%{opacity:1;transform:scale(1.1)}
  }
  .fade-up { animation: fadeUp .45s ease both; }
  .enter-btn:hover {
    background: rgba(200,169,110,.09) !important;
    border-color: rgba(200,169,110,.85) !important;
    box-shadow: 0 0 22px rgba(200,169,110,.15);
  }
  .send-btn:hover:not(:disabled) {
    background: rgba(200,169,110,.25) !important;
  }
  .send-btn:disabled { opacity:.3; cursor:not-allowed; }
  .end-btn:hover { border-color:rgba(200,169,110,.5)!important; color:#c8a96e!important; }
  .clear-btn:hover { color:#c8800a!important; }
  textarea:focus { border-color:rgba(200,169,110,.4)!important; }
  textarea::placeholder { color:#3a5033; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(200,169,110,.18); border-radius:2px; }

  .citation {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(200,169,110,.15);
    font-size: 13px;
    font-style: italic;
    color: #7a9070;
    line-height: 1.5;
  }
  .citation a { color: #8faa6a; text-decoration: underline; text-underline-offset: 2px; }
`

// ─── TINY COMPONENTS ─────────────────────────────────────────────────────────
function Dots() {
  return (
    <span style={{ display:'inline-flex', gap:4, alignItems:'center', padding:'2px 0' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:6, height:6, borderRadius:'50%', background:'#c8a96e',
          display:'inline-block',
          animation:'pulseDot 1.2s ease-in-out infinite',
          animationDelay:`${i*.2}s`
        }}/>
      ))}
    </span>
  )
}

function Lotus({ size = 44 }) {
  return <span style={{ fontSize: size }}>𑁍</span>
}

// ─── PARSE CITATION from response ────────────────────────────────────────────
// The API returns text with an optional citation block after "—" on a new line
function parseResponse(text) {
  if (!text) return { main: '', citation: '' }
  const parts = text.split(/\n\s*—\s*\n/)
  if (parts.length >= 2) {
    return { main: parts[0].trim(), citation: parts.slice(1).join('\n—\n').trim() }
  }
  return { main: text.trim(), citation: '' }
}

function renderCitation(citation) {
  if (!citation) return null
  // Simple URL detection and linking
  const linked = citation.replace(
    /(https?:\/\/[^\s)]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  )
  return <div className="citation" dangerouslySetInnerHTML={{ __html: linked }} />
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState('enter')   // enter | chat | closed
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  // Load history on mount
  useEffect(() => {
    const history = loadHistory()
    if (history.length > 0) {
      setMessages(history)
    }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // ── API CALL ────────────────────────────────────────────────────────────────
  const callGuide = useCallback(async (history, overrideContent = null) => {
    const msgs = overrideContent
      ? [...history, { role: 'user', content: overrideContent }]
      : history

    const res = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs })
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || 'Network error')
    }

    const data = await res.json()
    return data.content?.[0]?.text || ''
  }, [])

  // ── BEGIN SESSION ───────────────────────────────────────────────────────────
  const beginSession = async () => {
    setPhase('chat')
    setError('')

    // If we have existing history, just show it — don't re-greet
    const history = loadHistory()
    if (history.length > 0) {
      setMessages(history)
      return
    }

    setLoading(true)
    try {
      const reply = await callGuide([], 'Begin the session. Greet me briefly and ask what I am carrying.')
      const first = [{ role: 'assistant', content: reply }]
      setMessages(first)
      saveHistory(first)
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Come. Sit. What is it you are carrying today?' }])
    }
    setLoading(false)
  }

  // ── SEND MESSAGE ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    saveHistory(newHistory)
    setInput('')
    setError('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)
    try {
      const reply = await callGuide(newHistory)
      const updated = [...newHistory, { role: 'assistant', content: reply }]
      setMessages(updated)
      saveHistory(updated)
    } catch (e) {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // ── END SESSION ─────────────────────────────────────────────────────────────
  const endSession = async () => {
    if (loading) return
    setLoading(true)
    try {
      const closing = await callGuide(
        messages,
        'The user is ending the session. Offer a brief closing — 2 sentences maximum. Something to carry into the day. Do not say goodbye effusively.'
      )
      const updated = [...messages, { role: 'assistant', content: closing, closing: true }]
      setMessages(updated)
      saveHistory(updated)
    } catch {
      const updated = [...messages, { role: 'assistant', content: 'Go well. The practice continues whether you are sitting or not.', closing: true }]
      setMessages(updated)
      saveHistory(updated)
    }
    setLoading(false)
    setPhase('closed')
  }

  // ── CLEAR HISTORY ───────────────────────────────────────────────────────────
  const startFresh = () => {
    clearHistory()
    setMessages([])
    setPhase('enter')
  }

  // ── TEXTAREA RESIZE ─────────────────────────────────────────────────────────
  const handleTextarea = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <style>{css}</style>

      {/* Atmospheric layers */}
      <div style={s.grain} />
      <div style={s.vignette} />
      <div style={s.candle} />

      {/* ── ENTER SCREEN ── */}
      {phase === 'enter' && (
        <div style={s.enterScreen} className="fade-up">
          <div style={{ ...s.lotus, animation: 'float 6s ease-in-out infinite' }}>
            <Lotus size={52} />
          </div>
          <h1 style={s.title}>Kalyana</h1>
          <p style={s.subtitle}>kaly&#x101;&#x1e47;amitta · Dhamma guide</p>
          <div style={s.hairline} />
          <p style={s.tagline}>
            Come as you are.<br />
            There is nothing to prepare.
          </p>
          <button className="enter-btn" style={s.enterBtn} onClick={beginSession}>
            Enter the Sala
          </button>
          {loadHistory().length > 0 && (
            <button className="clear-btn" style={s.clearBtn} onClick={startFresh}>
              Begin fresh session
            </button>
          )}
          <p style={s.footNote}>Your conversation is remembered on this device</p>
        </div>
      )}

      {/* ── CHAT SCREEN ── */}
      {(phase === 'chat' || phase === 'closed') && (
        <div style={s.chatScreen}>

          {/* Header */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <span style={s.headerLotus}><Lotus size={20} /></span>
              <span style={s.headerTitle}>Kalyana</span>
            </div>
            <div style={s.headerRight}>
              {phase === 'chat' && (
                <button className="end-btn" style={s.endBtn} onClick={endSession} disabled={loading}>
                  End session
                </button>
              )}
              <button className="clear-btn" style={s.clearSmallBtn} onClick={startFresh} title="Clear history">
                ↺
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={s.messages} ref={scrollRef}>
            <div style={{ height: 12 }} />

            {messages.map((msg, i) => {
              const { main, citation } = parseResponse(msg.content)
              const isUser = msg.role === 'user'
              return (
                <div key={i} className="fade-up" style={{
                  ...s.msgRow,
                  justifyContent: isUser ? 'flex-end' : 'flex-start'
                }}>
                  {!isUser && <div style={s.avatar}><Lotus size={15} /></div>}
                  <div style={{
                    ...s.bubble,
                    ...(isUser ? s.userBubble : s.guideBubble),
                    ...(msg.closing ? s.closingBubble : {})
                  }}>
                    {msg.closing && <div style={s.closingRule} />}
                    <span style={isUser ? s.userText : s.guideText}>{main}</span>
                    {!isUser && renderCitation(citation)}
                    {msg.closing && <div style={{ ...s.closingRule, marginTop: 10, marginBottom: 0 }} />}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div style={{ ...s.msgRow, justifyContent: 'flex-start' }} className="fade-up">
                <div style={s.avatar}><Lotus size={15} /></div>
                <div style={{ ...s.bubble, ...s.guideBubble }}><Dots /></div>
              </div>
            )}

            {error && (
              <p style={s.errorMsg}>{error}</p>
            )}

            {phase === 'closed' && !loading && (
              <div style={s.closedBlock} className="fade-up">
                <p style={s.closedText}>
                  The sala is still.<br />
                  You may return whenever you are ready.
                </p>
                <button className="enter-btn" style={{ ...s.enterBtn, marginTop: 20, fontSize: 15 }} onClick={() => setPhase('chat')}>
                  Return
                </button>
                <button className="clear-btn" style={{ ...s.clearBtn, marginTop: 8 }} onClick={startFresh}>
                  Begin fresh session
                </button>
              </div>
            )}

            <div style={{ height: 16 }} />
          </div>

          {/* Input */}
          {phase === 'chat' && (
            <div style={s.inputArea}>
              <div style={s.inputRow}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextarea}
                  onKeyDown={handleKeyDown}
                  placeholder="Speak freely…"
                  style={s.textarea}
                  rows={1}
                  disabled={loading}
                />
                <button
                  className="send-btn"
                  style={s.sendBtn}
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                >
                  ↑
                </button>
              </div>
              <p style={s.inputHint}>Enter to send · Shift+Enter for new line</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  root: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
    height: '100dvh',
    background: '#0f1a0e',
    fontFamily: "'Crimson Text', Georgia, serif",
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  grain: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.07'/%3E%3C/svg%3E")`,
    opacity: 0.5,
  },
  vignette: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
    background: 'radial-gradient(ellipse at 50% 25%, transparent 20%, rgba(4,9,4,.65) 100%)',
  },
  candle: {
    position: 'fixed', top: -90, left: '50%', transform: 'translateX(-50%)',
    width: 320, height: 320, pointerEvents: 'none', zIndex: 1,
    background: 'radial-gradient(circle, rgba(200,169,110,.13) 0%, transparent 70%)',
    animation: 'flicker 4.5s ease-in-out infinite',
  },

  // Enter screen
  enterScreen: {
    position: 'relative', zIndex: 2, flex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '40px 32px', textAlign: 'center',
  },
  lotus: {
    marginBottom: 18,
    filter: 'drop-shadow(0 0 18px rgba(200,169,110,.5))',
  },
  title: {
    fontFamily: "'IM Fell English', Georgia, serif",
    fontSize: 54, fontWeight: 400, color: '#e8d5a3',
    margin: '0 0 6px', letterSpacing: '0.05em',
    textShadow: '0 0 40px rgba(200,169,110,.3)',
  },
  subtitle: {
    fontSize: 13, color: '#7a8f70', letterSpacing: '0.14em',
    textTransform: 'uppercase', margin: '0 0 26px',
  },
  hairline: {
    width: 40, height: 1, marginBottom: 26,
    background: 'linear-gradient(90deg, transparent, #c8a96e, transparent)',
  },
  tagline: {
    fontSize: 20, lineHeight: 1.75, color: '#a8b89a',
    marginBottom: 38, fontStyle: 'italic',
  },
  enterBtn: {
    background: 'transparent',
    border: '1px solid rgba(200,169,110,.5)',
    color: '#c8a96e', padding: '14px 36px',
    fontSize: 17, fontFamily: "'Crimson Text', Georgia, serif",
    letterSpacing: '0.07em', cursor: 'pointer', borderRadius: 2,
    transition: 'all .3s', marginBottom: 14,
  },
  clearBtn: {
    background: 'transparent', border: 'none',
    color: '#4a6040', fontSize: 13,
    fontFamily: "'Crimson Text', Georgia, serif",
    cursor: 'pointer', transition: 'color .2s', padding: '4px 0',
  },
  footNote: { fontSize: 12, color: '#3a5033', marginTop: 18, letterSpacing: '0.04em' },

  // Chat screen
  chatScreen: {
    position: 'relative', zIndex: 2, flex: 1,
    display: 'flex', flexDirection: 'column', height: '100dvh',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px 12px',
    borderBottom: '1px solid rgba(200,169,110,.1)',
    background: 'rgba(9,16,9,.85)', backdropFilter: 'blur(12px)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  headerLotus: { filter: 'drop-shadow(0 0 8px rgba(200,169,110,.4))' },
  headerTitle: {
    fontFamily: "'IM Fell English', Georgia, serif",
    fontSize: 22, color: '#e8d5a3', letterSpacing: '0.05em',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  endBtn: {
    background: 'transparent',
    border: '1px solid rgba(200,169,110,.22)',
    color: '#8fa882', padding: '5px 13px',
    fontSize: 12, fontFamily: "'Crimson Text', Georgia, serif",
    letterSpacing: '0.05em', cursor: 'pointer', borderRadius: 2,
    transition: 'all .25s',
  },
  clearSmallBtn: {
    background: 'transparent', border: 'none',
    color: '#3a5033', fontSize: 18, cursor: 'pointer',
    transition: 'color .2s', lineHeight: 1, padding: '2px 4px',
  },

  messages: {
    flex: 1, overflowY: 'auto', padding: '0 14px', scrollBehavior: 'smooth',
  },
  msgRow: {
    display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 13,
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(200,169,110,.08)',
    border: '1px solid rgba(200,169,110,.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
    filter: 'drop-shadow(0 0 6px rgba(200,169,110,.25))',
  },
  bubble: {
    maxWidth: '78%', padding: '11px 15px', borderRadius: 11, lineHeight: 1.65,
  },
  guideBubble: {
    background: 'rgba(28,43,26,.82)',
    border: '1px solid rgba(200,169,110,.11)',
    borderBottomLeftRadius: 3,
  },
  userBubble: {
    background: 'rgba(48,68,42,.72)',
    border: '1px solid rgba(120,160,100,.14)',
    borderBottomRightRadius: 3,
  },
  closingBubble: {
    background: 'rgba(38,33,14,.92)',
    border: '1px solid rgba(200,169,110,.24)',
    textAlign: 'center', maxWidth: '88%', margin: '0 auto',
  },
  closingRule: {
    width: 28, height: 1, margin: '0 auto 10px',
    background: 'linear-gradient(90deg, transparent, #c8a96e, transparent)',
  },
  guideText: { fontSize: 18, color: '#d4c49a', fontStyle: 'italic' },
  userText: { fontSize: 16, color: '#a8c49a' },

  closedBlock: { textAlign: 'center', padding: '28px 20px' },
  closedText: {
    fontSize: 16, lineHeight: 1.8, fontStyle: 'italic',
    color: '#8fa882', marginBottom: 4,
  },

  errorMsg: {
    textAlign: 'center', color: '#a05040', fontSize: 14,
    fontStyle: 'italic', padding: '8px 20px',
  },

  inputArea: {
    padding: '11px 14px 20px',
    borderTop: '1px solid rgba(200,169,110,.08)',
    background: 'rgba(7,13,7,.92)', flexShrink: 0,
  },
  inputRow: { display: 'flex', gap: 9, alignItems: 'flex-end' },
  textarea: {
    flex: 1, background: 'rgba(22,36,20,.85)',
    border: '1px solid rgba(200,169,110,.14)',
    borderRadius: 8, padding: '11px 13px',
    color: '#c8d8b8', fontSize: 16,
    fontFamily: "'Crimson Text', Georgia, serif",
    resize: 'none', outline: 'none', lineHeight: 1.5,
    overflowY: 'hidden', transition: 'border-color .2s',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(200,169,110,.14)',
    border: '1px solid rgba(200,169,110,.28)',
    color: '#c8a96e', fontSize: 20, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all .2s', fontFamily: 'sans-serif',
  },
  inputHint: {
    fontSize: 11, color: '#3a5033', marginTop: 6,
    textAlign: 'center', letterSpacing: '0.03em',
  },
}
