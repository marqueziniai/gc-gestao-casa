import { useState } from 'react'
import { History } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, EmptyState, Sheet } from './ui'
import { toISODate } from '../lib/calc'
import type { LogEntry } from '../types'

const PAGE = 60

function dayLabel(iso: string) {
  const d = toISODate(new Date(iso))
  const today = toISODate(new Date())
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (d === today) return 'Hoje'
  if (d === toISODate(y)) return 'Ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Histórico de alterações: o que foi feito, por qual aparelho e quando. */
export function LogSheet() {
  const { state, close, sync } = useStore()
  const [limit, setLimit] = useState(PAGE)
  const me = sync.cfg?.device?.trim() || 'Este aparelho'
  const entries = state.log.slice(0, limit)

  const groups: { day: string; items: LogEntry[] }[] = []
  for (const e of entries) {
    const day = dayLabel(e.at)
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1)!.items.push(e)
  }

  return (
    <Sheet title="Histórico de alterações" onClose={close}>
      {state.log.length === 0 ? (
        <EmptyState icon={<History size={36} />} title="Nada registrado ainda" text="As alterações feitas a partir de agora aparecem aqui, com o nome de quem fez." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.day}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{g.day}</h3>
              <ul className="divide-y divide-stone-100 rounded-xl bg-white ring-1 ring-stone-200">
                {g.items.map((e) => (
                  <li key={e.id} className="flex gap-3 px-3 py-2">
                    <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-stone-400">{timeLabel(e.at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-stone-800">{e.text}</span>
                      <span className="mt-0.5 block">
                        <Badge tone={e.by === me ? 'teal' : 'blue'}>{e.by}</Badge>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {state.log.length > limit && (
            <Button variant="secondary" className="w-full" onClick={() => setLimit(limit + PAGE)}>Ver mais</Button>
          )}
          <p className="text-center text-xs text-stone-400">Guarda as últimas {300} alterações.</p>
        </div>
      )}
    </Sheet>
  )
}
