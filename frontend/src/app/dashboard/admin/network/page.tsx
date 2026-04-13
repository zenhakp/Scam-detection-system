"use client"
import { useState, useEffect, useCallback } from "react"
import {
  ReactFlow, Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, NodeMouseHandler,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import axios from "axios"

interface GraphNode {
  id:    string
  label: string
  type:  string
  data:  Record<string, string>
}

interface GraphEdge {
  id:     string
  source: string
  target: string
  label:  string
}

const NODE_COLORS: Record<string, string> = {
  message: "#3B82F6",
  url:     "#EF4444",
  phone:   "#F97316",
  email:   "#8B5CF6",
  wallet:  "#EC4899",
}

function buildFlowNodes(graphNodes: GraphNode[]): Node[] {
  const typeGroups: Record<string, GraphNode[]> = {}
  graphNodes.forEach(n => {
    if (!typeGroups[n.type]) typeGroups[n.type] = []
    typeGroups[n.type].push(n)
  })
  const nodes: Node[] = []
  const typeOffsets: Record<string, number> = { message: 0, url: 380, phone: 660, email: 940, wallet: 1220 }

  Object.entries(typeGroups).forEach(([type, items]) => {
    items.forEach((item, idx) => {
      nodes.push({
        id:       item.id,
        position: { x: typeOffsets[type] ?? 600, y: idx * 90 + 60 },
        data:     { label: item.label },
        style: {
          background:   NODE_COLORS[type] ?? "#6b7280",
          color:        "#fff",
          border:       "none",
          borderRadius: "10px",
          fontSize:     "11px",
          fontFamily:   "var(--font-mono)",
          padding:      "8px 12px",
          boxShadow:    `0 0 12px ${NODE_COLORS[type] ?? "#6b7280"}60`,
          minWidth:     "130px",
          textAlign:    "center" as const,
        },
      })
    })
  })
  return nodes
}

function buildFlowEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map(e => ({
    id:           e.id,
    source:       e.source,
    target:       e.target,
    label:        e.label,
    style:        { stroke: "rgba(59,130,246,0.3)", strokeWidth: 1 },
    labelStyle:   { fontSize: 9, fill: "#4B5563", fontFamily: "var(--font-mono)" },
    labelBgStyle: { fill: "rgba(13,21,38,0.8)" },
    animated:     e.label === "url",
  }))
}

export default function NetworkGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading,  setLoading]  = useState(true)
  const [stats,    setStats]    = useState({ nodes: 0, edges: 0, messages: 0 })
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [rawNodes, setRawNodes] = useState<GraphNode[]>([])

  const fetchGraph = useCallback(async () => {
    setLoading(true)
    try {
      const tokenRes = await fetch("/api/auth/token")
      const { token } = await tokenRes.json()
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res  = await axios.get(`${base}/admin/network-graph`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { nodes: gNodes, edges: gEdges } = res.data
      setRawNodes(gNodes)
      setNodes(buildFlowNodes(gNodes))
      setEdges(buildFlowEdges(gEdges))
      setStats({
        nodes:    gNodes.length,
        edges:    gEdges.length,
        messages: gNodes.filter((n: GraphNode) => n.type === "message").length,
      })
    } catch (err) {
      console.error("Failed to fetch graph:", err)
    } finally {
      setLoading(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const raw = rawNodes.find(n => n.id === node.id)
    setSelected(raw ?? null)
  }, [rawNodes])

  return (
    <div className="fade-in-up" style={{ maxWidth: "1200px" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              Threat Network Graph
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Visualizes relationships between scam messages and their extracted indicators
            </p>
          </div>
          <button onClick={fetchGraph} className="btn-primary"
            style={{ padding: "10px 24px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "20px" }}>
        {[
          { label: "Total Nodes",   value: stats.nodes,                                          color: "var(--blue)"   },
          { label: "Connections",   value: stats.edges,                                          color: "var(--text-secondary)" },
          { label: "Scam Messages", value: stats.messages,                                       color: "var(--red)"    },
          { label: "URLs Tracked",  value: rawNodes.filter(n => n.type === "url").length,        color: "var(--orange)" },
          { label: "Phone Numbers", value: rawNodes.filter(n => n.type === "phone").length,      color: "var(--purple)" },
        ].map(card => (
          <div key={card.label} className="glass rounded-xl" style={{ padding: "18px 20px" }}>
            <p style={{ fontSize: "24px", fontWeight: 700, fontFamily: "var(--font-mono)", color: card.color, lineHeight: 1, marginBottom: "6px" }}>
              {card.value}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="glass rounded-xl"
        style={{ padding: "14px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "24px", border: "1px solid var(--border)" }}>
        <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>Legend:</span>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: color, boxShadow: `0 0 6px ${color}` }} />
            <span className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "capitalize" }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="glass rounded-2xl"
        style={{ overflow: "hidden", border: "1px solid var(--border)", marginBottom: "20px", height: "560px" }}>
        {loading ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
            <div style={{ width: "40px", height: "40px", border: "2px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p className="mono" style={{ color: "var(--text-muted)", fontSize: "13px" }}>Building network graph...</p>
          </div>
        ) : nodes.length === 0 ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <p style={{ fontSize: "16px", color: "var(--text-muted)" }}>No graph data yet</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", opacity: 0.6 }}>
              Scan HIGH or CRITICAL risk messages with URLs or phone numbers to populate the graph
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView attributionPosition="bottom-right"
            style={{ background: "transparent" }}>
            <Background color="rgba(59,130,246,0.06)" gap={20} size={1} />
            <Controls style={{ background: "rgba(13,21,38,0.8)", border: "1px solid var(--border)", borderRadius: "8px" }} />
            <MiniMap
              style={{ background: "rgba(13,21,38,0.9)", border: "1px solid var(--border)", borderRadius: "8px" }}
              nodeColor={(n: Node) => NODE_COLORS[rawNodes.find(r => r.id === n.id)?.type ?? "message"] ?? "#6b7280"}
            />
          </ReactFlow>
        )}
      </div>

      {/* Node detail */}
      {selected && (
        <div className="glass rounded-2xl" style={{ padding: "24px", border: "1px solid var(--border)" }} >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>Node Detail</p>
            <button onClick={() => setSelected(null)}
              style={{ color: "var(--text-muted)", fontSize: "18px", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            <div>
              <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Type</p>
              <span className="mono" style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", color: "white", background: NODE_COLORS[selected.type] ?? "#6b7280" }}>
                {selected.type}
              </span>
            </div>
            <div>
              <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Label</p>
              <p className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{selected.label}</p>
            </div>
            {selected.data.risk_level && (
              <div>
                <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Risk Level</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{selected.data.risk_level}</p>
              </div>
            )}
            {selected.data.language && (
              <div>
                <p className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Language</p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", textTransform: "uppercase" }}>{selected.data.language}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}