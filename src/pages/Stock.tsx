import { useState } from 'react'
import { ChevronDown, ChevronRight, Info, Package, ShoppingBasket } from 'lucide-react'
import { useStore } from '../store'
import { Button, EmptyState, SearchBox, Stepper, UnitToggle, cx, normalize } from '../components/ui'
import { num, suggestedQty, unitInfo } from '../lib/calc'
import { groupByCategory, orderedCategories } from '../lib/selectors'
import type { Product } from '../types'
import type { Tab } from '../App'

/** Estoque: cada produto já permite ajustar unidade, quanto tem e quanto precisa no mês. */
export function Stock({ go }: { go: (t: Tab) => void }) {
  const { state, open } = useStore()
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  if (!state.products.length)
    return (
      <EmptyState
        icon={<Package size={40} />}
        title="Nenhum produto"
        text="Cadastre o que a casa usa: nome, quanto tem e quanto precisa no mês."
        action={<Button onClick={() => open({ kind: 'product' })}>Cadastrar produto</Button>}
      />
    )

  const match = (p: Product) => normalize(p.name + ' ' + p.category).includes(normalize(q))
  const active = state.products.filter((p) => p.active && match(p)).sort((a, b) => a.name.localeCompare(b.name))
  const inactive = state.products.filter((p) => !p.active && match(p))
  const groups = groupByCategory(active, (p) => p.category, orderedCategories(state))
  const toBuy = state.products.filter((p) => (suggestedQty(p) ?? 0) > 0).length
  const fresh = state.purchases.length === 0 && state.products.every((p) => p.stock === 0)

  return (
    <div className="space-y-3">
      {fresh && (
        <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>Ajuste o <strong>Tenho</strong> de cada item com o que já está em casa. O que faltar para o mês vai sozinho para <strong>Compras</strong>.</p>
        </div>
      )}
      <SearchBox value={q} onChange={setQ} placeholder="Buscar produto" />
      {toBuy > 0 && !q && (
        <button type="button" onClick={() => go('compras')} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-teal-700 px-4 text-left text-white">
          <ShoppingBasket size={20} />
          <span className="flex-1 font-medium">{toBuy} {toBuy === 1 ? 'item para comprar' : 'itens para comprar'}</span>
          <ChevronRight size={18} />
        </button>
      )}

      {groups.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Nenhum produto encontrado.</p>}
      {groups.map((g) => (
        <section key={g.category}>
          <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-stone-500">{g.category}</h2>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {g.rows.map((p) => <StockRow key={p.id} product={p} />)}
          </ul>
        </section>
      ))}

      {inactive.length > 0 && (
        <div className="pt-4">
          <button type="button" onClick={() => setShowInactive(!showInactive)} className="flex min-h-11 items-center gap-2 text-sm font-medium text-stone-500">
            Inativos ({inactive.length}) <ChevronDown size={16} className={cx('transition-transform', showInactive && 'rotate-180')} />
          </button>
          {showInactive && (
            <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
              {inactive.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => open({ kind: 'product', id: p.id })} className="flex min-h-12 w-full items-center justify-between px-4 text-left text-stone-500">
                    {p.name} <ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function StockRow({ product: p }: { product: Product }) {
  const { dispatch, open } = useStore()
  const need = suggestedQty(p) ?? 0
  const u = unitInfo(p.unit)
  const update = (patch: Partial<Product>) => dispatch({ type: 'product/update', id: p.id, patch })
  return (
    <li className="rounded-2xl border border-stone-200/80 bg-white p-3">
      <div className="flex items-center gap-2">
        <button type="button" className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left" onClick={() => open({ kind: 'product', id: p.id })}>
          <span className="min-w-0 truncate font-semibold text-stone-900">{p.name}</span>
        </button>
        <UnitToggle size="sm" value={p.unit} onChange={(unit) => update({ unit })} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-xs font-medium text-stone-500">
            Tenho ({u.short}){need > 0 && <span className="text-amber-700"> · faltam {num(need)}</span>}
          </span>
          <Stepper size="sm" value={p.stock} label={`${p.name}, tenho`} onChange={(n) => dispatch({ type: 'stock/set', id: p.id, qty: n })} />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-stone-500">Preciso no mês</span>
          <Stepper size="sm" value={p.monthlyConsumption ?? 0} label={`${p.name}, preciso no mês`} onChange={(n) => update({ monthlyConsumption: n > 0 ? n : null })} />
        </div>
      </div>
    </li>
  )
}
