import { CalendarClock, Check, Pause, Pencil, Play, ShoppingCart, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Card, type Tone } from './ui'
import { dateLabel, daysBetween, reminderView, today } from '../lib/calc'
import type { Product, ReminderView } from '../types'

const VIEW: Record<ReminderView, [string, Tone]> = {
  overdue: ['Vencido', 'red'],
  scheduled: ['Agendado', 'teal'],
  snoozed: ['Adiado', 'amber'],
  done: ['Concluído', 'green'],
  paused: ['Pausado', 'neutral'],
}

function when(date: string) {
  const d = daysBetween(today(), date)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d === -1) return 'venceu ontem'
  if (d < 0) return `venceu há ${-d} dias`
  return d <= 30 ? `em ${d} dias` : dateLabel(date)
}

export function ReminderCard({ product: p, compact }: { product: Product; compact?: boolean }) {
  const { dispatch, toast, open, confirm } = useStore()
  const r = p.reminder!
  const view = reminderView(r)
  const [label, tone] = VIEW[view]
  const actionable = view !== 'paused' && view !== 'done'

  const needBuy = () => {
    dispatch({ type: 'reminder/needBuy', productId: p.id })
    toast(`${p.name} está na lista de compras`)
  }
  const snooze = () => {
    dispatch({ type: 'reminder/snooze', productId: p.id })
    toast('Lembrete adiado por 7 dias')
  }
  const remove = async () => {
    if (await confirm({ title: 'Remover lembrete?', message: `O lembrete de ${p.name} será removido. O produto continua cadastrado.`, confirmLabel: 'Remover', danger: true })) {
      dispatch({ type: 'reminder/remove', productId: p.id })
      toast('Lembrete removido')
    }
  }

  return (
    <Card className={view === 'overdue' ? 'border-red-200' : undefined}>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500"><CalendarClock size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-stone-900">Tem {p.name.toLowerCase()}?</p>
            <Badge tone={tone}>{label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-stone-500">
            {actionable ? when(r.nextCheck) : view === 'paused' ? 'pausado' : `concluído${r.lastCheck ? ' em ' + dateLabel(r.lastCheck) : ''}`}
            {r.everyMonths ? ` · a cada ${r.everyMonths} ${r.everyMonths === 1 ? 'mês' : 'meses'}` : ' · lembrete único'}
          </p>
        </div>
      </div>
      {actionable && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="soft" className="px-2 text-sm" onClick={() => open({ kind: 'enough', productId: p.id })}><Check size={16} /> Tenho</Button>
          <Button variant="primary" className="px-2 text-sm" onClick={needBuy}><ShoppingCart size={16} /> Comprar</Button>
          <Button variant="secondary" className="px-2 text-sm" onClick={snooze}>Adiar 7d</Button>
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex justify-end gap-1 border-t border-stone-100 pt-2">
          <IconBtn label="Editar lembrete" onClick={() => open({ kind: 'reminder', productId: p.id })}><Pencil size={16} /></IconBtn>
          {view === 'done' ? (
            <IconBtn label="Reativar lembrete" onClick={() => open({ kind: 'reminder', productId: p.id })}><Play size={16} /></IconBtn>
          ) : (
            <IconBtn
              label={view === 'paused' ? 'Retomar lembrete' : 'Pausar lembrete'}
              onClick={() => {
                dispatch({ type: 'reminder/pause', productId: p.id, paused: view !== 'paused' })
                toast(view === 'paused' ? 'Lembrete retomado' : 'Lembrete pausado')
              }}
            >
              {view === 'paused' ? <Play size={16} /> : <Pause size={16} />}
            </IconBtn>
          )}
          <IconBtn label="Remover lembrete" onClick={remove}><Trash2 size={16} /></IconBtn>
        </div>
      )}
    </Card>
  )
}

export function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-10 place-items-center rounded-xl text-stone-500 hover:bg-stone-100 active:bg-stone-200">
      {children}
    </button>
  )
}
