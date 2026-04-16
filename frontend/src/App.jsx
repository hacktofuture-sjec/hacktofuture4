import React, { useState, useEffect, useCallback, useRef } from 'react'

const API = ''   // uses Vite proxy — requests to /api go to localhost:8000

/* ── Category badge class helper ─────────────────────────────────────────── */
function catClass(cat) {
  const map = {
    Healthcare: 'cat-healthcare', Logistics: 'cat-logistics',
    FinTech: 'cat-fintech', SaaS: 'cat-saas',
    AgriTech: 'cat-agritech', Education: 'cat-education',
    Energy: 'cat-energy', Manufacturing: 'cat-manufacturing',
    HR: 'cat-hr',
  }
  return map[cat] || 'cat-other'
}

/* ── Relative time ────────────────────────────────────────────────────────── */
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ── Log time ─────────────────────────────────────────────────────────────── */
function logTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/* ══════════════════════════════════════════════════════════════════════════
   PROBLEM CARD
══════════════════════════════════════════════════════════════════════════ */
function ProblemCard({ problem, onOpen }) {
  const isNew = (Date.now() - new Date(problem.created_at).getTime()) < 3600000 * 3

  return (
    <div className="card" onClick={() => onOpen(problem)}>
      <div className="card-top">
        <div className="card-badges">
          <span className={`badge badge-category ${catClass(problem.category)}`}>
            {problem.category}
          </span>
          {isNew && <span className="badge badge-new">New</span>}
        </div>
      </div>

      <h3 className="card-title">{problem.title}</h3>

      <div className="card-meta">
        <span>📰 {problem.source_name || 'Unknown'}</span>
        <span>·</span>
        <span>{relativeTime(problem.created_at)}</span>
      </div>

      <p className="card-preview">
        Click to explore the full problem analysis, solution blueprint,
        open-source architecture, build plan, and downloadable starter code.
      </p>

      <div className="card-footer">
        <span className="download-count">
          ⬇ {problem.download_count} downloads
        </span>
        <button
          className="btn btn-download btn-sm"
          onClick={e => { e.stopPropagation(); window.location.href = `/api/problems/${problem.id}/download` }}
        >
          Download ZIP
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PROCESSING PANEL
══════════════════════════════════════════════════════════════════════════ */
function ProcessingPanel({ status }) {
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [status.logs])

  if (!status.is_running && (!status.logs || status.logs.length === 0)) return null

  return (
    <div className="processing-panel">
      <div className="processing-header">
        {status.is_running && <div className="spinner" />}
        <h3>
          {status.is_running
            ? `Generating packages… (${status.completed}/${status.total || '?'})`
            : 'Last run complete'}
        </h3>
        {status.is_running && (
          <span style={{ color: 'var(--purple-l)', fontSize: '0.85rem', marginLeft: 'auto' }}>
            {status.progress}%
          </span>
        )}
      </div>

      {status.is_running && (
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${status.progress}%` }} />
        </div>
      )}

      <div className="log-feed">
        {(status.logs || []).map((log, i) => (
          <div key={i} className={`log-line ${log.level || 'info'}`}>
            <span className="ts">{logTime(log.ts)}</span>
            <span className="msg">{log.msg}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PROBLEM MODAL
══════════════════════════════════════════════════════════════════════════ */
const TABS = [
  { key: 'article', label: '📰 Article' },
  { key: 'problem', label: '🔍 Problem' },
  { key: 'solution', label: '💡 Solution' },
  { key: 'architecture', label: '🏗 Architecture' },
  { key: 'implementation', label: '⚙ Build Plan' },
  { key: 'monetization', label: '💰 Monetize' },
]

function ProblemModal({ problem, onClose }) {
  const [activeTab, setActiveTab] = useState('article')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/problems/${problem.id}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [problem.id])

  function getContent() {
    if (!detail) return ''
    const map = {
      article:        detail.article_md,
      problem:        detail.problem_txt,
      solution:       detail.solution_txt,
      architecture:   detail.architecture_txt,
      implementation: detail.implementation_plan_txt,
      monetization:   detail.monetization_txt,
    }
    return map[activeTab] || 'Content not available.'
  }

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div style={{ marginBottom: 8 }}>
              <span className={`badge badge-category ${catClass(problem.category)}`}>
                {problem.category}
              </span>
            </div>
            <h2 className="modal-title">{problem.title}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {loading
            ? <p className="text-muted" style={{ textAlign: 'center', padding: 40 }}>Loading…</p>
            : <pre className="doc-content">{getContent()}</pre>
          }
        </div>

        <div className="modal-footer">
          <div className="modal-meta">
            Source: {problem.source_name} · {relativeTime(problem.created_at)} · {problem.download_count} downloads
          </div>
          <a
            className="btn btn-download"
            href={`/api/problems/${problem.id}/download`}
            onClick={() => { setTimeout(onClose, 500) }}
          >
            ⬇ Download ZIP
          </a>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [problems, setProblems]   = useState([])
  const [status, setStatus]       = useState({ is_running: false, logs: [], progress: 0 })
  const [selected, setSelected]   = useState(null)
  const [fetching, setFetching]   = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const pollRef = useRef(null)

  /* ── Load problems ──────────────────────────────────────────────────── */
  const loadProblems = useCallback(async () => {
    try {
      const r = await fetch('/api/problems')
      const data = await r.json()
      setProblems(data)
      setLastRefresh(new Date())
    } catch {/* backend not ready yet */}
  }, [])

  /* ── Poll status while running ──────────────────────────────────────── */
  const pollStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/news/status')
      const s = await r.json()
      setStatus(s)
      if (!s.is_running) {
        clearInterval(pollRef.current)
        setFetching(false)
        loadProblems()
      }
    } catch {/* ignore */}
  }, [loadProblems])

  useEffect(() => {
    loadProblems()
  }, [loadProblems])

  /* ── Trigger news fetch ─────────────────────────────────────────────── */
  async function handleFetch() {
    setFetching(true)
    setStatus({ is_running: true, logs: [], progress: 0, total: 0, completed: 0 })
    try {
      await fetch('/api/news/fetch', { method: 'POST' })
      pollRef.current = setInterval(pollStatus, 2000)
    } catch {
      setFetching(false)
      alert('Backend unreachable. Make sure the server is running on port 8000.')
    }
  }

  /* ── Delete problem ─────────────────────────────────────────────────── */
  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Remove this problem package?')) return
    await fetch(`/api/problems/${id}`, { method: 'DELETE' })
    loadProblems()
  }

  const categoryCount = {}
  problems.forEach(p => { categoryCount[p.category] = (categoryCount[p.category] || 0) + 1 })

  return (
    <div className="page">
      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <a className="navbar-brand" href="/">
            <span className="brand-dot" />
            Startup Problem Marketplace
          </a>
          <div className="navbar-stats">
            <div className="stat-badge">
              <span>{problems.length}</span> packages
            </div>
            <div className="stat-badge">
              <span>{Object.keys(categoryCount).length}</span> categories
            </div>
            {lastRefresh && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                Updated {relativeTime(lastRefresh.toISOString())}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            ⚡ AI-Powered · Open Source · Locally Hosted
          </div>
          <h1>
            Turn Today's News Into<br />Startup Problem Packages
          </h1>
          <p>
            Pull live business news, let Llama 3 extract real problems, and
            download ZIP kits with full analysis, architecture, and starter code.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              onClick={handleFetch}
              disabled={fetching || status.is_running}
            >
              {(fetching || status.is_running) ? (
                <><span className="spinner" /> Generating…</>
              ) : (
                <> Fetch Latest News</>
              )}
            </button>
            <button className="btn btn-secondary" onClick={loadProblems}>
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="container" style={{ flex: 1 }}>

        {/* Processing panel */}
        <ProcessingPanel status={status} />

        {/* Section header */}
        <div className="section-header">
          <h2 className="section-title">
            Problem Packages
            {problems.length > 0 && (
              <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: '0.85rem', marginLeft: 10 }}>
                ({problems.length})
              </span>
            )}
          </h2>
        </div>

        {/* Grid */}
        <div className="grid">
          {problems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🚀</div>
              <h3>No packages yet</h3>
              <p>
                Click "Fetch Latest News" to pull live RSS articles and let
                Llama 3 generate startup problem packages from them.
              </p>
              <button className="btn btn-primary" onClick={handleFetch} disabled={fetching}>
                {fetching ? <><span className="spinner" /> Working…</> : ' Fetch Latest News'}
              </button>
            </div>
          ) : (
            problems.map(p => (
              <div key={p.id} style={{ position: 'relative' }}>
                <ProblemCard problem={p} onOpen={setSelected} />
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}
                  title="Delete"
                  onClick={e => handleDelete(p.id, e)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {selected && (
        <ProblemModal problem={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
