"use client"
import { useState, useEffect } from "react"
import axios from "axios"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import AlertFeed from "@/components/AlertFeed"

interface DashboardData {
  total_scans:      number
  total_users:      number
  total_campaigns:  number
  scam_scans:       number
  total_indicators: number
  by_level:         Record<string, number>
  timeline:         { date: string; total: number; scam: number }[]
  top_languages:    { language: string; count: number }[]
}

const LEVEL_COLORS: Record<string, string> = {
  LOW:      "#10B981",
  MEDIUM:   "#F59E0B",
  HIGH:     "#F87171",
  CRITICAL: "#EF4444",
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

export default function AdminDashboard() {
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const tokenRes = await fetch("/api/auth/token")
        const { token } = await tokenRes.json()
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await axios.get(`${apiUrl}/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setData(res.data)
      } catch (err) {
        console.error("Failed to fetch dashboard:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="fade-in-up">
        <div style={{ marginBottom: "32px" }}>
          <div className="shimmer rounded h-4 w-40 mb-3" />
          <div className="shimmer rounded h-8 w-64" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", marginBottom: "24px" }}>
          {[...Array(5)].map((_, i) => <div key={i} className="shimmer rounded-xl" style={{ height: "88px" }} />)}
        </div>
      </div>
    )
  }

  if (!data) return (
    <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
      Failed to load dashboard. Is the backend running?
    </div>
  )

  const pieData = Object.entries(data.by_level).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  const axisStyle = { fill: "#4B5563", fontSize: 11, fontFamily: "var(--font-mono)" }

  return (
    <div className="fade-in-up" style={{ maxWidth: "1200px" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "6px" }}>
          Threat Dashboard
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          System-wide scam detection overview and live monitoring
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Scans",      value: data.total_scans,      color: "var(--blue)",   icon: "⌖" },
          { label: "Scams Detected",   value: data.scam_scans,       color: "var(--red)",    icon: "⚠" },
          { label: "Active Campaigns", value: data.total_campaigns,  color: "var(--orange)", icon: "◎" },
          { label: "Total Users",      value: data.total_users,      color: "var(--purple)", icon: "◈" },
          { label: "Indicators Found", value: data.total_indicators, color: "var(--cyan)",   icon: "⬡" },
        ].map(card => (
          <div key={card.label} className="glass rounded-xl"
            style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "14px", right: "14px", fontSize: "16px", opacity: 0.12, color: card.color, fontFamily: "var(--font-mono)" }}>
              {card.icon}
            </div>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: card.color, boxShadow: `0 0 6px ${card.color}`, marginBottom: "12px" }} />
            <p style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: card.color, lineHeight: 1, marginBottom: "6px" }}>
              {card.value.toLocaleString()}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Live feed + pie chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "20px", marginBottom: "20px" }}>
        <AlertFeed />

        <div className="glass rounded-2xl" style={{ padding: "24px", border: "1px solid var(--border)" }}>
          <p className="mono" style={{ fontSize: "11px", color: "white", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px" }}>
            Risk Distribution
          </p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value"
                  label={({ name }) => `${name}`
}
                  labelLine={{ stroke: "rgba(255,255,255,0.08)" }}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={LEVEL_COLORS[entry.name] ?? "#3B82F6"}
                      style={{ filter: `drop-shadow(0 0 8px ${LEVEL_COLORS[entry.name] ?? "#3B82F6"})` }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>No data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

        <div className="glass rounded-2xl" style={{ padding: "24px", border: "1px solid var(--border)" }}>
          <p className="mono" style={{ fontSize: "11px", color: "white", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px" }}>
            Scan Activity (Last 30 Days)
          </p>
          {data.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "#8892A4", paddingTop: "12px" }} />
                <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} name="Total"
                  style={{ filter: "drop-shadow(0 0 4px #3B82F6)" }} />
                <Line type="monotone" dataKey="scam"  stroke="#EF4444" strokeWidth={2} dot={false} name="Scams"
                  style={{ filter: "drop-shadow(0 0 4px #EF4444)" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>No timeline data yet</p>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl" style={{ padding: "24px", border: "1px solid var(--border)" }}>
          <p className="mono" style={{ fontSize: "11px", color: "white", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px" }}>
            Top Languages Detected
          </p>
          {data.top_languages.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.top_languages} >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="language" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4,4,0,0]} name="Scans">
                  <defs>
                    <linearGradient id="langGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#1D4ED8" />
                    </linearGradient>
                  </defs>
                  {data.top_languages.map((_, i) => (
                    <Cell key={i} fill="url(#langGrad2)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>No language data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Risk level bar */}
      <div className="glass rounded-2xl" style={{ padding: "24px", border: "1px solid var(--border)" }}>
        <p className="mono" style={{ fontSize: "11px", color: "white", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px" }}>
          Scans by Risk Level
        </p>
        {Object.keys(data.by_level).length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={Object.entries(data.by_level).map(([level, count]) => ({ level, count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="level" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4,4,0,0]} name="Count">
                {Object.keys(data.by_level).map((level, i) => (
                  <Cell key={i} fill={LEVEL_COLORS[level] ?? "#3B82F6"}
                    style={{ filter: `drop-shadow(0 0 4px ${LEVEL_COLORS[level] ?? "#3B82F6"})` }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>No data yet</p>
          </div>
        )}
      </div>

    </div>
  )
}