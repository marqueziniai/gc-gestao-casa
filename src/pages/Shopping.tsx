import { useMemo, useState } from 'react'
import { Check, ChevronRight, EyeOff, Eye, Lock, Plus, RefreshCw, ShoppingBasket, Trash2, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Card, Chips, EmptyState, SearchBox, SectionTitle, Stepper, cx, normalize } from '../components/ui'
import { ItemStatusBadge } from '../components/Sheets'
import { IconBtn } from '../components/ReminderCard'
import { dateLabel, itemCost, money, num, qtyLabel, suggestedQty, unitInfo } from '../lib/calc'
import { openList } from '../lib/reducer'
import { listTotals, needsToBuy } from '../lib/selectors'
import type { ListItem, Product } from '../types'

type Filter = 'all' | 'todo' | 'done' | 'skipped'

export function Shopping() {
  const { state, dispatch, open, confirm, toast } = useStore()
  const ol = openList(state)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const rows = useMemo(() => {
    if (!ol) return []
    return ol.items
      .map((item) => ({ item, product: state.products.find((p) => p.id === item.productId)! }))
      .filter((r) => r.product)
      .filter((r) => normalize(r.product.name + ' ' + r.product.category).includes(normalize(q)))
      .filter(({ item: i }) =>
        filter === 'all' ? true : filter === 'todo' ? i.status === 'pending' || i.status === 'partial' : filter === 'done' ? i.status === 'bought' : i.status === 'skipped',
      )
      .sort((a, b) => {
        const rank = (i: ListItem) => ({ partial: 0, pending: 0, bought: 1, skipped: 2 })[i.status]
        return rank(a.item) - rank(b.item) || (a.product.category || 'zz').localeCompare(b.product.category || 'zz') || a.product.name.localeCompare(b.product.name)
      })
  }, [ol, state.products, q, filter])

  if (!ol) {
    const needs = needsToBuy(state)
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<ShoppingBasket size={40} />}
          title="Nenhuma lista aberta"
          text={
            needs.length
              ? `${needs.length} ${needs.length === 1 ? 'produto precisa' : 'produtos precisam'} de reposição. Gere a lista do mês com as quantidades sugeridas — você pode ajustar tudo depois.`
              : 'Gere a lista do mês. Produtos com consumo configurado entram automaticamente quando o estoque estiver abaixo do ideal.'
          }
          action={
            <Button onClick={() => { dispatch({ type: 'list/generate' }); toast('Lista do mês gerada') }}>
              <Plus size={18} /> Gerar lista do mês
            </Button>
          }
        />
        <History />
      </div>
    )
  }

  const t = listTotals(state, ol)
  const counts = {
    all: ol.items.length,
    todo: ol.items.filter((i) => i.status === 'pending' || i.status === 'partial').length,
    done: ol.items.filter((i) => i.status === 'bought').length,
    skipped: ol.items.filter((i) => i.status === 'skipped').length,
  }

  const closeCycle = async () => {
    const left = counts.todo
    const ok = await confirm({
      title: 'Fechar ciclo de compras?',
      message:
        (left ? `${left === 1 ? '1 item não foi comprado' : `${left} itens não foram comprados`} — ${left === 1 ? 'ele volta' : 'eles voltam'} a ser sugerido${left === 1 ? '' : 's'} na próxima lista. ` : '') +
        'A lista vai para o histórico. Estoque e compras registradas não são alterados.',
      confirmLabel: 'Fechar ciclo',
    })
    if (!ok) return
    dispatch({ type: 'list/close' })
    toast('Ciclo fechado e arquivado no histórico')
  }

  return (
    <div className="space-y-4 md:grid md:grid-cols-[1fr_300px] md:items-start md:gap-6 md:space-y-0">
      <div className="space-y-3">
        {/* resumo da lista */}
        <Card className="md:hidden">
          <Summary t={t} status={ol.status} />
        </Card>
        <div className="flex gap-2">
          <div className="flex-1"><SearchBox value={q} onChange={setQ} placeholder="Buscar na lista" /></div>
          <Button variant="secondary" className="px-3" onClick={() => open({ kind: 'pickItem' })} aria-label="Adicionar item à lista"><Plus size={20} /></Button>
        </div>
        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos', count: counts.all },
            { value: 'todo', label: 'A comprar', count: counts.todo },
            { value: 'done', label: 'Comprados', count: counts.done },
            { value: 'skipped', label: 'Ignorados', count: counts.skipped },
          ]}
        />
        {ol.items.length === 0 ? (
          <EmptyState icon={<ShoppingBasket size={36} />} title="Lista vazia" text="Nada precisa de reposição agora. Adicione produtos manualmente pelo botão +." action={<Button variant="soft" onClick={() => open({ kind: 'pickItem' })}><Plus size={18} /> Adicionar item</Button>} />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-500">Nenhum item neste filtro.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => <ItemRow key={r.item.productId} item={r.item} product={r.product} />)}
          </ul>
        )}
      </div>

      <div className="space-y-3 md:sticky md:top-6">
        <Card className="hidden md:block"><Summary t={t} status={ol.status} /></Card>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
          {ol.status === 'preparing' && (
            <Button className="col-span-2 md:col-span-1" onClick={() => { dispatch({ type: 'list/start' }); toast('Boas compras!') }}>
              <ShoppingBasket size={18} /> Iniciar compras
            </Button>
          )}
          <Button variant="secondary" onClick={() => { dispatch({ type: 'list/refresh' }); toast('Sugestões revisadas') }}>
            <RefreshCw size={16} /> Revisar sugestões
          </Button>
          <Button variant="secondary" onClick={closeCycle}><Lock size={16} /> Fechar ciclo</Button>
        </div>
        <History />
      </div>
    </div>
  )
}

