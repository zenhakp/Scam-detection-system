"use client"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState, useRef } from "react"

const NAV_ITEMS = [
  { href: "/dashboard",                  label: "Dashboard",   icon: "⊞" },
  { href: "/dashboard/scanner",          label: "Scanner",     icon: "⌖" },
  { href: "/dashboard/history",          label: "Scan History",icon: "≡" },
]

const ADMIN_ITEMS = [
  { href: "/dashboard/admin",            label: "Threat Dashboard", icon: "◈" },
  { href: "/dashboard/admin/campaigns",  label: "Campaigns",        icon: "◎" },
  { href: "/dashboard/admin/network",    label: "Network Graph",    icon: "⬡" },
  { href: "/dashboard/admin/timeline",   label: "Timeline",         icon: "↗" },
  { href: "/dashboard/admin/dataset",    label: "Model Training",   icon: "⊕" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router   = useRouter()
  const pathname = usePathname()
  const [time,      setTime]      = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

    // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata",
    }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (status === "loading") {
    return (
      <div className="min-h-screen grid-texture flex items-center justify-center">
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    )
  }

  const isAdmin = session?.user?.role === "admin"
  const emailPrefix = session?.user?.email?.split("@")[0]?.slice(0, 2).toUpperCase() ?? "U"

  // Breadcrumb from pathname
  const crumbs = pathname.split("/").filter(Boolean).map((seg, i, arr) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href:  "/" + arr.slice(0, i + 1).join("/"),
  }))

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)", fontFamily: "var(--font-sans)" }}>

      {/* ── Sidebar — fixed, never scrolls ── */}
      <aside style={{
        width: collapsed ? "60px" : "220px",
        flexShrink: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        transition: "width 0.25s ease",
        overflow: "hidden",
        position: "relative",
        zIndex: 30,
      }}>

      {/* Logo */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        gap: collapsed ? 0 : "10px",
        padding: "18px 12px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        minHeight: "64px",
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
          boxShadow: "0 0 15px rgba(59,130,246,0.4)",
        }}>
          <span style={{ color: "white", fontWeight: 700, fontSize: "14px" }}>S</span>
        </div>

        {!collapsed && (
          <div style={{ overflow: "hidden", flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
              ScamSentinel <span style={{ color: "var(--blue)" }}>AI</span>
            </p>
          </div>
        )}

        {/* Always visible toggle button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            marginLeft: collapsed ? "auto" : undefined,
            color: "var(--blue)",
            fontSize: "12px",
            flexShrink: 0,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: "6px",
            cursor: "pointer",
            width: "26px",
            height: "26px",
            minWidth: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          {collapsed ? "»" : "«"}
        </button>
      </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: collapsed ? "12px" : "11px 12px",
                  borderRadius: "8px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: active ? "var(--blue)" : "var(--text-secondary)",
                  background: active ? "rgba(59,130,246,0.1)" : "transparent",
                  borderLeft: active ? "2px solid var(--blue)" : "2px solid transparent",
                  transition: "all 0.15s",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                }}>
                <span className="mono" style={{ fontSize: "15px", flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              {!collapsed && (
                <div style={{ padding: "16px 12px 8px", marginTop: "4px" }}>
                  <p className="mono" style={{ fontSize: "12px", color: "white", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                    Admin
                  </p>
                </div>
              )}
              {collapsed && <div style={{ height: "1px", background: "var(--border)", margin: "8px 4px" }} />}

              {ADMIN_ITEMS.map(item => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: collapsed ? "12px" : "11px 12px",
                      borderRadius: "8px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: active ? "var(--blue)" : "var(--text-secondary)",
                      background: active ? "rgba(59,130,246,0.1)" : "transparent",
                      borderLeft: active ? "2px solid var(--blue)" : "2px solid transparent",
                      transition: "all 0.15s",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: active ? 600 : 400,
                    }}>
                    <span className="mono" style={{ fontSize: "15px", flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Profile section */}
        <div className="p-3 border-t relative" style={{ borderColor: "var(--border)" }} ref={profileRef}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="profile-avatar mx-auto block"
            style={{ display: collapsed ? "flex" : "flex", margin: "0 auto" }}
          >
            {emailPrefix}
          </button>

          {/* Profile dropdown */}
          {profileOpen && !collapsed && (
            <div className="profile-dropdown">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="profile-avatar" style={{ width: "40px", height: "40px", fontSize: "14px" }}>
                  {emailPrefix}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {session?.user?.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {session?.user?.email}
                  </p>
                </div>
              </div>
              <div className="mb-3">
                <span className={`text-xs mono px-2 py-1 rounded font-bold ${isAdmin ? "badge-critical" : "badge-low"}`}>
                  {session?.user?.role?.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full text-xs py-2 rounded-lg font-medium transition-colors"
                style={{ background: "rgba(239,68,68,0.08)", color: "#F87171", border: "1px solid rgba(239,68,68,0.15)" }}>
                Sign out
              </button>
            </div>
          )}

          {/* Collapsed profile dropdown */}
          {profileOpen && collapsed && (
            <div className="absolute bottom-full left-full ml-2 w-56 mb-2"
              style={{
                background: "rgba(13,21,38,0.98)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: "12px",
                padding: "12px",
                backdropFilter: "blur(20px)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                zIndex: 100,
              }}>
              <div className="mb-3 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{session?.user?.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{session?.user?.email}</p>
                <span className={`text-xs mono px-2 py-0.5 rounded font-bold mt-2 inline-block ${isAdmin ? "badge-critical" : "badge-low"}`}>
                  {session?.user?.role?.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full text-xs py-2 rounded-lg font-medium"
                style={{ background: "rgba(239,68,68,0.08)", color: "#F87171", border: "1px solid rgba(239,68,68,0.15)" }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Right side: sticky header + scrollable content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Sticky top bar */}
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: "44px",
          background: "rgba(6,11,20,0.95)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          zIndex: 20,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {crumbs.map((crumb, i) => (
              <span key={crumb.href} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {i > 0 && <span className="mono" style={{ color: "var(--text-muted)", fontSize: "12px" }}>/</span>}
                <Link href={crumb.href} style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: i === crumbs.length - 1 ? "var(--text-secondary)" : "var(--text-muted)", textDecoration: "none" }}>
                  {crumb.label}
                </Link>
              </span>
            ))}
          </div>
        </div>

        {/* Scrollable page content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 40px" }}>
          <div style={{
            maxWidth: "1100px",
            margin: "0 auto",
            width: "100%"
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}