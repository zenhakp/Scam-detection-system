"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"

interface DatasetInfo {
  total_records:   number
  scam_records:    number
  legit_records:   number
  training_status: TrainingStatus
}

interface TrainingStatus {
  is_training:        boolean
  progress:           string
  last_trained:       string | null
  last_accuracy:      string | null
  records_trained_on: number
}

interface UploadResult {
  message:  string
  records:  number
  filename: string
  status:   string
}

interface FilePreview {
  file:     File
  rows:     string[][]
  headers:  string[]
  total:    number
  scam:     number
  legit:    number
  unknown:  number
}

export default function DatasetPage() {
  const [info,        setInfo]        = useState<DatasetInfo | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [result,      setResult]      = useState<UploadResult | null>(null)
  const [error,       setError]       = useState("")
  const [dragOver,    setDragOver]    = useState(false)
  const [polling,     setPolling]     = useState(false)
  const [preview,     setPreview]     = useState<FilePreview | null>(null)
  const [stopping,    setStopping]    = useState(false)
  const fileInputRef                  = useRef<HTMLInputElement>(null)
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null)

  const getToken = async () => {
    const res = await fetch("/api/auth/token")
    const { token } = await res.json()
    return token
  }

  const fetchInfo = useCallback(async () => {
    try {
      const token = await getToken()
      const base  = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res   = await axios.get(`${base}/dataset/info`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setInfo(res.data)
      if (!res.data.training_status.is_training && polling) {
        setPolling(false)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch (err) {
      console.error("Failed to fetch dataset info:", err)
    }
  }, [polling])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  useEffect(() => {
    if (polling) {
      pollRef.current = setInterval(fetchInfo, 3000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [polling, fetchInfo])

  function parseFilePreview(file: File): Promise<FilePreview> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const lines = text.trim().split("\n").filter(Boolean)
        const headers = lines[0]?.split(",").map(h => h.replace(/"/g, "").trim()) ?? []
        const rows = lines.slice(1, 6).map(line =>
          line.split(",").map(c => c.replace(/"/g, "").trim())
        )

        // Count labels
        const labelIdx = headers.findIndex(h => ["label","class","spam","category","type","target"].includes(h.toLowerCase()))
        let scam = 0, legit = 0, unknown = 0

        lines.slice(1).forEach(line => {
          const cols = line.split(",").map(c => c.replace(/"/g, "").trim())
          const lbl = cols[labelIdx]?.toLowerCase() ?? ""
          if (["spam","scam","phishing","fraud","1"].includes(lbl)) scam++
          else if (["ham","legit","legitimate","safe","0"].includes(lbl)) legit++
          else unknown++
        })

        resolve({ file, rows, headers, total: lines.length - 1, scam, legit, unknown })
      }
      reader.readAsText(file)
    })
  }

  async function handleFileSelect(file: File) {
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["csv", "json", "txt"].includes(ext ?? "")) {
      setError("Only CSV, JSON, and TXT files are supported.")
      return
    }
    setError("")
    setResult(null)

    if (ext === "csv") {
      const fp = await parseFilePreview(file)
      setPreview(fp)
    } else {
      setPreview({ file, rows: [], headers: [], total: 0, scam: 0, legit: 0, unknown: 0 })
    }
  }

  async function handleUpload() {
    if (!preview) return
    setUploading(true)
    setError("")
    try {
      const token    = await getToken()
      const base     = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const formData = new FormData()
      formData.append("file", preview.file)
      const res = await axios.post(`${base}/dataset/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      })
      setResult(res.data)
      setPreview(null)
      setPolling(true)
      fetchInfo()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleStopTraining() {
    setStopping(true)
    try {
      const token = await getToken()
      const base  = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      await axios.post(`${base}/dataset/stop-training`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // Start polling more aggressively after stop request
      setPolling(true)
    } catch (err) {
      // Even on error, set the polling so UI updates when training actually stops
      console.warn("Stop request error (non-fatal):", err)
      setPolling(true)
    } finally {
      setStopping(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const ts = info?.training_status

  function getProgressPercent(progress: string): number {
    if (progress === "idle")                  return 0
    if (progress === "queued")                return 5
    if (progress.includes("Preparing"))       return 15
    if (progress.includes("Loading"))         return 25
    if (progress.includes("Tokenizing"))      return 40
    if (progress.includes("Training"))        return 65
    if (progress.includes("Evaluating"))      return 85
    if (progress.includes("Saving"))          return 95
    if (progress === "completed")             return 100
    if (progress.includes("stop"))            return getProgressPercent("Training")
    return 10
  }

  const progressSteps = ["Prepare", "Load Model", "Tokenize", "Train", "Evaluate", "Save"]
  const currentStepIndex = ts?.progress.includes("Preparing") ? 0
    : ts?.progress.includes("Loading") ? 1
    : ts?.progress.includes("Tokenizing") ? 2
    : ts?.progress.includes("Training") ? 3
    : ts?.progress.includes("Evaluating") ? 4
    : ts?.progress.includes("Saving") ? 5
    : -1

  return (
    <div className="max-w-4xl fade-in-up" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Model Training
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Upload labeled scam datasets to retrain the XLM-RoBERTa detection model in real time
        </p>
      </div>

      {/* Training status */}
      {ts && ts.progress !== "idle" && (
        <div className="glass rounded-2xl"
          style={{
            padding: "28px",
            border: ts.is_training
              ? "1px solid rgba(59,130,246,0.35)"
              : ts.progress === "completed"
              ? "1px solid rgba(16,185,129,0.35)"
              : ts.progress.startsWith("failed")
              ? "1px solid rgba(239,68,68,0.35)"
              : "1px solid var(--border)",
            boxShadow: ts.is_training ? "0 0 30px rgba(59,130,246,0.1)" : "none",
          }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {ts.is_training ? "Model Retraining In Progress" : "Last Training Run"}
              </span>
              {ts.is_training && (
                <span className="text-xs mono px-2.5 py-1 rounded flex items-center gap-1.5"
                  style={{ background: "rgba(59,130,246,0.1)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" /> LIVE
                </span>
              )}
            </div>

            {ts.is_training && (
              <button
                onClick={handleStopTraining}
                disabled={stopping}
                className="text-xs mono px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  background: stopping ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.1)",
                  color: "#F87171",
                  border: "1px solid rgba(239,68,68,0.25)",
                  opacity: stopping ? 0.6 : 1,
                  cursor: stopping ? "not-allowed" : "pointer",
                }}>
                {stopping ? "Stopping..." : "⏹ Stop Training"}
              </button>
            )}
          </div>

          {/* Step progress */}
          {ts.is_training && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {progressSteps.map((step, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      height: "4px",
                      borderRadius: "2px",
                      marginBottom: "6px",
                      background: i < currentStepIndex
                        ? "var(--green)"
                        : i === currentStepIndex
                        ? "var(--blue)"
                        : "rgba(255,255,255,0.05)",
                      boxShadow: i === currentStepIndex ? "0 0 8px var(--blue)" : "none",
                      transition: "all 0.5s",
                    }} />
                    <p className="text-xs mono" style={{
                      color: i <= currentStepIndex ? "var(--text-secondary)" : "var(--text-muted)",
                      fontSize: "10px",
                    }}>{step}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span className="text-xs mono" style={{ color: "var(--text-secondary)" }}>{ts.progress}</span>
                <span className="text-xs mono font-bold" style={{ color: "var(--blue)" }}>
                  {getProgressPercent(ts.progress)}%
                </span>
              </div>
              <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <div style={{
                  height: "6px",
                  borderRadius: "3px",
                  width: `${getProgressPercent(ts.progress)}%`,
                  background: "linear-gradient(90deg, #1D4ED8, #3B82F6)",
                  boxShadow: "0 0 10px rgba(59,130,246,0.5)",
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          )}

          {ts.progress === "completed" && (
            <div style={{ padding: "16px 20px", borderRadius: "12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#10B981" }}>✓ Training completed successfully</p>
              <p className="text-xs mono mb-1" style={{ color: "#6EE7B7" }}>{ts.last_accuracy}</p>
              <p className="text-xs mono" style={{ color: "var(--text-muted)" }}>
                Fine-tuned on {ts.records_trained_on} samples · {ts.last_trained}
              </p>
            </div>
          )}

          {ts.progress.startsWith("failed") && (
            <div style={{ padding: "16px 20px", borderRadius: "12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#EF4444" }}>⚠ Training failed</p>
              <p className="text-xs mono" style={{ color: "var(--text-muted)" }}>{ts.progress}</p>
            </div>
          )}
        </div>
      )}

      {/* File preview */}
      {preview && (
        <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid rgba(59,130,246,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <span className="text-xs mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                File Preview
              </span>
              <p className="font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
                {preview.file.name}
              </p>
            </div>
            <button onClick={() => setPreview(null)} className="text-xs mono"
              style={{ color: "var(--text-muted)" }}>× Cancel</button>
          </div>

          {/* Label distribution */}
          {preview.total > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "Total Records", value: preview.total,   color: "var(--blue)"  },
                { label: "Scam Labels",   value: preview.scam,    color: "var(--red)"   },
                { label: "Legit Labels",  value: preview.legit,   color: "var(--green)" },
              ].map(s => (
                <div key={s.label} style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs mono mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                  <p className="text-xl font-bold mono" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table preview */}
          {preview.headers.length > 0 && (
            <div style={{ overflowX: "auto", marginBottom: "20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(59,130,246,0.08)" }}>
                    {preview.headers.map((h, i) => (
                      <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--blue)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ padding: "8px 16px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ padding: "8px 16px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                Showing first 5 rows of {preview.total} total
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleUpload}
              disabled={uploading || ts?.is_training}
              className="btn-primary px-8 py-3 rounded-xl text-sm font-semibold"
              style={{ opacity: uploading || ts?.is_training ? 0.5 : 1 }}>
              {uploading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </span>
              ) : ts?.is_training ? (
                "Training in progress..."
              ) : (
                "Start Training"
              )}
            </button>
            <button onClick={() => setPreview(null)} className="btn-ghost px-6 py-3 rounded-xl text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload dropzone — only show if no preview */}
      {!preview && (
        <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid var(--border)" }}>
          <p className="text-xs mono uppercase tracking-widest mb-6" style={{ color: "white" }}>
            Upload Training Dataset
          </p>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !ts?.is_training && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--blue)" : "rgba(59,130,246,0.2)"}`,
              borderRadius: "16px",
              padding: "60px 40px",
              textAlign: "center",
              cursor: ts?.is_training ? "not-allowed" : "pointer",
              background: dragOver ? "rgba(59,130,246,0.05)" : "rgba(255,255,255,0.01)",
              transition: "all 0.2s",
              opacity: ts?.is_training ? 0.5 : 1,
            }}>
            <input ref={fileInputRef} type="file" accept=".csv,.json,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              style={{ display: "none" }} disabled={ts?.is_training} />

            {ts?.is_training ? (
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Training in progress — please wait
                </p>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                  Drop your training dataset here
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  CSV, JSON, or TXT — a file preview will appear before training starts
                </p>
              </div>
            )}
          </div>

          {error && (
            <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", fontSize: "13px" }}>
              ⚠ {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#93C5FD", fontSize: "13px" }}>
              ✓ {result.message} — watch training status above
            </div>
          )}
        </div>
      )}

      {/* Format guide */}
      <div className="glass rounded-2xl" style={{ padding: "28px", border: "1px solid var(--border)" }}>
        <p className="text-xs mono uppercase tracking-widest mb-6" style={{ color: "white" }}>
          Supported File Formats
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
          {[
            {
              title: "CSV (recommended)",
              code: `message,label\n"You won!",spam\n"Your OTP is 123",ham\n"Click now!",scam`,
            },
            {
              title: "JSON",
              code: `[\n  {"message": "You won!",\n   "label": "spam"},\n  {"message": "OTP: 123",\n   "label": "ham"}\n]`,
            },
            {
              title: "Labels recognized",
              code: null,
              custom: (
                <div style={{ fontSize: "12px" }}>
                  <p style={{ color: "#FCA5A5", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>
                    spam · scam · phishing · fraud · 1
                  </p>
                  <p style={{ color: "var(--text-muted)", marginBottom: "12px", fontSize: "11px" }}>→ treated as SCAM</p>
                  <p style={{ color: "#6EE7B7", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>
                    ham · legit · legitimate · safe · 0
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>→ treated as LEGIT</p>
                </div>
              ),
            },
          ].map((f, i) => (
            <div key={i} style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
                {f.title}
              </p>
              {f.custom ?? (
                <pre style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {f.code}
                </pre>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 18px", borderRadius: "10px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <p style={{ fontSize: "12px", color: "#FCD34D", lineHeight: "1.7" }}>
            <span style={{ fontWeight: 700 }}>Tip:</span> Upload at least 100 balanced records (50 scam + 50 legit) for best results.
            The model fine-tunes from base XLM-RoBERTa each time, preserving multilingual capability. Max 1000 records per upload.
          </p>
        </div>
      </div>

    </div>
  )
}