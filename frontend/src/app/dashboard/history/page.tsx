"use client"
import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import Link from "next/link"
import { createPortal } from "react-dom"

interface ScanHistoryItem {
  id:          string
  message:     string
  risk_score:  number
  risk_level:  string
  language:    string
  created_at:  string
  indicators:  { urls: string[]; phones: string[]; emails: string[]; crypto_wallets: string[] } | null
  ai_reasoning: { verdict: string; summary: string; confidence: string } | null
}

interface Stats {
  total:       number
  scam_count:  number
  safe_count:  number
  by_level:    Record<string, number>
}

interface DeleteConfirm {
  type:    "single" | "multiple"
  ids:     string[]
  message: string
}

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  LOW:      { color: "#10B981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)"  },
  MEDIUM:   { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)"  },
  HIGH:     { color: "#F87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)"   },
  CRITICAL: { color: "#EF4444", bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.4)"    },
}

const LANG_NAMES: Record<string, string> = {
  en: "EN", hi: "HI", ml: "ML", ta: "TA", te: "TE",
  kn: "KN", bn: "BN", ar: "AR", es: "ES", fr: "FR",
  de: "DE", ur: "UR", pa: "PA", mr: "MR", gu: "GU",
}

const VERDICT_COLORS: Record<string, string> = {
  SCAM:       "#EF4444",
  SUSPICIOUS: "#F59E0B",
  LEGITIMATE: "#10B981",
}

