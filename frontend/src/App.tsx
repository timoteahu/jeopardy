import { useEffect, useState } from 'react'
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

const ROUNDS = ['J', 'DJ', 'FJ'] as const
const ROUND_LABEL: Record<string, string> = {
  J: 'Jeopardy',
  DJ: 'Double Jeopardy',
  FJ: 'Final Jeopardy',
}

function App() {
  const [clues, setClues] = useState<Clue[]>([])
  const [loading, setLoading] = useState(true)
  const [round, setRound] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

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

  const toggle = (id: number) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="min-h-screen bg-[#060CE9] bg-gradient-to-b from-[#060CE9] to-[#02075e] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 text-center">
          <h1
            className="text-5xl font-black text-[#FFCC00] italic tracking-tight"
            style={{ textShadow: '3px 3px 0 #000' }}
          >
            JEOPARDY! BRAIN
          </h1>
          <p className="text-blue-200 mt-2">study smarter with a knowledge graph</p>
        </header>

        <div className="flex justify-center gap-2 mb-6">
          {[null, ...ROUNDS].map((r) => (
            <button
              key={r ?? 'all'}
              onClick={() => setRound(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                round === r
                  ? 'bg-[#FFCC00] text-black'
                  : 'bg-blue-950/60 text-blue-200 hover:bg-blue-900'
              }`}
            >
              {r ? ROUND_LABEL[r] : 'All rounds'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-blue-300 text-center">loading...</p>
        ) : clues.length === 0 ? (
          <p className="text-blue-300 text-center">no clues yet. seed the database.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {clues.map((c) => {
              const open = revealed.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="text-left bg-blue-950/70 rounded-lg p-5 border border-blue-800/60 shadow-lg hover:border-[#FFCC00]/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-widest text-blue-300">
                      {c.categories?.name ?? ROUND_LABEL[c.round] ?? c.round}
                    </span>
                    <span className="text-[#FFCC00] font-mono font-bold">
                      {c.daily_double ? 'DD ' : ''}${c.value ?? 0}
                    </span>
                  </div>
                  <p className="text-lg font-medium leading-snug text-white">
                    {c.clue_text}
                  </p>
                  <p
                    className={`mt-3 font-bold transition-opacity ${
                      open ? 'text-[#FFCC00]' : 'text-blue-400 italic font-normal'
                    }`}
                  >
                    {open ? c.answer : 'tap to reveal'}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4 text-[#FFCC00]">knowledge graph</h2>
          <Graph />
        </section>
      </div>
    </div>
  )
}

export default App
