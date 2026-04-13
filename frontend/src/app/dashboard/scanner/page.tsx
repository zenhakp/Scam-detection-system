"use client"
import { useState } from "react"
import axios from "axios"

interface IndicatorResult {
  urls:           string[]
  phones:         string[]
  emails:         string[]
  crypto_wallets: string[]
}

interface AIReasoning {
  verdict:            string
  confidence:         string
  summary:            string
  tactics_used:       string[]
  red_flags:          string[]
  safe_to_ignore:     boolean
  recommended_action: string
  explanation:        string
}

interface ScanResult {
  risk_score:        number
  risk_level:        string
  language:          string
  scam_probability:  number
  highlights:        string[]
  indicators:        IndicatorResult
  threat_indicators: Record<string, string[]>
  ai_reasoning:      AIReasoning | null
}

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string; label: string }> = {
  LOW:      { color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)",  glow: "0 0 25px rgba(16,185,129,0.15)",  label: "LOW RISK"      },
  MEDIUM:   { color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  glow: "0 0 25px rgba(245,158,11,0.15)",  label: "MEDIUM RISK"   },
  HIGH:     { color: "#F87171", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   glow: "0 0 25px rgba(239,68,68,0.15)",   label: "HIGH RISK"     },
  CRITICAL: { color: "#EF4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",    glow: "0 0 40px rgba(239,68,68,0.25)",   label: "CRITICAL RISK" },
}

const LANG_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ml: "Malayalam", ta: "Tamil",
  te: "Telugu",  kn: "Kannada", bn: "Bengali",  ar: "Arabic",
  es: "Spanish", fr: "French",  de: "German",    ur: "Urdu",
  pa: "Punjabi", mr: "Marathi", gu: "Gujarati",  it: "Italian",
  pt: "Portuguese", id: "Indonesian", tr: "Turkish", ru: "Russian",
}

const SCANNING_STEPS = [
  "Detecting language",
  "Running ML model",
  "Extracting indicators",
  "AI reasoning",
  "Calculating risk",
]