export default function HistoryPage() {
  const [scans,         setScans]         = useState<ScanHistoryItem[]>([])
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState("")
  const [selected,      setSelected]      = useState<ScanHistoryItem | null>(null)
  const [checkedIds,    setCheckedIds]    = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [deleting,      setDeleting]      = useState(false)

  const getToken = async () => {
    const res = await fetch("/api/auth/token")
    const { token } = await res.json()
    return token
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const token   = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      const base    = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const [scansRes, statsRes] = await Promise.all([
        axios.get(`${base}/scan/history${filter ? `?risk_level=${filter}` : ""}`, { headers }),
        axios.get(`${base}/scan/history/stats`, { headers }),
      ])
      setScans(scansRes.data)
      setStats(statsRes.data)
      setCheckedIds(new Set())
    } catch (err) {
      console.error("Failed to fetch history:", err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Kolkata",
    })
  }

  function countIndicators(indicators: ScanHistoryItem["indicators"]) {
    if (!indicators) return 0
    return Object.values(indicators).reduce((a, b) => a + b.length, 0)
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setCheckedIds(checkedIds.size === scans.length ? new Set() : new Set(scans.map(s => s.id)))
  }

  function confirmDelete(type: "single" | "multiple", ids: string[]) {
    setDeleteConfirm({
      type, ids,
      message: type === "single"
        ? "Delete this scan permanently?"
        : `Delete ${ids.length} selected scans permanently?`,
    })
  }

  async function executeDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const token   = await getToken()
      const base    = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const headers = { Authorization: `Bearer ${token}` }
      if (deleteConfirm.type === "single") {
        await axios.delete(`${base}/scan/history/${deleteConfirm.ids[0]}`, { headers })
      } else {
        await axios.delete(`${base}/scan/history/bulk`, { headers, data: deleteConfirm.ids })
      }
      setDeleteConfirm(null)
      if (selected && deleteConfirm.ids.includes(selected.id)) setSelected(null)
      await fetchData()
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  const rc = (level: string) => RISK_CONFIG[level] ?? RISK_CONFIG.LOW

  return (
    <div className="fade-in-up" style={{ maxWidth: "1100px" }}>

      {/* Delete confirm modal */}
      {deleteConfirm && typeof window !== "undefined" && createPortal(
        <div
          onClick={() => !deleting && setDeleteConfirm(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0D1526",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "16px",
              padding: "40px 44px",
              maxWidth: "400px",
              width: "calc(100% - 48px)",
              boxShadow: "0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(239,68,68,0.15)",
            }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#F0F4FF", marginBottom: "12px" }}>
              Confirm Delete
            </h3>
            <p style={{ fontSize: "14px", color: "#8892A4", marginBottom: "32px", lineHeight: "1.6" }}>
              {deleteConfirm.message} This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  padding: "10px 22px", borderRadius: "10px", fontSize: "13px",
                  fontWeight: 600, cursor: "pointer",
                  background: "rgba(255,255,255,0.05)",
                  color: "#8892A4",
                  border: "1px solid rgba(255,255,255,0.1)",
                  opacity: deleting ? 0.5 : 1,
                }}>
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                style={{
                  padding: "10px 22px", borderRadius: "10px", fontSize: "13px",
                  fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer",
                  background: "rgba(239,68,68,0.2)",
                  color: "#EF4444",
                  border: "1px solid rgba(239,68,68,0.4)",
                  opacity: deleting ? 0.6 : 1,
                }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Scan History
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            All your previously scanned messages with AI analysis
          </p>
        </div>
        <Link href="/dashboard/scanner" className="btn-primary"
          style={{ padding: "10px 22px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
          New Scan
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {[
            { label: "Total Scans",     value: stats.total,                    color: "var(--blue)"   },
            { label: "Scams Detected",  value: stats.scam_count,               color: "var(--red)"    },
            { label: "Safe Messages",   value: stats.safe_count,               color: "var(--green)"  },
            { label: "Critical Risk",   value: stats.by_level?.CRITICAL ?? 0, color: "var(--orange)" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl" style={{ padding: "20px 24px" }}>
              <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
                {s.label}
              </p>
              <p style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filter + bulk actions */}
      <div className="glass rounded-xl" style={{ padding: "14px 20px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", border: "1px solid var(--border)" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Filter:</span>
        {["", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map(level => (
          <button key={level} onClick={() => setFilter(level)}
            style={{
              padding: "5px 14px", borderRadius: "20px", fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: filter === level ? "var(--blue)" : "rgba(59,130,246,0.08)",
              color: filter === level ? "white" : "var(--blue)",
              border: `1px solid ${filter === level ? "var(--blue)" : "rgba(59,130,246,0.2)"}`,
            }}>
            {level || "All"}
          </button>
        ))}

        {checkedIds.size > 0 && (
          <button onClick={() => confirmDelete("multiple", Array.from(checkedIds))}
            style={{ marginLeft: "8px", padding: "5px 14px", borderRadius: "20px", fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}>
            Delete {checkedIds.size} selected
          </button>
        )}

        <span className="mono" style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
          {scans.length} result{scans.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

        {/* List */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Select all */}
          {scans.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 4px", marginBottom: "8px" }}>
              <input type="checkbox"
                checked={checkedIds.size === scans.length && scans.length > 0}
                onChange={toggleAll}
                style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--blue)" }}
              />
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Select all</span>
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="shimmer rounded-xl" style={{ height: "80px" }} />
              ))}
            </div>
          ) : scans.length === 0 ? (
            <div className="glass rounded-2xl" style={{ padding: "60px", textAlign: "center", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px" }}>No scans found.</p>
              <Link href="/dashboard/scanner"
                style={{ color: "var(--blue)", fontSize: "13px", textDecoration: "none" }}>
                Scan your first message →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {scans.map(scan => {
                const risk    = rc(scan.risk_level)
                const isSelected = selected?.id === scan.id
                const isChecked  = checkedIds.has(scan.id)
                return (
                  <div key={scan.id}
                    className="glass rounded-xl"
                    style={{
                      padding: "16px 20px",
                      border: isSelected ? `1px solid ${risk.border}` : "1px solid var(--border)",
                      boxShadow: isSelected ? `0 0 16px ${risk.bg}` : "none",
                      background: isChecked ? "rgba(59,130,246,0.04)" : undefined,
                      transition: "all 0.15s",
                      cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>

                      {/* Checkbox */}
                      <input type="checkbox" checked={isChecked}
                        onChange={() => toggleCheck(scan.id)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: "15px", height: "15px", marginTop: "3px", flexShrink: 0, cursor: "pointer", accentColor: "var(--blue)" }}
                      />

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }} onClick={() => setSelected(isSelected ? null : scan)}>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "8px" }}>
                          {scan.message.length > 90 ? scan.message.slice(0, 90) + "..." : scan.message}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span className="mono" style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
                            {scan.risk_level}
                          </span>
                          <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", padding: "3px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.04)" }}>
                            {LANG_NAMES[scan.language] ?? scan.language?.toUpperCase()}
                          </span>
                          {countIndicators(scan.indicators) > 0 && (
                            <span className="mono" style={{ fontSize: "10px", color: "#FCA5A5" }}>
                              {countIndicators(scan.indicators)} indicator{countIndicators(scan.indicators) > 1 ? "s" : ""}
                            </span>
                          )}
                          {scan.ai_reasoning && (
                            <span className="mono" style={{ fontSize: "10px", fontWeight: 700, color: VERDICT_COLORS[scan.ai_reasoning.verdict] ?? "var(--text-muted)" }}>
                              AI: {scan.ai_reasoning.verdict}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side */}
                      <div style={{ textAlign: "right", flexShrink: 0, minWidth: "120px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", marginBottom: "4px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: risk.color, boxShadow: `0 0 4px ${risk.color}` }} />
                          <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {formatDate(scan.created_at)}
                          </span>
                        </div>
                        <p className="mono" style={{ fontSize: "13px", fontWeight: 700, color: risk.color, marginBottom: "6px" }}>
                          {scan.risk_score}/100
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); confirmDelete("single", [scan.id]) }}
                          style={{ fontSize: "11px", color: "#F87171", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ width: "300px", flexShrink: 0, position: "sticky", top: "70px" }}>
            <div className="glass rounded-2xl" style={{ padding: "20px 22px", border: `1px solid ${rc(selected.risk_level).border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Scan Detail</span>
                <button onClick={() => setSelected(null)}
                  style={{ color: "var(--text-muted)", fontSize: "18px", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>Message</p>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "12px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", lineHeight: "1.6", wordBreak: "break-word" }}>
                    {selected.message}
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px" }}>Risk Score</p>
                    <p style={{ fontSize: "20px", fontWeight: 700, fontFamily: "var(--font-mono)", color: rc(selected.risk_level).color }}>
                      {selected.risk_score}/100
                    </p>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px" }}>Level</p>
                    <span className="mono" style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", background: rc(selected.risk_level).bg, color: rc(selected.risk_level).color, border: `1px solid ${rc(selected.risk_level).border}` }}>
                      {selected.risk_level}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>Scanned</p>
                  <p className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{formatDate(selected.created_at)}</p>
                </div>

                {selected.indicators && countIndicators(selected.indicators) > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase" }}>Indicators</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {selected.indicators.urls.map((url, i) => (
                        <p key={i} className="mono" style={{ fontSize: "11px", padding: "6px 10px", borderRadius: "6px", background: "rgba(239,68,68,0.08)", color: "#FCA5A5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</p>
                      ))}
                      {selected.indicators.phones.map((p, i) => (
                        <p key={i} className="mono" style={{ fontSize: "11px", padding: "6px 10px", borderRadius: "6px", background: "rgba(245,158,11,0.08)", color: "#FCD34D" }}>{p}</p>
                      ))}
                      {selected.indicators.emails.map((e, i) => (
                        <p key={i} className="mono" style={{ fontSize: "11px", padding: "6px 10px", borderRadius: "6px", background: "rgba(59,130,246,0.08)", color: "#93C5FD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</p>
                      ))}
                    </div>
                  </div>
                )}

                {selected.ai_reasoning && (
                  <div>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase" }}>AI Analysis</p>
                    <div style={{
                      padding: "12px 14px", borderRadius: "8px",
                      background: selected.ai_reasoning.verdict === "SCAM" ? "rgba(239,68,68,0.06)" : selected.ai_reasoning.verdict === "SUSPICIOUS" ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)",
                      border: `1px solid ${VERDICT_COLORS[selected.ai_reasoning.verdict] ?? "rgba(255,255,255,0.06)"}30`,
                    }}>
                      <p className="mono" style={{ fontSize: "11px", fontWeight: 700, color: VERDICT_COLORS[selected.ai_reasoning.verdict], marginBottom: "6px" }}>
                        {selected.ai_reasoning.verdict} — {selected.ai_reasoning.confidence}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                        {selected.ai_reasoning.summary}
                      </p>
                    </div>
                  </div>
                )}

                <button onClick={() => confirmDelete("single", [selected.id])}
                  style={{ width: "100%", padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)", fontFamily: "var(--font-sans)" }}>
                  Delete This Scan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}