import { AlertCircle, ChevronRight, FlaskConical, ShoppingBasket } from 'lucide-react'
import { useStore } from '../store'
import { Button, Card, SectionTitle } from '../components/ui'
import { ReminderCard } from '../components/ReminderCard'
import { itemCost, money, productState, qtyLabel } from '../lib/calc'
import { openList } from '../lib/reducer'
import { listTotals, needsToBuy, reminderBuckets } from '../lib/selectors'
import type { Tab } from '../App'

export function Home({ go }: { go: (t: Tab) => void }) {
  const { state, dispatch, toast, confirm } = useStore()
  const ol = openList(state)
  const needs = needsToBuy(state)
  const reminders = reminderBuckets(state)
  const incomplete = state.products.filter((p) => productState(p) === 'incomplete').length

  // itens a comprar: da lista aberta (pendentes) ou, sem lista, das sugestões
  const toBuy = ol
    ? ol.items
        .filter((i) => i.status === 'pending' || i.status === 'partial')
        .map((i) => ({ product: state.products.find((p) => p.id === i.productId)!, qty: Math.max(0, i.plannedQty - i.boughtQty) }))
        .filter((x) => x.product)
    : needs
  let estimate = 0
  let partial = false
  for (const x of needs) {
    const c = itemCost(x.qty, x.product.avgPrice)
    if (c == null) partial = true
    else estimate += c
  }
  const totals = ol ? listTotals(state, ol) : null

  const startFresh = async () => {
    if (await confirm({ title: 'Começar do zero?', message: 'Os dados de demonstração serão apagados para você cadastrar os seus produtos. Dá para restaurá-los depois em Ajustes.', confirmLabel: 'Apagar demonstração', danger: true })) {
      dispatch({ type: 'demo/clear' })
      toast('Pronto! Toque em + para cadastrar seu primeiro produto')
    }
  }

  return (
    <div className="space-y-4">
      {state.demo && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <FlaskConical size={20} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p><strong>Dados de demonstração.</strong> Explore à vontade — produtos, preços e lembretes são fictícios.</p>
            <button type="button" onClick={startFresh} className="mt-1 min-h-9 font-semibold underline underline-offset-2">Começar com meus dados</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          {ol && totals ? (
            <>
              <p className="text-sm text-stone-500">Lista de {ol.name.toLowerCase()} · {ol.status === 'active' ? 'em andamento' : 'em preparação'}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{money(totals.estimated)}</p>
              <p className="text-sm text-stone-500">estimado{totals.partial && ' (parcial)'} · gasto {money(totals.spent)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${totals.count ? (totals.done / totals.count) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 text-sm text-stone-600">{totals.done} de {totals.count} itens comprados</p>
              <Button className="mt-3 w-full" onClick={() => go('compras')}><ShoppingBasket size={18} /> Abrir lista</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-500">Custo estimado para repor</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{money(estimate)}</p>
              <p className="text-sm text-stone-500">
                {needs.length} {needs.length === 1 ? 'item precisa' : 'itens precisam'} de compra{partial && ' · total parcial (há itens sem preço)'}
              </p>
              <Button className="mt-3 w-full" onClick={() => { dispatch({ type: 'list/generate' }); toast('Lista do mês gerada'); go('compras') }}>
                <ShoppingBasket size={18} /> Gerar lista do mês
              </Button>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Lembretes</p>
            <button type="button" className="flex min-h-9 items-center text-sm font-medium text-teal-800" onClick={() => go('lembretes')}>Ver todos <ChevronRight size={16} /></button>
          </div>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{reminders.overdue.length}</p>
          <p className="text-sm text-stone-500">
            {reminders.overdue.length === 1 ? 'verificação pendente' : 'verificações pendentes'} · {reminders.month.length} na revisão do mês
          </p>
          {incomplete > 0 && (
            <button type="button" onClick={() => go('estoque')} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
              <AlertCircle size={16} className="shrink-0" />
              {incomplete} {incomplete === 1 ? 'produto sem' : 'produtos sem'} consumo ou preço — complete para receber sugestões.
            </button>
          )}
        </Card>
      </div>

      {reminders.overdue.length > 0 && (
        <section>
          <SectionTitle>Verificar agora</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {reminders.overdue.slice(0, 4).map((p) => <ReminderCard key={p.id} product={p} compact />)}
          </div>
        </section>
      )}

      <section>
        <SectionTitle action={toBuy.length > 0 && <button type="button" className="min-h-9 text-sm font-medium text-teal-800" onClick={() => go('compras')}>Ver lista</button>}>
          Precisa comprar
        </SectionTitle>
        {toBuy.length === 0 ? (
          <Card><p className="text-sm text-stone-500">Nada para comprar agora. O estoque está dentro do planejado. 🎉</p></Card>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white">
            {toBuy.slice(0, 6).map(({ product: p, qty }) => (
              <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-900">{p.name}</span>
                  <span className="block text-xs text-stone-500">estoque {qtyLabel(p.stock, p.unit)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{qtyLabel(qty, p.unit)}</span>
                  <span className="block text-xs text-stone-500">{p.avgPrice != null ? money(qty * p.avgPrice) : 'Preço não informado'}</span>
                </span>
              </li>
            ))}
            {toBuy.length > 6 && <li className="px-4 py-2 text-center text-sm text-stone-500">+ {toBuy.length - 6} itens</li>}
          </ul>
        )}
      </section>
    </div>
  )
}
