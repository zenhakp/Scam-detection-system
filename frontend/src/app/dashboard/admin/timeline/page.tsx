"use client"
import { useState, useEffect } from "react"
import axios from "axios"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"

interface TimelineData {
  daily:   { date: string; total: number; scam: number; safe: number }[]
  weekly:  { week: string; total: number; scam: number }[]
  by_hour: { hour: string; scans: number }[]
  by_day:  { day: string; scans: number }[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "rgba(6,11,20,0.92)",
        border: "1px solid rgba(59,130,246,0.25)",
        borderRadius: "10px",
        padding: "12px 16px",
        backdropFilter: "blur(16px)",
      }}>
        <p style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ fontSize: "12px", color: p.color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
            {p.name}: <span style={{ color: "#E5E7EB" }}>{p.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function TimelinePage() {
  const [data,    setData]    = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<"daily" | "weekly">("daily")

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const tokenRes = await fetch("/api/auth/token")
        const { token } = await tokenRes.json()
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res  = await axios.get(`${base}/admin/timeline`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setData(res.data)
      } catch (err) {
        console.error("Failed to fetch timeline:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTimeline()
  }, [])

  if (loading) {
    return (
      <div className="fade-in-up">
        <div style={{ marginBottom: "32px" }}>
          <div className="shimmer rounded h-4 w-40 mb-3" />
          <div className="shimmer rounded h-8 w-64" />
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="shimmer rounded-xl mb-5" style={{ height: "220px" }} />)}
      </div>
    )
  }

  if (!data) return <p style={{ color: "var(--text-muted)" }}>Failed to load timeline data.</p>

  const chartData: Record<string, number | string>[] =
    view === "daily" ? data.daily.map(d => ({ ...d })) : data.weekly.map(d => ({ ...d }))
  const xKey = view === "daily" ? "date" : "week"

  const totalScans = data.daily.reduce((a, b) => a + b.total, 0)
  const totalScams = data.daily.reduce((a, b) => a + b.scam, 0)
  const peakDay    = data.daily.reduce(
    (max, d) => d.scam > max.scam ? d : max,
    { date: "N/A", scam: 0, total: 0, safe: 0 }
  )

  const axisStyle = { fill: "#4B5563", fontSize: 11, fontFamily: "var(--font-mono)" }

  return (
    <div className="fade-in-up" style={{ maxWidth: "1100px" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "6px" }}>
          Timeline Analytics
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          Scam activity patterns over time — IST timezone
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Scans",     value: totalScans,                    color: "var(--blue)"   },
          { label: "Total Scams",     value: totalScams,                    color: "var(--red)"    },
          { label: "Detection Rate",  value: totalScans > 0 ? `${Math.round((totalScams / totalScans) * 100)}%` : "0%", color: "var(--orange)" },
          { label: "Peak Day",        value: peakDay.date !== "N/A" ? peakDay.date.slice(5) : "—", color: "var(--text-primary)", sub: peakDay.scam > 0 ? `${peakDay.scam} scams` : "" },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl" style={{ padding: "20px 24px" }}>
            <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
              {s.label}
            </p>
            <p style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: s.color, lineHeight: 1 }}>
              {s.value}
            </p>
            {s.sub && <p style={{ fontSize: "11px", color: "var(--red)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Main timeline chart */}
      <div className="glass rounded-2xl" style={{ padding: "28px", marginBottom: "20px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Scam Activity Over Time
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["daily", "weekly"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: "6px 16px", borderRadius: "8px", fontSize: "12px", fontFamily: "var(--font-mono)", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s",
                  background: view === v ? "var(--blue)" : "rgba(59,130,246,0.08)",
                  color: view === v ? "white" : "var(--blue)",
                  border: `1px solid ${view === v ? "var(--blue)" : "rgba(59,130,246,0.2)"}`,
                }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scamGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={axisStyle} tickFormatter={d => String(d).slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "#8892A4", paddingTop: "16px" }} />
              <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fill="url(#totalGrad)" dot={false} name="Total Scans"
                style={{ filter: "drop-shadow(0 0 4px #3B82F6)" }} />
              <Area type="monotone" dataKey="scam"  stroke="#EF4444" strokeWidth={2} fill="url(#scamGrad)"  dot={false} name="Scams"
                style={{ filter: "drop-shadow(0 0 4px #EF4444)" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p className="mono" style={{ color: "var(--text-muted)", fontSize: "13px" }}>No data yet — scan some messages first</p>
          </div>
        )}
      </div>

      {/* Bottom charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* By hour */}
        <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "24px" }}>
            Scans by Hour of Day
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_hour}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="hour" tick={axisStyle} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="scans" radius={[4,4,0,0]} name="Scans"
                fill="url(#hourGrad)">
                <defs>
                  <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By day */}
        <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "24px" }}>
            Scans by Day of Week
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="scans" radius={[4,4,0,0]} name="Scans"
                fill="url(#dayGrad)">
                <defs>
                  <linearGradient id="dayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#6D28D9" />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}