import { useState } from 'react'
import { BellRing, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Button, Chips, EmptyState, SectionTitle } from '../components/ui'
import { ReminderCard } from '../components/ReminderCard'
import { monthName } from '../lib/calc'
import { reminderBuckets } from '../lib/selectors'

type Tab = 'due' | 'month' | 'all'

export function Reminders() {
  const { state, open } = useStore()
  const b = reminderBuckets(state)
  const [tab, setTab] = useState<Tab>(b.overdue.length ? 'due' : 'month')

  if (!b.all.length)
    return (
      <EmptyState
        icon={<BellRing size={40} />}
        title="Nenhum lembrete"
        text='Crie lembretes como "Tem pasta de dente?" a cada 2 meses. Você responde com um toque e o estoque fica em dia.'
        action={<Button onClick={() => open({ kind: 'reminder' })}><Plus size={18} /> Criar lembrete</Button>}
      />
    )

  const grid = 'grid gap-3 lg:grid-cols-2'
  return (
    <div className="space-y-3">
      <Chips<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'due', label: 'Vencidos', count: b.overdue.length },
            { value: 'month', label: 'Revisão do mês', count: b.month.length },
            { value: 'all', label: 'Todos', count: b.all.length },
          ]}
        />

      {tab === 'due' &&
        (b.overdue.length ? (
          <div className={grid}>{b.overdue.map((p) => <ReminderCard key={p.id} product={p} />)}</div>
        ) : (
          <EmptyState icon={<BellRing size={32} />} title="Tudo em dia" text="Nenhuma verificação vencida. Veja a revisão do mês para se antecipar." />
        ))}

      {tab === 'month' && (
        <>
          <p className="text-sm text-stone-500">
            Verificações até o fim de {monthName().split(' ')[0].toLowerCase()}, consolidadas por produto. Responda todas de uma vez para deixar o mês em dia.
          </p>
          {b.month.length ? (
            <div className={grid}>{b.month.map((p) => <ReminderCard key={p.id} product={p} />)}</div>
          ) : (
            <EmptyState icon={<BellRing size={32} />} title="Nada para revisar este mês" text="As próximas verificações aparecem aqui quando estiverem perto." />
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          {b.upcoming.length + b.overdue.length > 0 && (
            <>
              <SectionTitle>Agendados</SectionTitle>
              <div className={grid}>{[...b.overdue, ...b.upcoming].map((p) => <ReminderCard key={p.id} product={p} />)}</div>
            </>
          )}
          {b.inactive.length > 0 && (
            <>
              <SectionTitle>Pausados e concluídos</SectionTitle>
              <div className={grid}>{b.inactive.map((p) => <ReminderCard key={p.id} product={p} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