export default function ScannerPage() {
  const [message,  setMessage]  = useState("")
  const [result,   setResult]   = useState<ScanResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [error,    setError]    = useState("")

  async function handleScan() {
    if (!message.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    setScanStep(0)

    const stepInterval = setInterval(() => {
      setScanStep(prev => {
        if (prev >= SCANNING_STEPS.length - 1) { clearInterval(stepInterval); return prev }
        return prev + 1
      })
    }, 700)

    try {
      const tokenRes = await fetch("/api/auth/token")
      const { token } = await tokenRes.json()
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/scan/`,
        { message },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      clearInterval(stepInterval)
      setResult(res.data)
    } catch (err: unknown) {
      clearInterval(stepInterval)
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || "Scan failed. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  function highlightMessage(text: string, highlights: string[]) {
    if (!highlights.length) return <span style={{ color: "var(--text-secondary)" }}>{text}</span>
    const pattern = new RegExp(
      `(${highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"
    )
    return (
      <>
        {text.split(pattern).map((part, i) =>
          highlights.some(h => h.toLowerCase() === part.toLowerCase())
            ? <mark key={i} style={{ background: "rgba(239,68,68,0.25)", color: "#FCA5A5", borderRadius: "3px", padding: "1px 4px" }}>{part}</mark>
            : <span key={i} style={{ color: "var(--text-secondary)" }}>{part}</span>
        )}
      </>
    )
  }

  const rc = result ? RISK_CONFIG[result.risk_level] : null
  const hasIndicators = result && Object.values(result.indicators).some(v => v.length > 0)

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }} className="fade-in-up">

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>
          Message Scanner
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          Paste any suspicious message to analyze it using XLM-RoBERTa + AI threat detection across 50+ languages
        </p>
      </div>

      {/* Input card */}
      <div className="glass rounded-2xl"
        style={{
          padding: "28px",
          marginBottom: "24px",
          border: loading ? "1px solid rgba(59,130,246,0.4)" : "1px solid var(--border)",
          boxShadow: loading ? "0 0 40px rgba(59,130,246,0.12)" : "none",
          transition: "all 0.3s",
        }}>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span className="text-xs mono uppercase tracking-widest text-gray-300">
            Input Message
          </span>
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={7}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: "12px",
            padding: "14px 16px",
            fontSize: "14px",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
            lineHeight: "1.75",
            resize: "none",
            display: "block",
          }}
          placeholder="Paste suspicious message here... e.g. You have WON ₹50,000! Click http://fakebank.com NOW!"
          disabled={loading}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
          <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>
            {message.length} characters
          </span>
          <button
            onClick={handleScan}
            disabled={loading || !message.trim()}
            className="btn-primary"
            style={{
              padding: "10px 28px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: loading || !message.trim() ? 0.5 : 1,
              cursor: loading || !message.trim() ? "not-allowed" : "pointer",
            }}>
            {loading ? (
              <>
                <span style={{ width: "16px", height: "16px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Analyzing...
              </>
            ) : "⌖ Scan Message"}
          </button>
        </div>

        {/* Step progress */}
        {loading && (
          <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {SCANNING_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: i < scanStep ? "#10B981" : i === scanStep ? "#3B82F6" : "rgba(255,255,255,0.1)",
                    boxShadow: i === scanStep ? "0 0 8px #3B82F6" : "none",
                    transition: "all 0.3s",
                  }} />
                  <span style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: i <= scanStep ? "var(--text-secondary)" : "var(--text-muted)",
                    opacity: i > scanStep ? 0.4 : 1,
                  }}>{step}</span>
                  {i < SCANNING_STEPS.length - 1 && (
                    <span style={{ color: "rgba(255,255,255,0.1)", fontSize: "10px", marginLeft: "2px" }}>›</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "14px 18px", borderRadius: "12px", marginBottom: "24px", fontSize: "13px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
          ⚠ {error}
        </div>
      )}

      {/* Results */}
      {result && rc && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="fade-in-up">

          {/* ── Risk Score Card ── */}
          <div className="glass rounded-2xl"
            style={{ padding: "28px", border: `1px solid ${rc.border}`, boxShadow: rc.glow }}>

            <p className="text-xs mono uppercase tracking-widest" style={{ color: "white", marginBottom: "20px" }}>
              Analysis Complete
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span className="mono"
                    style={{ fontSize: "13px", fontWeight: 700, padding: "6px 14px", borderRadius: "8px", background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                    {rc.label}
                  </span>
                  <span className="mono"
                    style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "8px", background: "rgba(59,130,246,0.08)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.15)" }}>
                    {LANG_NAMES[result.language] ?? result.language?.toUpperCase() ?? "Unknown"}
                  </span>
                </div>
              </div>

              {/* Circular gauge */}
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: "88px", height: "88px" }}>
                  <svg viewBox="0 0 88 88" style={{ width: "88px", height: "88px", transform: "rotate(-90deg)" }}>
                    <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                    <circle cx="44" cy="44" r="36" fill="none" stroke={rc.color}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - result.risk_score / 100)}`}
                      style={{ filter: `drop-shadow(0 0 8px ${rc.color})`, transition: "stroke-dashoffset 1.2s ease" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: rc.color, fontFamily: "var(--font-mono)", lineHeight: 1 }}>{result.risk_score}</span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/100</span>
                  </div>
                </div>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "6px" }}>Risk Score</p>
              </div>
            </div>
          </div>

          {/* ── Suspicious Content ── */}
          {result.highlights.length > 0 && (
            <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-xs mono uppercase tracking-widest" style={{ color: "white", marginBottom: "18px" }}>
                Suspicious Content
              </p>
              <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: "12px", padding: "16px 18px", fontSize: "14px", lineHeight: "1.8", marginBottom: "16px" }}>
                {highlightMessage(message, result.highlights)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {result.highlights.map((h, i) => (
                  <span key={i} className="mono" style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", background: "rgba(239,68,68,0.1)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Threat Indicators ── */}
          {hasIndicators && (
            <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid var(--border)" }}>
              <p className="text-xs mono uppercase tracking-widest" style={{ color: "white", marginBottom: "20px" }}>
                Threat Indicators Extracted
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {result.indicators.urls.length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: "11px", color: "var(--red)", marginBottom: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>SUSPICIOUS URLS</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {result.indicators.urls.map((url, i) => (
                        <span key={i} className="mono" style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.2)", wordBreak: "break-all" }}>
                          {url}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.indicators.phones.length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: "11px", color: "var(--orange)", marginBottom: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>◈ PHONE NUMBERS</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {result.indicators.phones.map((p, i) => (
                        <span key={i} className="mono" style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", background: "rgba(245,158,11,0.08)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.2)" }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.indicators.emails.length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: "11px", color: "var(--blue)", marginBottom: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>◈ EMAIL ADDRESSES</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {result.indicators.emails.map((e, i) => (
                        <span key={i} className="mono" style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", background: "rgba(59,130,246,0.08)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.2)" }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.indicators.crypto_wallets.length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: "11px", color: "var(--purple)", marginBottom: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>◈ CRYPTO WALLETS</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {result.indicators.crypto_wallets.map((w, i) => (
                        <span key={i} className="mono" style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", background: "rgba(139,92,246,0.08)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.2)" }}>
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Threat Categories ── */}
          {Object.keys(result.threat_indicators).length > 0 && (
            <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid var(--border)" }}>
              <p className="text-xs mono uppercase tracking-widest" style={{ color: "white", marginBottom: "20px" }}>
                Threat Categories Detected
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                {Object.entries(result.threat_indicators).map(([category, matches]) => (
                  <div key={category} style={{ padding: "14px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                    <p className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "#FCA5A5", marginBottom: "6px", textTransform: "capitalize" }}>
                      {category.replace(/_/g, " ")}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      {(matches as string[]).slice(0, 2).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Analysis ── */}
          {result.ai_reasoning && (
            <div className="glass rounded-2xl"
              style={{
                padding: "28px",
                border: result.ai_reasoning.verdict === "SCAM"
                  ? "1px solid rgba(239,68,68,0.3)"
                  : result.ai_reasoning.verdict === "LEGITIMATE"
                  ? "1px solid rgba(16,185,129,0.3)"
                  : "1px solid rgba(245,158,11,0.3)",
                boxShadow: result.ai_reasoning.verdict === "SCAM"
                  ? "0 0 30px rgba(239,68,68,0.08)"
                  : "none",
              }}>

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <p className="text-xs mono uppercase tracking-widest" style={{ color: "white" }}>
                  AI Analysis
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="mono"
                    style={{
                      fontSize: "12px", fontWeight: 700, padding: "5px 14px", borderRadius: "8px",
                      background: result.ai_reasoning.verdict === "SCAM" ? "rgba(239,68,68,0.15)" : result.ai_reasoning.verdict === "LEGITIMATE" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: result.ai_reasoning.verdict === "SCAM" ? "#EF4444" : result.ai_reasoning.verdict === "LEGITIMATE" ? "#10B981" : "#F59E0B",
                      border: `1px solid ${result.ai_reasoning.verdict === "SCAM" ? "rgba(239,68,68,0.3)" : result.ai_reasoning.verdict === "LEGITIMATE" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
                    }}>
                    {result.ai_reasoning.verdict}
                  </span>
                  <span className="mono"
                    style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "8px", background: "rgba(59,130,246,0.08)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.15)" }}>
                    {result.ai_reasoning.confidence} confidence
                  </span>
                </div>
              </div>

              <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px", lineHeight: "1.5" }}>
                {result.ai_reasoning.summary}
              </p>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.75", marginBottom: "24px" }}>
                {result.ai_reasoning.explanation}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                {result.ai_reasoning.tactics_used.length > 0 && (
                  <div style={{ padding: "18px 20px", borderRadius: "12px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                    <p className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "#FCA5A5", marginBottom: "14px", letterSpacing: "0.08em" }}>
                       SCAM TACTICS
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {result.ai_reasoning.tactics_used.map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#EF4444", marginTop: "6px", flexShrink: 0 }} />
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.ai_reasoning.red_flags.length > 0 && (
                  <div style={{ padding: "18px 20px", borderRadius: "12px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                    <p className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "#FCD34D", marginBottom: "14px", letterSpacing: "0.08em" }}>
                      RED FLAGS
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {result.ai_reasoning.red_flags.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#F59E0B", marginTop: "6px", flexShrink: 0 }} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                display: "flex", alignItems: "flex-start", gap: "14px", padding: "18px 20px", borderRadius: "12px",
                background: result.ai_reasoning.safe_to_ignore ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                border: `1px solid ${result.ai_reasoning.safe_to_ignore ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>
                <span style={{ fontSize: "20px", flexShrink: 0 }}>
                  {result.ai_reasoning.safe_to_ignore ? "✓" : "⚠"}
                </span>
                <div>
                  <p className="mono" style={{ fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: result.ai_reasoning.safe_to_ignore ? "#10B981" : "#EF4444", letterSpacing: "0.08em" }}>
                    RECOMMENDED ACTION
                  </p>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                    {result.ai_reasoning.recommended_action}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div style={{ height: "32px" }} />
        </div>
      )}
    </div>
  )
}