function Summary({ t, status }: { t: ReturnType<typeof listTotals>; status: string }) {
  const pct = t.count ? Math.round((t.done / t.count) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">Total estimado</span>
        <Badge tone={status === 'active' ? 'teal' : 'neutral'}>{status === 'active' ? 'Ativa' : 'Em preparação'}</Badge>
      </div>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-stone-900">{t.estimated > 0 || !t.partial ? money(t.estimated) : 'Sem preços ainda'}</p>
      {t.partial && <p className="text-xs text-amber-700">Total parcial — há itens sem preço informado</p>}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-stone-600">
        <span>{t.done} de {t.count} comprados</span>
        <span>Gasto: <strong className="text-stone-900">{money(t.spent)}</strong></span>
      </div>
    </div>
  )
}

function ItemRow({ item, product: p }: { item: ListItem; product: Product }) {
  const { dispatch, open, toast, confirm } = useStore()
  const sug = suggestedQty(p)
  const cost = itemCost(item.plannedQty, p.avgPrice)
  const done = item.status === 'bought'
  const skipped = item.status === 'skipped'
  const u = unitInfo(p.unit).value

  const undo = async () => {
    if (!(await confirm({ title: 'Desfazer compra?', message: `As compras de ${p.name} nesta lista serão excluídas e o estoque reduzido em ${qtyLabel(item.boughtQty, p.unit)}.`, confirmLabel: 'Desfazer', danger: true }))) return
    dispatch({ type: 'list/undoItem', productId: p.id })
    toast('Compra desfeita')
  }

  return (
    <li className={cx('rounded-2xl border bg-white p-3 transition-opacity', done ? 'border-emerald-200 bg-emerald-50/40' : 'border-stone-200/80', skipped && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => (done ? undo() : open({ kind: 'purchase', productId: p.id }))}
          disabled={skipped}
          aria-label={done ? `Desfazer compra de ${p.name}` : `Registrar compra de ${p.name}`}
          className={cx(
            'grid size-11 shrink-0 place-items-center rounded-full border-2 transition-colors',
            done ? 'border-emerald-600 bg-emerald-600 text-white' : item.status === 'partial' ? 'border-amber-500 text-amber-600' : 'border-stone-300 text-transparent hover:border-teal-600 hover:text-teal-600',
          )}
        >
          <Check size={20} strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-w-0 text-left" onClick={() => open({ kind: 'product', id: p.id })}>
              <p className={cx('font-semibold leading-tight text-stone-900', done && 'line-through decoration-stone-400')}>{p.name}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {p.category || 'Sem categoria'} · estoque {num(p.stock)} {u}
                {sug != null && ` · sugerido ${num(sug)}`}
              </p>
            </button>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums text-stone-900">{cost != null ? money(cost) : '—'}</p>
              <p className={cx('text-xs', p.avgPrice == null ? 'text-amber-700' : 'text-stone-500')}>
                {p.avgPrice != null ? `${money(p.avgPrice)}/${u}` : 'Preço não informado'}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {done ? (
              <p className="text-sm text-emerald-800">Comprado: {qtyLabel(item.boughtQty, p.unit)}</p>
            ) : skipped ? (
              <ItemStatusBadge status="skipped" />
            ) : (
              <Stepper size="sm" value={item.plannedQty} step={p.packSize ?? unitInfo(p.unit).step} label={p.name} onChange={(n) => dispatch({ type: 'list/setPlanned', productId: p.id, qty: n })} />
            )}
            <div className="flex items-center">
              {item.status === 'partial' && <span className="mr-1"><Badge tone="amber">{num(item.boughtQty)} de {num(item.plannedQty)}</Badge></span>}
              {done || item.status === 'partial' ? (
                <IconBtn label="Desfazer compra" onClick={undo}><Undo2 size={18} /></IconBtn>
              ) : (
                <>
                  <IconBtn label={skipped ? 'Voltar a comprar' : 'Ignorar neste ciclo'} onClick={() => { dispatch({ type: 'list/skip', productId: p.id, skip: !skipped }); toast(skipped ? 'Item reativado' : 'Item ignorado neste ciclo') }}>
                    {skipped ? <Eye size={18} /> : <EyeOff size={18} />}
                  </IconBtn>
                  <IconBtn label="Remover da lista" onClick={() => { dispatch({ type: 'list/removeItem', productId: p.id }); toast('Item removido da lista') }}><Trash2 size={18} /></IconBtn>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

function History() {
  const { state, open } = useStore()
  const lists = state.lists.filter((l) => l.status === 'closed' || l.status === 'archived')
  if (!lists.length) return null
  return (
    <div>
      <SectionTitle>Histórico</SectionTitle>
      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200/80 bg-white">
        {lists.map((l) => {
          const t = listTotals(state, l)
          return (
            <li key={l.id}>
              <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 text-left" onClick={() => open({ kind: 'list', id: l.id })}>
                <span className="flex-1">
                  <span className="block font-medium text-stone-900">{l.name}</span>
                  <span className="block text-xs text-stone-500">
                    {l.status === 'archived' ? 'Arquivada' : 'Fechada'} {l.closedAt && `em ${dateLabel(l.closedAt.slice(0, 10))}`} · {t.done}/{t.count} itens
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{money(t.spent)}</span>
                <ChevronRight size={16} className="text-stone-400" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
