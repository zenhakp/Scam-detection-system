"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import axios from "axios"

export default function SignupPage() {
  const router = useRouter()
  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await axios.post("/api/auth/signup", { name, email, password })
      router.push("/login?registered=true")
      setName("")
      setEmail("")
      setPassword("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid-texture flex items-center justify-center px-4 relative overflow-hidden">
      <div className="fixed top-[-30%] right-[-20%] w-150 h-150 rounded-full pointer-events-none opacity-15"
        style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }} />

      <div className="w-full max-w-md relative z-10">
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
            Create your account
          </p>
        </div>

        <div className="glass rounded-2xl" style={{ padding: "7px 40px" }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div style={{ width: "100%", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", display: "block" }}>
              <label className="block text-xs font-medium mb-2 mono uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="input-dark w-full rounded-lg px-4 py-3 text-sm" placeholder="Your name" required />
            </div>
            <div style={{ width: "100%", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", display: "block" }}>
              <label className="block text-xs font-medium mb-2 mono uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-dark w-full rounded-lg px-4 py-3 text-sm" placeholder="you@example.com" required />
            </div>
            <div style={{ width: "100%", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", display: "block" }}>
              <label className="block text-xs font-medium mb-2 mono uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-dark w-full rounded-lg px-4 py-3 text-sm" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 rounded-xl text-sm font-semibold"
              style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--blue)" }} className="hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}