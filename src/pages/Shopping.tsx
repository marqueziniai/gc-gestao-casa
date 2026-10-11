import { useState } from 'react'
import { ArrowDownUp, Check, ChevronDown, ChevronRight, Plus, RotateCcw, ShoppingBasket } from 'lucide-react'
import { useStore } from '../store'
import { Button, EmptyState, Segmented, Stepper, cx } from '../components/ui'
import { dateLabel, money, num, qtyLabel, remainingQty, uid } from '../lib/calc'
import { openList } from '../lib/reducer'
import { currentMarket, groupByCategory, listTotals, orderedCategories } from '../lib/selectors'
import type { ListItem, Product } from '../types'

type Row = { item: ListItem; product: Product }

/** Compras: lista montada a partir do estoque, ordenada pelos corredores do mercado escolhido. */
export function Shopping() {
  const { state, dispatch, open, confirm, toast } = useStore()
  const ol = openList(state)
  const market = currentMarket(state)
  if (!ol || !market) return null

  const rows: Row[] = ol.items
    .map((item) => ({ item, product: state.products.find((p) => p.id === item.productId)! }))
    .filter((r) => r.product)
  const todo = rows.filter((r) => r.item.status === 'pending' || r.item.status === 'partial')
  const cart = rows.filter((r) => r.item.status === 'bought')
  const skipped = rows.filter((r) => r.item.status === 'skipped')
  const groups = groupByCategory(todo, (r) => r.product.category, orderedCategories(state)).map((g) => ({
    ...g,
    rows: g.rows.sort((a, b) => a.product.name.localeCompare(b.product.name)),
  }))
  const t = listTotals(state, ol)

  const finish = async () => {
    const ok = await confirm({
      title: 'Finalizar compras?',
      message:
        (todo.length ? `${todo.length} ${todo.length === 1 ? 'item ficou' : 'itens ficaram'} sem comprar e ${todo.length === 1 ? 'continua' : 'continuam'} na próxima lista. ` : '') +
        'A lista vai para o histórico; o estoque já está atualizado.',
      confirmLabel: 'Finalizar',
    })
    if (!ok) return
    dispatch({ type: 'list/close' })
    toast('Compras finalizadas')
  }

  return (
    <div className="space-y-3 md:max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl [scrollbar-width:none]">
          <Segmented value={market.id} onChange={(id) => dispatch({ type: 'market/select', id })} options={state.markets.map((m) => ({ value: m.id, label: m.name }))} />
        </div>
        <button type="button" onClick={() => open({ kind: 'marketOrder', id: market.id })} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-stone-600 ring-1 ring-stone-200" aria-label="Mercados e corredores" title="Mercados e corredores">
          <ArrowDownUp size={20} />
        </button>
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-stone-900">{todo.length === 0 ? 'Tudo comprado!' : `Faltam ${todo.length}`}</span>
            <span className="text-stone-500">{cart.length} no carrinho</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${t.count ? (t.done / t.count) * 100 : 0}%` }} />
          </div>
          {(t.priced > 0 || t.spent > 0) && (
            <p className="mt-2 text-xs text-stone-500">
              {t.priced > 0 && <>Estimado {money(t.estimated)}{t.partial && ' (parcial)'}</>}
              {t.spent > 0 && <> · Gasto {money(t.spent)}</>}
            </p>
          )}
        </div>
      )}

      {rows.length === 0 && (
        <EmptyState
          icon={<ShoppingBasket size={40} />}
          title="Nada faltando"
          text="Quando o Tenho ficar abaixo do Preciso no mês, o item aparece aqui sozinho."
          action={<Button variant="soft" onClick={() => open({ kind: 'pickItem' })}><Plus size={18} /> Adicionar item</Button>}
        />
      )}

      {groups.map((g) => (
        <section key={g.category}>
          <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-stone-500">{g.category}</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
            {g.rows.map((r) => <TodoRow key={r.product.id} {...r} />)}
          </ul>
        </section>
      ))}

      {rows.length > 0 && (
        <Button variant="secondary" className="w-full" onClick={() => open({ kind: 'pickItem' })}><Plus size={18} /> Adicionar item</Button>
      )}

      {cart.length > 0 && (
        <Collapsible title={`No carrinho (${cart.length})`} defaultOpen>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40">
            {cart.map((r) => <CartRow key={r.product.id} {...r} listId={ol.id} />)}
          </ul>
        </Collapsible>
      )}

      {skipped.length > 0 && (
        <Collapsible title={`Fora desta compra (${skipped.length})`}>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {skipped.map(({ product: p }) => (
              <li key={p.id} className="flex min-h-12 items-center justify-between gap-2 pl-4 pr-2 text-stone-500">
                {p.name}
                <Button variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => dispatch({ type: 'list/skip', productId: p.id, skip: false })}>
                  <RotateCcw size={16} /> Voltar
                </Button>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      {cart.length > 0 && <Button className="w-full" onClick={finish}>Finalizar compras</Button>}
      <History />
    </div>
  )
}

function TodoRow({ item, product: p }: Row) {
  const { dispatch, open, toast } = useStore()
  const buy = () => {
    dispatch({ type: 'purchase/register', id: uid(), productId: p.id, qty: remainingQty(item) || item.plannedQty || 1, unitPrice: null })
    toast(`${p.name} no carrinho`)
  }
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <button type="button" onClick={buy} aria-label={`Comprei ${p.name}`} className={cx('grid size-11 shrink-0 place-items-center rounded-full border-2 text-transparent transition-colors hover:text-teal-600 active:bg-teal-50', item.status === 'partial' ? 'border-amber-500' : 'border-stone-300')}>
        <Check size={20} strokeWidth={3} />
      </button>
      <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => open({ kind: 'purchase', productId: p.id })}>
        <span className="block truncate font-semibold text-stone-900">{p.name}</span>
        <span className="block text-xs text-stone-500">
          tem {num(p.stock)} · mês {num(p.monthlyConsumption ?? 0)} {p.unit === 'pct' ? 'pct' : 'un'}
          {item.status === 'partial' && ` · pegou ${num(item.boughtQty)}`}
          {p.avgPrice != null && ` · ${money(p.avgPrice)}`}
        </span>
      </button>
      <Stepper size="sm" value={item.plannedQty} label={p.name} onChange={(n) => dispatch({ type: 'list/setPlanned', productId: p.id, qty: n })} />
    </li>
  )
}

function CartRow({ item, product: p, listId }: Row & { listId: string }) {
  const { state, dispatch, open, toast } = useStore()
  const mine = state.purchases.filter((x) => x.listId === listId && x.productId === p.id)
  const spent = mine.reduce((t, x) => t + (x.unitPrice != null ? x.qty * x.unitPrice : 0), 0)
  const last = mine.at(-1)
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <button type="button" onClick={() => { dispatch({ type: 'list/undoItem', productId: p.id }); toast('Voltou para a lista') }} aria-label={`Desfazer compra de ${p.name}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
        <Check size={20} strokeWidth={3} />
      </button>
      <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => last && open({ kind: 'purchase', productId: p.id, purchaseId: last.id })}>
        <span className="block truncate font-medium text-stone-500 line-through decoration-stone-300">{p.name}</span>
        <span className="block text-xs text-stone-500">{qtyLabel(item.boughtQty, p.unit)}{spent > 0 ? ` · ${money(spent)}` : ' · toque para pôr o preço'}</span>
      </button>
    </li>
  )
}

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [openState, setOpen] = useState(!!defaultOpen)
  return (
    <section className="pt-2">
      <button type="button" onClick={() => setOpen(!openState)} className="flex min-h-11 w-full items-center justify-between text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
        <ChevronDown size={18} className={cx('transition-transform', openState && 'rotate-180')} />
      </button>
      {openState && children}
    </section>
  )
}

function History() {
  const { state, open } = useStore()
  const lists = state.lists.filter((l) => l.status === 'closed' || l.status === 'archived')
  if (!lists.length) return null
  return (
    <Collapsible title="Histórico">
      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200/80 bg-white">
        {lists.map((l) => {
          const t = listTotals(state, l)
          return (
            <li key={l.id}>
              <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 text-left" onClick={() => open({ kind: 'list', id: l.id })}>
                <span className="flex-1">
                  <span className="block font-medium text-stone-900">{l.closedAt ? `Compras de ${dateLabel(l.closedAt.slice(0, 10))}` : l.name}</span>
                  <span className="block text-xs text-stone-500">{t.done} de {t.count} itens</span>
                </span>
                {t.spent > 0 && <span className="text-sm font-semibold tabular-nums">{money(t.spent)}</span>}
                <ChevronRight size={16} className="text-stone-400" />
              </button>
            </li>
          )
        })}
      </ul>
    </Collapsible>
  )
}
