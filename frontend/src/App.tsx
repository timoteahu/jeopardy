import { useEffect, useState } from 'react'

type Clue = {
  id: number
  clue_text: string
  answer: string
  value: number | null
  round: string
}

function App() {
  const [clues, setClues] = useState<Clue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clues')
      .then((r) => r.json())
      .then((data: Clue[]) => {
        setClues(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-emerald-400">Jeopardy Brain</h1>
        <p className="text-slate-400 mt-2">study smarter with a knowledge graph</p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">clues</h2>
        {loading ? (
          <p className="text-slate-500">loading...</p>
        ) : clues.length === 0 ? (
          <p className="text-slate-500">no clues yet. seed the database.</p>
        ) : (
          <div className="grid gap-4">
            {clues.map((c) => (
              <div
                key={c.id}
                className="bg-slate-900 rounded-lg p-4 border border-slate-800 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    {c.round}
                  </span>
                  <span className="text-emerald-400 font-mono">
                    ${c.value ?? 0}
                  </span>
                </div>
                <p className="text-lg font-medium leading-snug">{c.clue_text}</p>
                <p className="text-slate-300 mt-3 font-semibold">{c.answer}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default App
