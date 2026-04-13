"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"

export default function LandingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.push("/dashboard")
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen grid-texture flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === "authenticated") return null

  return (
    <div className="min-h-screen grid-texture relative overflow-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-25%] left-[10%] w-[700px] h-[700px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #1D4ED8 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-20%] right-[5%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }} />
        <div className="absolute top-[45%] left-[40%] w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)" }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-12 py-5 border-b"
        style={{ borderColor: "var(--border)", background: "rgba(6,11,20,0.7)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)", boxShadow: "0 0 24px rgba(59,130,246,0.5)" }}>
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ color: "var(--text-primary)" }}>
            ScamSentinel <span style={{ color: "var(--blue)" }}>AI</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="btn-ghost px-5 py-2.5 rounded-lg text-sm font-medium">
            Sign In
          </Link>
          <Link href="/signup"
            className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold">
            Create Account
          </Link>
        </div>
      </nav>

      {/* Hero — fully centered */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-8 pt-28 pb-20">

        <h1 className="text-7xl font-bold leading-none mb-6 fade-in-up-1"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.03em", maxWidth: "900px" }}>
          Detect Scams.<br />
          <span style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 50%, #8B5CF6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Stop Threats.
          </span><br />
          Stay Secure.
        </h1>

        <p className="text-xl mb-12 fade-in-up-2"
          style={{ color: "var(--text-secondary)", lineHeight: "1.8", maxWidth: "560px" }}>
          AI-powered real-time scam detection across 50+ languages.
          Campaign intelligence, threat analysis, and multilingual protection.
        </p>

        <div className="fade-in-up-3 mb-20">
          <Link href="/signup"
            className="btn-primary px-12 py-4 rounded-xl text-base font-semibold inline-flex items-center gap-2">
            Get Started <span>→</span>
          </Link>
        </div>

        {/* Stats — centered row */}
        <div className="grid grid-cols-4 gap-5 w-full max-w-xl fade-in-up-4">
          {[
            { value: "50+",  label: "Languages" },
            { value: "20+",  label: "Campaign Types" },
            { value: "99%",  label: "Accuracy" },
            { value: "Live", label: "Monitoring" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl py-5 px-3 text-center">
              <p className="text-2xl font-bold mono" style={{
                background: "linear-gradient(135deg, #3B82F6, #06B6D4)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Terminal demo — centered */}
      <section className="relative z-10 flex justify-center px-8 pb-24">
        <div className="w-full max-w-3xl glass rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 0 80px rgba(59,130,246,0.12), 0 0 160px rgba(59,130,246,0.04)" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b"
            style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.4)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#EF4444" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#F59E0B" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#10B981" }} />
            <span className="ml-4 text-xs mono" style={{ color: "var(--text-muted)" }}>
              scamsentinel — threat-analysis
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs mono" style={{ color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> ACTIVE
            </span>
          </div>
          <div className="p-8 space-y-4">
            {[
              { label: "INPUT",     value: "You have WON ₹50,000! Click http://fake-bank.com NOW...", color: "var(--text-secondary)" },
              { label: "LANGUAGE",  value: "en — English detected",                                   color: "var(--cyan)"   },
              { label: "ML SCORE",  value: "94/100 — CRITICAL",                                       color: "var(--red)"    },
              { label: "AI VERDICT",value: "SCAM — HIGH confidence",                                  color: "var(--red)"    },
              { label: "TACTICS",   value: "Financial bait · Urgency · Suspicious URL · Phishing",    color: "var(--orange)" },
              { label: "ACTION",    value: "Do NOT click any links. Block this sender immediately.",   color: "var(--green)"  },
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-5 text-sm mono">
                <span className="text-xs px-3 py-1 rounded font-bold shrink-0 w-28 text-center"
                  style={{ background: "rgba(59,130,246,0.1)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.15)" }}>
                  {line.label}
                </span>
                <span style={{ color: line.color }}>{line.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — centered */}
      <section className="relative z-10 flex flex-col items-center px-8 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Built for the Modern Threat Landscape
        </h2>
        <p className="text-center mb-12" style={{ color: "var(--text-secondary)" }}>
          Every feature engineered to catch what others miss
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 w-full max-w-5xl">
          {[
            { icon: "⚡", title: "Real-time Detection",  desc: "XLM-RoBERTa + AI fusion scanning any message instantly",   color: "var(--blue)"   },
            { icon: "🌐", title: "50+ Languages",        desc: "Hindi, Malayalam, Tamil, Arabic and 46 more supported",    color: "var(--cyan)"   },
            { icon: "🧠", title: "AI Reasoning",         desc: "Explains exactly why a message is suspicious with tactics", color: "var(--purple)" },
            { icon: "📡", title: "Campaign Intel",       desc: "Groups scams into campaigns and tracks infrastructure",     color: "var(--orange)" },
          ].map((f, i) => (
            <div key={i} className="glass rounded-xl p-6 hover:scale-[1.02] transition-transform text-center">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t py-8 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm mono" style={{ color: "var(--text-muted)" }}>
          ScamSentinel AI · Multilingual Scam Detection & Cyber Threat Intelligence
        </p>
      </footer>
    </div>
  )
}