"use client"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import axios from "axios"

interface UserStats {
  total:      number
  scam_count: number
  safe_count: number
  by_level:   Record<string, number>
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const name    = session?.user?.name?.split(" ")[0] ?? "Analyst"
  const [stats, setStats] = useState<UserStats | null>(null)
  const [tick,  setTick]  = useState(0)

  useEffect(() => {
    async function fetchStats() {
      try {
        const tokenRes = await fetch("/api/auth/token")
        const { token } = await tokenRes.json()
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res  = await axios.get(`${base}/scan/history/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setStats(res.data)
      } catch { /* silent */ }
    }
    fetchStats()
    // Animate the threat ticker
    const id = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(id)
  }, [])

  const threatTips = [
    "Always verify URLs before clicking — hover to preview the destination",
    "Legitimate banks never ask for OTP via SMS or call",
    "KYC updates are done in-branch or via official apps, never via links",
    "Prize notifications asking for personal info are almost always scams",
    "Urgency in a message is a manipulation tactic — take your time",
    "When in doubt, call the company directly using their official number",
    "Crypto investment guaranteeing returns is always fraudulent",
    "Government agencies never demand immediate payment via calls",
  ]

  return (
    <div className="fade-in-up" style={{ maxWidth: "980px" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>
          Hello, {name}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          ScamSentinel AI is monitoring threats — analyze suspicious messages across 50+ languages
        </p>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "28px" }}>
          {[
            { label: "Total Scanned", value: stats.total,                    color: "var(--blue)",   icon: "⌖" },
            { label: "Scams Caught",  value: stats.scam_count,               color: "var(--red)",    icon: "⚠" },
            { label: "Safe Messages", value: stats.safe_count,               color: "var(--green)",  icon: "✓" },
            { label: "Critical Risk", value: stats.by_level?.CRITICAL ?? 0, color: "var(--orange)", icon: "◈" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl"
              style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "12px", right: "14px", fontSize: "18px", opacity: 0.15, color: s.color, fontFamily: "var(--font-mono)" }}>
                {s.icon}
              </div>
              <p style={{ fontSize: "30px", fontWeight: 700, fontFamily: "var(--font-mono)", color: s.color, marginBottom: "4px", lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main action cards — taller with more breathing room */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "28px" }}>
        {[
          {
            href:  "/dashboard/scanner",
            icon:  "⌖",
            title: "Message Scanner",
            desc:  "Analyze any suspicious message using AI + ML fusion. Detects scams across 50+ languages with full threat breakdown, indicator extraction, and AI-powered reasoning.",
            cta:   "Start Scanning →",
            color: "var(--blue)",
            border:"rgba(59,130,246,0.2)",
            glow:  "rgba(59,130,246,0.06)",
            badge: "CORE FEATURE",
          },
          {
            href:  "/dashboard/history",
            icon:  "≡",
            title: "Scan History",
            desc:  "Review all previously scanned messages with full AI analysis. Filter by risk level, delete individual or bulk scans, and track your detection history over time.",
            cta:   "View History →",
            color: "var(--green)",
            border:"rgba(16,185,129,0.2)",
            glow:  "rgba(16,185,129,0.04)",
            badge: null,
          },
        ].map(card => (
          <Link key={card.href} href={card.href}
            className="glass rounded-2xl"
            style={{
              padding: "32px 32px 28px",
              display: "block",
              textDecoration: "none",
              border: `1px solid ${card.border}`,
              boxShadow: `0 0 40px ${card.glow}`,
              transition: "transform 0.2s, box-shadow 0.2s",
              minHeight: "220px",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)"
              e.currentTarget.style.boxShadow = `0 8px 40px ${card.glow}, 0 0 40px ${card.glow}`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = `0 0 40px ${card.glow}`
            }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
              <span className="mono" style={{ fontSize: "30px", color: card.color, lineHeight: 1 }}>{card.icon}</span>
              {card.badge && (
                <span className="mono" style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px", background: "rgba(59,130,246,0.1)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  {card.badge}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              {card.title}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.75", marginBottom: "24px" }}>
              {card.desc}
            </p>
            <span style={{ fontSize: "13px", fontWeight: 600, color: card.color }}>
              {card.cta}
            </span>
          </Link>
        ))}
      </div>

      {/* Admin section */}
      {isAdmin && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)" }} className="pulse-dot" />
              <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Admin Intelligence
              </span>
            </div>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "28px" }}>
            {[
              { href: "/dashboard/admin",           icon: "◈", title: "Threat Dashboard", desc: "Live monitoring & charts",          color: "var(--red)",    live: true  },
              { href: "/dashboard/admin/campaigns",  icon: "◎", title: "Campaigns",        desc: "Semantic scam campaign grouping",  color: "var(--orange)", live: false },
              { href: "/dashboard/admin/network",    icon: "⬡", title: "Network Graph",    desc: "Indicator relationship map",       color: "var(--purple)", live: false },
              { href: "/dashboard/admin/dataset",    icon: "⊕", title: "Model Training",   desc: "Fine-tune XLM-RoBERTa live",       color: "var(--cyan)",   live: false },
            ].map(card => (
              <Link key={card.href} href={card.href}
                className="glass rounded-xl"
                style={{
                  padding: "20px 20px 18px",
                  display: "block",
                  textDecoration: "none",
                  border: `1px solid ${card.color}20`,
                  transition: "transform 0.2s",
                  minHeight: "120px",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <span className="mono" style={{ fontSize: "22px", color: card.color }}>{card.icon}</span>
                  {card.live && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--red)" }}>
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--red)" }} className="pulse-dot" />
                      LIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "5px" }}>{card.title}</p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.5" }}>{card.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Security Tips ticker — fills empty space */}
      <div className="glass rounded-xl"
        style={{ padding: "18px 22px", border: "1px solid rgba(59,130,246,0.1)", marginBottom: "18px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="mono" style={{ fontSize: "11px", color: "var(--blue)", flexShrink: 0, fontWeight: 700 }}>
            🛡 SECURITY TIP
          </span>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p key={tick} style={{ fontSize: "13px", color: "var(--text-secondary)", animation: "fadeInUp 0.5s ease", lineHeight: "1.5" }}>
              {threatTips[tick % threatTips.length]}
            </p>
          </div>
        </div>
      </div>

      {/* Quick scan CTA */}
      <div className="glass rounded-xl"
        style={{ padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(59,130,246,0.12)", gap: "20px" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", marginBottom: "5px" }}>
            Got a suspicious message?
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Multilingual AI analysis in under 5 seconds
          </p>
        </div>
        <Link href="/dashboard/scanner" className="btn-primary"
          style={{ padding: "11px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
          Scan Now →
        </Link>
      </div>

    </div>
  )
}