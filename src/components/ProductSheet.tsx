import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, NumInput, Sheet, Stepper, UnitToggle, cx, inputCls, normalize } from './ui'
import { addMonths, dateLabel, money, parseNum, qtyLabel, today, uid } from '../lib/calc'
import { orderedCategories } from '../lib/selectors'
import type { Unit } from '../types'

const NEW_CAT = '__nova__'
const EVERY = [
  { v: '', label: 'Sem lembrete' },
  { v: '1', label: 'Todo mês' },
  { v: '2', label: 'A cada 2 meses' },
  { v: '3', label: 'A cada 3 meses' },
  { v: '6', label: 'A cada 6 meses' },
  { v: '12', label: 'Uma vez por ano' },
]

/** Cadastro e edição de produto: nome, categoria, unidade, tenho, preciso no mês. Preço e lembrete opcionais. */
export function ProductSheet({ id, addToList }: { id?: string; addToList?: boolean }) {
  const { state, dispatch, toast, close, confirm, open } = useStore()
  const existing = id ? state.products.find((p) => p.id === id) : undefined
  const categories = useMemo(() => orderedCategories(state), [state])
  const purchases = useMemo(
    () => (existing ? state.purchases.filter((x) => x.productId === existing.id).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)) : []),
    [existing, state.purchases],
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState(existing?.category || categories[0] || 'Outros')
  const [newCat, setNewCat] = useState('')
  const [unit, setUnit] = useState<Unit>(existing?.unit ?? 'un')
  const [stock, setStock] = useState(existing?.stock ?? 0)
  const [monthly, setMonthly] = useState(existing?.monthlyConsumption ?? 1)
  const [price, setPrice] = useState(existing?.avgPrice == null ? '' : existing.avgPrice.toFixed(2).replace('.', ','))
  const [every, setEvery] = useState(String(existing?.reminder?.everyMonths ?? ''))
  const [submitted, setSubmitted] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const dup = state.products.find((p) => p.id !== id && normalize(p.name.trim()) === normalize(name.trim()))
  const nameError = !name.trim() ? 'Informe o nome.' : dup ? `Já existe "${dup.name}".` : null
  const priceN = parseNum(price)
  const priceError = price.trim() && (priceN == null || priceN < 0 || priceN > 100000) ? 'Preço inválido.' : null
  const finalCat = (category === NEW_CAT ? newCat : category).trim()
  const catError = category === NEW_CAT && !finalCat ? 'Informe a categoria.' : null
  const valid = !nameError && !priceError && !catError

  const save = () => {
    setSubmitted(true)
    if (!valid) return
    const data = { name: name.trim(), unit, stock, category: finalCat, monthlyConsumption: monthly > 0 ? monthly : null, avgPrice: priceN }
    const pid = existing?.id ?? uid()
    if (existing) dispatch({ type: 'product/update', id: pid, patch: data })
    else dispatch({ type: 'product/add', id: pid, data, addToList })
    const everyN = every ? Number(every) : null
    const r = existing?.reminder
    if (everyN && (!r || r.everyMonths !== everyN))
      dispatch({ type: 'reminder/set', productId: pid, everyMonths: everyN, nextCheck: r?.nextCheck ?? addMonths(today(), everyN) })
    if (!everyN && r) dispatch({ type: 'reminder/remove', productId: pid })
    toast(existing ? 'Produto salvo' : 'Produto cadastrado')
    close()
  }

  const toggleActive = async () => {
    if (!existing) return
    if (existing.active && !(await confirm({ title: 'Desativar produto?', message: `"${existing.name}" sai do estoque e das compras. O histórico fica guardado e dá para reativar depois.`, confirmLabel: 'Desativar' }))) return
    dispatch({ type: 'product/update', id: existing.id, patch: { active: !existing.active } })
    toast(existing.active ? 'Produto desativado' : 'Produto reativado')
    close()
  }
  const remove = async () => {
    if (!existing || !(await confirm({ title: 'Excluir produto?', message: `"${existing.name}" será excluído.`, confirmLabel: 'Excluir', danger: true }))) return
    dispatch({ type: 'product/delete', id: existing.id })
    toast('Produto excluído')
    close()
  }

  return (
    <Sheet title={existing ? 'Editar produto' : 'Novo produto'} onClose={close} footer={<Button className="w-full" onClick={save}>{existing ? 'Salvar' : 'Cadastrar'}</Button>}>
      <div className="space-y-4">
        <Field label="Nome" error={submitted || name ? nameError ?? undefined : undefined}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Refrigerante" maxLength={60} enterKeyHint="done" />
        </Field>
        <Field label="Categoria (corredor)" error={submitted ? catError ?? undefined : undefined}>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={NEW_CAT}>+ Nova categoria…</option>
          </select>
        </Field>
        {category === NEW_CAT && <input className={inputCls} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ex.: Pet" maxLength={30} autoFocus />}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-stone-700">Contar por</span>
          <UnitToggle value={unit} onChange={setUnit} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-700">Tenho</span>
            <Stepper size="sm" value={stock} onChange={setStock} label="tenho" />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-700">Preciso no mês</span>
            <Stepper size="sm" value={monthly} onChange={setMonthly} label="preciso no mês" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço médio (opcional)" error={priceError ?? undefined}>
            <NumInput value={price} onChange={setPrice} placeholder="R$" />
          </Field>
          <Field label="Lembrete">
            <select className={inputCls} value={every} onChange={(e) => setEvery(e.target.value)}>
              {EVERY.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {existing && (
          <>
            {purchases.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowHistory(!showHistory)} className="flex min-h-11 w-full items-center justify-between text-sm font-semibold text-stone-600">
                  Compras registradas ({purchases.length})
                  <ChevronDown size={18} className={cx('transition-transform', showHistory && 'rotate-180')} />
                </button>
                {showHistory && (
                  <ul className="divide-y divide-stone-200 rounded-xl bg-white ring-1 ring-stone-200">
                    {purchases.slice(0, 12).map((x) => (
                      <li key={x.id}>
                        <button type="button" className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm" onClick={() => open({ kind: 'purchase', productId: existing.id, purchaseId: x.id, back: { kind: 'product', id: existing.id } })}>
                          <span className="w-14 text-stone-500">{dateLabel(x.date)}</span>
                          <span className="flex-1">{qtyLabel(x.qty, existing.unit)}</span>
                          <span className="font-medium">{x.unitPrice != null ? money(x.qty * x.unitPrice) : 'sem preço'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={toggleActive}>{existing.active ? 'Desativar' : 'Reativar'}</Button>
              {purchases.length === 0 && <Button variant="ghost" className="flex-1 text-red-600" onClick={remove}>Excluir</Button>}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
