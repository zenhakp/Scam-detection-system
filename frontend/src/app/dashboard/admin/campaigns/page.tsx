"use client"
import { useState, useEffect } from "react"
import axios from "axios"

interface Campaign {
  id:              string
  name:            string
  category:        string
  message_count:   number
  indicators:      string[]
  sample_messages: string[]
  first_seen:      string
}

function getCategoryStyle(cat: string) {
  return { color: "#9CA3AF", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)" }
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [intel,     setIntel]     = useState<{ indicator: string; count: number }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<Campaign | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const tokenRes = await fetch("/api/auth/token")
        const { token } = await tokenRes.json()
        const headers = { Authorization: `Bearer ${token}` }
        const base    = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const [campRes, intelRes] = await Promise.all([
          axios.get(`${base}/admin/campaigns`, { headers }),
          axios.get(`${base}/admin/threat-intelligence`, { headers }),
        ])
        setCampaigns(campRes.data)
        setIntel(intelRes.data.top_indicators || [])
      } catch (err) {
        console.error("Failed to fetch campaigns:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="fade-in-up">
        <div style={{ marginBottom: "32px" }}>
          <div className="shimmer h-4 w-40 rounded mb-3" />
          <div className="shimmer h-8 w-64 rounded" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer rounded-xl mb-4" style={{ height: "80px" }} />
        ))}
      </div>
    )
  }

  return (
    <div className="fade-in-up">

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Campaign Explorer
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Detected scam campaigns and infrastructure intelligence — grouped by semantic similarity
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px", alignItems: "start" }}>

        {/* Campaign list */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span className="text-xs mono uppercase tracking-widest" style={{ color: "white" }}>
              Active Campaigns
            </span>
            <span className="text-xs mono px-2 py-0.5 rounded"
              style={{ background: "rgba(245,158,11,0.1)", color: "var(--blue)", border: "1px solid rgba(245,158,11,0.2)" }}>
              ({campaigns.length})
            </span>
          </div>

          {campaigns.length === 0 ? (
            <div className="glass rounded-xl" style={{ padding: "48px", textAlign: "center", border: "1px solid var(--border)" }}>
              <p style={{ color: "white", fontSize: "14px" }}>
                No campaigns detected yet.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {campaigns.map(campaign => {
                const style = getCategoryStyle(campaign.category)
                const isSelected = selected?.id === campaign.id
                return (
                  <div
                    key={campaign.id}
                    onClick={() => setSelected(isSelected ? null : campaign)}
                    className="glass"
                    style={{
                      borderRadius: "16px",
                      padding: "20px 24px",
                      cursor: "pointer",
                      border: isSelected ? `1px solid ${style.border}` : "1px solid var(--border)",
                      boxShadow: isSelected ? `0 0 20px ${style.bg}` : "none",
                      transition: "all 0.2s",
                    }}>

                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          <span style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "20px",
                            background: style.bg,
                            color: "white",
                            border: `1px solid ${style.border}`,
                          }}>
                            {campaign.category}
                          </span>
                          <span style={{ fontSize: "11px", color: "gray", fontFamily: "var(--font-mono)" }}>
                            First seen: {new Date(campaign.first_seen).toLocaleDateString("en-IN")}
                          </span>
                        </div>

                        {campaign.indicators?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                            {campaign.indicators.slice(0, 3).map((ind: string, i: number) => (
                              <span key={i} style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-mono)",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "rgba(239,68,68,0.08)",
                                color: "#FCA5A5",
                                border: "1px solid rgba(239,68,68,0.15)",
                                maxWidth: "200px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {ind}
                              </span>
                            ))}
                            {campaign.indicators.length > 3 && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                +{campaign.indicators.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right", marginLeft: "20px", flexShrink: 0 }}>
                        <p style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: style.color, lineHeight: 1 }}>
                          {campaign.message_count}
                        </p>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>messages</p>
                      </div>
                    </div>

                    {/* Expanded sample messages */}
                    {isSelected && campaign.sample_messages?.length > 0 && (
                      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <p style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "gray", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          Sample Messages
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {campaign.sample_messages.map((msg: string, i: number) => (
                            <p key={i} style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.04)",
                              lineHeight: "1.5",
                            }}>
                              {msg}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Threat intelligence sidebar */}
        <div style={{ position: "sticky", top: "80px" }}>
          <div style={{ marginBottom: "16px" }}>
            <span className="text-xs mono uppercase tracking-widest" style={{ color: "white" }}>
              Scam Infrastructure
            </span>
          </div>

          <div className="glass rounded-2xl" style={{ padding: "20px 24px", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "12px", color: "gray", marginBottom: "20px", lineHeight: "1.5" }}>
              Most reused indicators across all scam messages
            </p>

            {intel.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                No indicators tracked yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {intel.map((item, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginRight: "8px",
                      }}>
                        {item.indicator}
                      </span>
                      <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--red)", flexShrink: 0 }}>
                        {item.count}×
                      </span>
                    </div>
                    <div style={{ height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.04)" }}>
                      <div style={{
                        height: "3px",
                        borderRadius: "2px",
                        width: `${Math.min((item.count / (intel[0]?.count || 1)) * 100, 100)}%`,
                        background: "linear-gradient(90deg, #EF4444, #F87171)",
                        boxShadow: "0 0 6px rgba(239,68,68,0.4)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}