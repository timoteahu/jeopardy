import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import cose from 'cytoscape-cose-bilkent'

cytoscape.use(cose as any)

type GraphData = {
  nodes: { id: number; name: string; type: string }[]
  edges: { id: number; source: number; target: number; type: string }[]
}

const colors: Record<string, string> = {
  entity: '#34d399',
  topic: '#fbbf24',
  category: '#60a5fa',
}

export default function Graph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [data, setData] = useState<GraphData | null>(null)

  useEffect(() => {
    fetch('/api/graph')
      .then((r) => r.json())
      .then(setData)
  }, [])

  useEffect(() => {
    if (!data || !containerRef.current) return

    const elements: cytoscape.ElementDefinition[] = [
      ...data.nodes.map((n) => ({
        data: { id: String(n.id), label: n.name, type: n.type },
        classes: n.type,
      })),
      ...data.edges.map((e) => ({
        data: {
          id: `e${e.id}`,
          source: String(e.source),
          target: String(e.target),
          label: e.type,
        },
      })),
    ]

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': '#94a3b8',
            color: '#f1f5f9',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            width: 80,
            height: 40,
            'text-wrap': 'wrap',
            'text-max-width': '70px',
          },
        },
        {
          selector: '.entity',
          style: { 'background-color': colors.entity },
        },
        {
          selector: '.topic',
          style: { 'background-color': colors.topic },
        },
        {
          selector: '.category',
          style: { 'background-color': colors.category },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '10px',
            color: '#94a3b8',
          },
        },
      ],
      layout: {
        name: 'cose-bilkent',
        animate: true,
        fit: true,
        padding: 20,
      } as any,
    })

    return () => {
      cyRef.current?.destroy()
      cyRef.current = null
    }
  }, [data])

  if (!data) return <p className="text-slate-500">loading graph...</p>

  return (
    <div
      ref={containerRef}
      className="w-full h-[500px] rounded-lg border border-slate-800 bg-slate-900"
    />
  )
}
