import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import cose from 'cytoscape-cose-bilkent'
import { supabase } from './supabase'

cytoscape.use(cose as any)

type NodeInfo = {
  id: number
  name: string
  type: string
  description: string | null
}

type GraphData = {
  nodes: NodeInfo[]
  edges: { id: number; source: number; target: number; type: string }[]
}

type LinkedClue = { id: number; clue_text: string; answer: string }

const COLORS: Record<string, string> = {
  entity: '#34d399',
  topic: '#f59e0b',
  category: '#38bdf8',
}
const colorFor = (t: string) => COLORS[t] ?? '#a1a1aa'

export default function Graph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<NodeInfo | null>(null)
  const [linkedClues, setLinkedClues] = useState<LinkedClue[]>([])
  const nodeById = useRef(new Map<string, NodeInfo>())

  useEffect(() => {
    Promise.all([
      supabase.from('nodes').select('id, name, type, description'),
      supabase
        .from('edges')
        .select('id, source:source_node_id, target:target_node_id, type:edge_type'),
    ]).then(([{ data: nodes }, { data: edges }]) =>
      setData({ nodes: nodes ?? [], edges: edges ?? [] }),
    )
  }, [])

  useEffect(() => {
    if (!data || !containerRef.current) return

    nodeById.current = new Map(data.nodes.map((n) => [String(n.id), n]))

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

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            'background-color': '#18181b',
            'border-width': 1.5,
            'border-color': (ele) => colorFor(ele.data('type')),
            color: '#e4e4e7',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'font-size': '11px',
            'font-weight': 500,
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'text-outline-color': '#09090b',
            'text-outline-width': 2,
            width: 'label',
            height: 'label',
            padding: '10px',
          },
        },
        {
          selector: '.category',
          style: { padding: '16px', 'font-size': '13px', 'font-weight': 700 },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#3f3f46',
            'target-arrow-color': '#3f3f46',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '9px',
            color: '#71717a',
            'text-background-color': '#09090b',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'background-color': '#27272a',
            'overlay-color': '#ffffff',
            'overlay-opacity': 0.08,
          },
        },
        {
          selector: '.faded',
          style: { opacity: 0.15 },
        },
        {
          selector: 'edge.faded',
          style: { opacity: 0.06 },
        },
      ],
      layout: {
        name: 'cose-bilkent',
        animate: true,
        fit: true,
        padding: 40,
        nodeRepulsion: 9000,
        idealEdgeLength: 110,
        edgeElasticity: 0.45,
      } as any,
    })

    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const neighborhood = node.closedNeighborhood()
      cy.elements().not(neighborhood).addClass('faded')
      neighborhood.removeClass('faded')
      setSelected(nodeById.current.get(node.id()) ?? null)
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('faded')
        setSelected(null)
        setLinkedClues([])
      }
    })

    cy.on('mouseover', 'node', () => {
      if (containerRef.current) containerRef.current.style.cursor = 'pointer'
    })
    cy.on('mouseout', 'node', () => {
      if (containerRef.current) containerRef.current.style.cursor = 'default'
    })

    cyRef.current = cy
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [data])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const q = query.trim().toLowerCase()
    cy.elements().removeClass('faded')
    if (!q) return
    const matches = cy
      .nodes()
      .filter((n) => n.data('label').toLowerCase().includes(q))
    cy.elements().not(matches).addClass('faded')
    if (matches.length) cy.fit(matches, 60)
  }, [query])

  useEffect(() => {
    const cy = cyRef.current
    if (cy) {
      // panel toggling changes the canvas width; resize after layout settles
      requestAnimationFrame(() => {
        cy.resize()
        cy.fit(undefined, 40)
      })
    }
    if (!selected) {
      setLinkedClues([])
      return
    }
    let cancelled = false
    supabase
      .from('clue_nodes')
      .select('clue_id')
      .eq('node_id', selected.id)
      .limit(6)
      .then(({ data: links }) => {
        const ids = (links ?? []).map((l) => l.clue_id)
        if (!ids.length) {
          if (!cancelled) setLinkedClues([])
          return
        }
        return supabase
          .from('clues')
          .select('id, clue_text, answer')
          .in('id', ids)
          .then(({ data: rows }) => {
            if (!cancelled) setLinkedClues((rows as LinkedClue[]) ?? [])
          })
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!data)
    return (
      <div className="h-[560px] rounded-xl border border-zinc-800 bg-zinc-950 grid place-items-center text-zinc-600 text-sm">
        loading graph…
      </div>
    )

  const types = [...new Set(data.nodes.map((n) => n.type))]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts…"
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-56"
        />
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {types.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colorFor(t) }}
              />
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={() => cyRef.current?.fit(undefined, 40)}
          className="ml-auto text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-md px-3 py-1.5 transition-colors"
        >
          Fit view
        </button>
      </div>

      <div className="flex">
        <div ref={containerRef} className="flex-1 min-w-0 h-[560px] bg-zinc-950" />
        {selected && (
          <aside className="w-72 shrink-0 border-l border-zinc-800 p-4 overflow-y-auto max-h-[560px]">
            <span
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: colorFor(selected.type) }}
            >
              {selected.type}
            </span>
            <h3 className="text-lg font-semibold mt-1">{selected.name}</h3>
            {selected.description && (
              <p className="text-sm text-zinc-400 mt-2">
                {selected.description}
              </p>
            )}
            <h4 className="text-xs uppercase tracking-widest text-zinc-500 mt-6 mb-2">
              Related clues
            </h4>
            {linkedClues.length === 0 ? (
              <p className="text-sm text-zinc-600">none linked yet</p>
            ) : (
              <ul className="space-y-3">
                {linkedClues.map((c) => (
                  <li
                    key={c.id}
                    className="text-sm border-l-2 border-zinc-700 pl-3"
                  >
                    <p className="text-zinc-300">{c.clue_text}</p>
                    <p className="text-zinc-500 mt-0.5">{c.answer}</p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
