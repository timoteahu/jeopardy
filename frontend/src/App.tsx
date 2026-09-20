import { useEffect, useMemo, useState } from 'react'
import Graph from './Graph'
import { supabase } from './supabase'

type Clue = {
  id: number
  clue_text: string
  answer: string
  value: number | null
  round: string
  daily_double: boolean
  categories: { name: string } | null
}

type Mark = 'known' | 'learning'

const ROUNDS = ['J', 'DJ', 'FJ'] as const
const ROUND_LABEL: Record<string, string> = {
  J: 'Jeopardy',
  DJ: 'Double Jeopardy',
  FJ: 'Final Jeopardy',
}
const MARKS_KEY = 'jb-marks-v1'

function loadMarks(): Record<number, Mark> {
  try {
    return JSON.parse(localStorage.getItem(MARKS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function App() {
  const [clues, setClues] = useState<Clue[]>([])
  const [loading, setLoading] = useState(true)
  const [round, setRound] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [marks, setMarks] = useState<Record<number, Mark>>(loadMarks)

  useEffect(() => {
    let q = supabase
      .from('clues')
      .select('id, clue_text, answer, value, round, daily_double, categories(name)')
      .order('id')
      .limit(60)
    if (round) q = q.eq('round', round)
    q.then(({ data }) => {
      setClues((data as unknown as Clue[]) ?? [])
      setLoading(false)
    })
  }, [round])

  useEffect(() => {
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks))
  }, [marks])

  const stats = useMemo(() => {
    let known = 0
    let learning = 0
    for (const c of clues) {
      if (marks[c.id] === 'known') known++
      else if (marks[c.id] === 'learning') learning++
    }
    return { known, learning, fresh: clues.length - known - learning }
  }, [clues, marks])

  const reveal = (id: number) => setRevealed((prev) => new Set(prev).add(id))
  const mark = (id: number, m: Mark) =>
    setMarks((prev) => ({ ...prev, [id]: m }))

  const pct = clues.length ? Math.round((stats.known / clues.length) * 100) : 0

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Jeopardy Brain</h1>
          <p className="text-zinc-400 mt-1">
            A study deck wired to a knowledge graph — learn the clue, see how it
            connects.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          {[null, ...ROUNDS].map((r) => (
            <button
              key={r ?? 'all'}
              onClick={() => setRound(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                round === r
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                  : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {r ? ROUND_LABEL[r] : 'All rounds'}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-emerald-400">{stats.known} known</span>
            <span className="text-amber-400">{stats.learning} learning</span>
            <span className="text-zinc-500">{stats.fresh} fresh</span>
            <div className="w-32 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-zinc-400 tabular-nums">{pct}%</span>
          </div>
        </div>

        {loading ? (
          <p className="text-zinc-500">loading…</p>
        ) : clues.length === 0 ? (
          <p className="text-zinc-500">No clues yet — seed the database.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clues.map((c) => {
              const open = revealed.has(c.id)
              const m = marks[c.id]
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border p-5 flex flex-col bg-zinc-900/60 transition-colors ${
                    m === 'known'
                      ? 'border-emerald-500/40'
                      : m === 'learning'
                        ? 'border-amber-500/40'
                        : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-widest text-zinc-500">
                      {c.categories?.name ?? ROUND_LABEL[c.round] ?? c.round}
                    </span>
                    <span className="text-zinc-400 font-mono text-sm">
                      {c.daily_double ? 'DD ' : ''}${c.value ?? 0}
                    </span>
                  </div>
                  <p className="leading-snug text-zinc-100 flex-1">
                    {c.clue_text}
                  </p>
                  {open ? (
                    <>
                      <p className="mt-4 font-semibold text-zinc-50">
                        {c.answer}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => mark(c.id, 'known')}
                          className="flex-1 rounded-md bg-emerald-500/15 text-emerald-400 text-sm font-medium py-1.5 hover:bg-emerald-500/25 transition-colors"
                        >
                          Got it
                        </button>
                        <button
                          onClick={() => mark(c.id, 'learning')}
                          className="flex-1 rounded-md bg-amber-500/15 text-amber-400 text-sm font-medium py-1.5 hover:bg-amber-500/25 transition-colors"
                        >
                          Still learning
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => reveal(c.id)}
                      className="mt-4 rounded-md border border-zinc-700 text-sm text-zinc-400 py-1.5 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      Reveal answer
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <section className="mt-14">
          <h2 className="text-lg font-semibold mb-1">Knowledge graph</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Click a node to see what it is and which clues mention it. Search to
            highlight matching concepts.
          </p>
          <Graph />
        </section>
      </div>
    </div>
  )
}

export default App
