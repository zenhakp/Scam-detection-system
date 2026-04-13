"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError("Invalid email or password")
    else {
      router.push("/dashboard")
      setEmail("")
      setPassword("")
    }
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/dashboard" })
  }

  return (
    <div className="min-h-screen grid-texture flex items-center justify-center px-4 relative overflow-hidden">
      {/* Glow */}
      <div className="fixed top-[-30%] left-[-20%] w-150 h-150 rounded-full pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, #1D4ED8 0%, transparent 70%)" }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)", boxShadow: "0 0 25px rgba(59,130,246,0.4)" }}>
              <span className="text-white font-bold">S</span>
            </div>
            <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              ScamSentinel <span style={{ color: "var(--blue)" }}>AI</span>
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl" style={{ padding: "7px 40px" }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div style={{ width: "100%", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", display: "block" }}
>
              <label className="block text-xs font-medium mb-2 mono uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-dark w-full rounded-lg px-4 py-3 text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
            <div style={{ width: "100%", borderRadius: "10px", padding: "13px 18px", fontSize: "14px", display: "block" }}>
              <label className="block text-xs font-medium mb-2 mono uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-dark w-full rounded-lg px-4 py-3 text-sm"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-xl text-sm font-semibold mt-2"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <button
            onClick={handleGoogle}
            className="btn-ghost w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-3"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm mt-5" style={{ color: "var(--text-muted)" }}>
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--blue)" }} className="hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}