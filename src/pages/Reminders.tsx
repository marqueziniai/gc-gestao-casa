import { BellRing, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Button, EmptyState, SectionTitle } from '../components/ui'
import { ReminderCard } from '../components/ReminderCard'
import { reminderBuckets } from '../lib/selectors'

export function Reminders() {
  const { state, open } = useStore()
  const b = reminderBuckets(state)

  if (!b.all.length)
    return (
      <EmptyState
        icon={<BellRing size={40} />}
        title="Nenhum lembrete"
        text='Crie lembretes como "Tem creme dental?" a cada 2 meses. Você responde com um toque.'
        action={<Button onClick={() => open({ kind: 'reminder' })}><Plus size={18} /> Criar lembrete</Button>}
      />
    )

  const grid = 'grid gap-3 lg:grid-cols-2'
  return (
    <div>
      <SectionTitle>Verificar agora</SectionTitle>
      {b.overdue.length ? (
        <div className={grid}>{b.overdue.map((p) => <ReminderCard key={p.id} product={p} />)}</div>
      ) : (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-stone-500 ring-1 ring-stone-200">Tudo em dia. ✓</p>
      )}
      {b.upcoming.length > 0 && (
        <>
          <SectionTitle>Próximos</SectionTitle>
          <div className={grid}>{b.upcoming.map((p) => <ReminderCard key={p.id} product={p} />)}</div>
        </>
      )}
      {b.inactive.length > 0 && (
        <>
          <SectionTitle>Pausados e concluídos</SectionTitle>
          <div className={grid}>{b.inactive.map((p) => <ReminderCard key={p.id} product={p} />)}</div>
        </>
      )}
    </div>
  )
}
