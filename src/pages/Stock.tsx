import { useMemo, useState } from 'react'
import { ChevronRight, Package } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Chips, EmptyState, SearchBox, Stepper, cx, inputCls, normalize } from '../components/ui'
import { num, productState, suggestedQty, unitInfo } from '../lib/calc'
import { openList } from '../lib/reducer'

type Filter = 'active' | 'low' | 'incomplete' | 'inactive' | 'all'

export function Stock() {
  const { state, dispatch, open } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [cat, setCat] = useState('')
  const inList = new Set(openList(state)?.items.map((i) => i.productId))
  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category).filter(Boolean))].sort(), [state.products])

  const is = {
    active: (p: (typeof state.products)[0]) => p.active,
    low: (p: (typeof state.products)[0]) => (suggestedQty(p) ?? 0) > 0,
    incomplete: (p: (typeof state.products)[0]) => productState(p) === 'incomplete',
    inactive: (p: (typeof state.products)[0]) => !p.active,
    all: () => true,
  }
  const list = state.products
    .filter(is[filter])
    .filter((p) => !cat || p.category === cat)
    .filter((p) => normalize(p.name + ' ' + p.category).includes(normalize(q)))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (!state.products.length)
    return (
      <EmptyState
        icon={<Package size={40} />}
        title="Nenhum produto cadastrado"
        text="Cadastre os produtos da casa com nome, unidade e quantidade em estoque. Consumo e preço podem ser preenchidos depois."
        action={<Button onClick={() => open({ kind: 'product' })}>Cadastrar primeiro produto</Button>}
      />
    )

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1"><SearchBox value={q} onChange={setQ} placeholder="Buscar produto" /></div>
        {categories.length > 0 && (
          <select className={cx(inputCls, 'w-auto max-w-[40%] pr-2')} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoria">
            <option value="">Categorias</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>
      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'Ativos', count: state.products.filter(is.active).length },
          { value: 'low', label: 'Abaixo do ideal', count: state.products.filter(is.low).length },
          { value: 'incomplete', label: 'Incompletos', count: state.products.filter(is.incomplete).length },
          { value: 'inactive', label: 'Inativos', count: state.products.filter(is.inactive).length },
          { value: 'all', label: 'Todos' },
        ]}
      />
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">Nenhum produto neste filtro.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {list.map((p) => {
            const st = productState(p)
            const sug = suggestedQty(p)
            return (
              <li key={p.id} className={cx('rounded-2xl border border-stone-200/80 bg-white p-3', !p.active && 'opacity-60')}>
                <div className="flex items-center gap-2">
                  <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" onClick={() => open({ kind: 'product', id: p.id })}>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-stone-900">{p.name}</span>
                        {st === 'incomplete' && <Badge tone="amber">Incompleto</Badge>}
                        {st === 'inactive' && <Badge>Inativo</Badge>}
                        {inList.has(p.id) && <Badge tone="teal">Na lista</Badge>}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {p.category || 'Sem categoria'}
                        {p.monthlyConsumption ? ` · consome ${num(p.monthlyConsumption)} ${p.unit}/mês` : ' · consumo não informado'}
                        {sug != null && sug > 0 && <span className="text-amber-700"> · comprar {num(sug)}</span>}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-stone-300" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-2">
                  <span className="text-sm text-stone-500">Em estoque ({unitInfo(p.unit).value})</span>
                  <Stepper size="sm" value={p.stock} step={unitInfo(p.unit).step} label={p.name} onChange={(n) => dispatch({ type: 'stock/set', id: p.id, qty: n })} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
