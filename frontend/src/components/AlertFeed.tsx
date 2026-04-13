"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { feedState } from "@/lib/feedState"

interface Alert {
  id:         string
  type:       string
  message:    string
  risk_level: string
  risk_score: number
  language:   string
  verdict:    string
  time:       string
  indicators: number
}

const RISK_COLORS: Record<string, string> = {
  HIGH:     "border-l-orange-500",
  CRITICAL: "border-l-red-500",
}

const RISK_BG: Record<string, string> = {
  HIGH:     "rgba(245,158,11,0.05)",
  CRITICAL: "rgba(239,68,68,0.05)",
}

const RISK_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  HIGH:     { bg: "rgba(245,158,11,0.1)",  color: "#FCD34D", border: "rgba(245,158,11,0.25)"  },
  CRITICAL: { bg: "rgba(239,68,68,0.12)",  color: "#F87171", border: "rgba(239,68,68,0.3)"    },
}

const LANG_NAMES: Record<string, string> = {
  en: "EN", hi: "HI", ml: "ML", ta: "TA",
  te: "TE", kn: "KN", bn: "BN", ar: "AR",
  es: "ES", fr: "FR", de: "DE", ur: "UR",
}

export default function AlertFeed() {
  const [alerts,    setAlerts]    = useState<Alert[]>(() => feedState.alerts as Alert[])
  const [connected, setConnected] = useState(false)
  const [paused,    setPaused]    = useState(() => feedState.paused)
  const [count,     setCount]     = useState(() => feedState.count)

  const eventSourceRef = useRef<EventSource | null>(null)
  const pausedRef      = useRef(feedState.paused)
  const reconnectRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectRef     = useRef<(() => Promise<void>) | null>(null)

  const connect = useCallback(async () => {
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
    try {
      const tokenRes  = await fetch("/api/auth/token")
      const { token } = await tokenRes.json()
      const base      = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null }
      const es = new EventSource(`${base}/admin/alerts/stream?token=${token}`)
      eventSourceRef.current = es
      es.onopen = () => setConnected(true)
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "heartbeat" || data.type === "connected") return
          if (data.type === "new_scan" && !pausedRef.current) {
            setAlerts(prev => {
              const next = [data, ...prev].slice(0, 50) as Alert[]
              feedState.alerts = next
              return next
            })
            setCount(c => { const n = c + 1; feedState.count = n; return n })
          }
        } catch { /* ignore */ }
      }
      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null
        reconnectRef.current = setTimeout(() => { connectRef.current?.() }, 5000)
      }
    } catch {
      reconnectRef.current = setTimeout(() => { connectRef.current?.() }, 5000)
    }
  }, [])

  useEffect(() => { connectRef.current = connect }, [connect])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    feedState.paused  = next
    setPaused(next)
  }

  function clearAlerts() {
    setAlerts([])
    setCount(0)
    feedState.alerts = []
    feedState.count  = 0
  }

  return (
    <div className="glass rounded-xl flex flex-col" style={{ height: "480px", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full transition-all ${
            !connected ? "bg-gray-600"
            : paused   ? "bg-yellow-500"
            : "bg-red-500 pulse-dot"
          }`} />
          <span className="text-xs mono font-semibold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
            Live Threat Feed
          </span>
          {count > 0 && (
            <span className="text-xs mono px-2 py-0.5 rounded font-bold"
              style={{ background: "rgba(239,68,68,0.1)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs mono px-2 py-0.5 rounded font-bold transition-all ${
            !connected ? "bg-gray-800 text-gray-500"
            : paused   ? "bg-yellow-900/40 text-yellow-400 border border-yellow-700/40"
            : "bg-red-900/30 text-red-400 border border-red-700/30"
          }`}>
            {!connected ? "OFFLINE" : paused ? "PAUSED" : "LIVE"}
          </span>
          <button onClick={togglePause}
            className="text-xs mono px-2.5 py-1 rounded transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {paused ? "▶" : "⏸"}
          </button>
          <button onClick={clearAlerts}
            className="text-xs mono px-2.5 py-1 rounded transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            ✕
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-4xl opacity-20">🛡</div>
            <div className="text-center">
              <p className="text-xs mono font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                {paused ? "FEED PAUSED" : "MONITORING FOR THREATS"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                {paused ? "Resume to see live alerts" : "HIGH and CRITICAL scans appear here"}
              </p>
            </div>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const rb = RISK_BADGE[alert.risk_level]
            return (
              <div key={`${alert.id}-${i}`}
                className={`border-l-2 rounded-r-lg p-3 ${RISK_COLORS[alert.risk_level] ?? "border-l-gray-600"}`}
                style={{ background: RISK_BG[alert.risk_level] ?? "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: undefined }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {rb && (
                        <span className="text-xs mono px-2 py-0.5 rounded font-bold"
                          style={{ background: rb.bg, color: rb.color, border: `1px solid ${rb.border}` }}>
                          {alert.risk_level}
                        </span>
                      )}
                      <span className="text-xs mono px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(59,130,246,0.08)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.15)" }}>
                        {LANG_NAMES[alert.language] ?? alert.language?.toUpperCase()}
                      </span>
                      <span className="text-xs mono font-bold" style={{ color: rb?.color ?? "var(--text-secondary)" }}>
                        {alert.risk_score}/100
                      </span>
                      {alert.indicators > 0 && (
                        <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>
                          {alert.indicators} indicator{alert.indicators > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
                      {alert.message}
                    </p>
                  </div>
                  <span className="text-xs mono shrink-0" style={{ color: "var(--text-muted)" }}>
                    {alert.time}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {paused && alerts.length > 0 && (
        <div className="px-4 py-2 border-t shrink-0 text-center"
          style={{ borderColor: "var(--border)", background: "rgba(245,158,11,0.04)" }}>
          <p className="text-xs mono" style={{ color: "#F59E0B" }}>
            Feed paused — {count} total detected
          </p>
        </div>
      )}
    </div>
  )
}