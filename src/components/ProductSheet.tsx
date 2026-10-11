import { useMemo, useState } from 'react'
import { ChevronDown, Pencil, ShoppingCart } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Field, NumInput, Sheet, Stepper, cx, inputCls, normalize } from './ui'
import { UNITS, dateLabel, money, num, parseNum, productState, qtyLabel, suggestedQty, today, uid, unitInfo, addMonths } from '../lib/calc'
import type { Product, Unit } from '../types'

const str = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

/** Cadastro rápido (nome, unidade, estoque) e edição completa do produto. */
export function ProductSheet({ id, addToList }: { id?: string; addToList?: boolean }) {
  const { state, dispatch, toast, close, confirm, open } = useStore()
  const existing = id ? state.products.find((p) => p.id === id) : undefined
  const purchases = useMemo(
    () => (existing ? state.purchases.filter((x) => x.productId === existing.id).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)) : []),
    [existing, state.purchases],
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [unit, setUnit] = useState<Unit>(existing?.unit ?? 'un')
  const [stock, setStock] = useState(existing?.stock ?? 0)
  const [category, setCategory] = useState(existing?.category ?? '')
  const [consumption, setConsumption] = useState(str(existing?.monthlyConsumption))
  const [coverage, setCoverage] = useState(str(existing?.coverageMonths ?? 1))
  const [safety, setSafety] = useState(str(existing?.safetyStock ?? 0))
  const [pack, setPack] = useState(str(existing?.packSize))
  const [price, setPrice] = useState(str(existing?.avgPrice))
  const [every, setEvery] = useState(str(existing?.reminder?.everyMonths))
  const [toList, setToList] = useState(!!addToList)
  const [more, setMore] = useState(!!existing)
  const [submitted, setSubmitted] = useState(false)

  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category).filter(Boolean))].sort(), [state.products])

  // validação
  const errors: Record<string, string> = {}
  const dup = state.products.find((p) => p.id !== id && normalize(p.name.trim()) === normalize(name.trim()))
  if (!name.trim()) errors.name = 'Informe o nome do produto.'
  else if (dup) errors.name = `Já existe um produto chamado "${dup.name}".`
  const nums = { consumption, coverage, safety, pack, price, every }
  const parsed = Object.fromEntries(Object.entries(nums).map(([k, v]) => [k, parseNum(v)])) as Record<keyof typeof nums, number | null>
  for (const [k, v] of Object.entries(nums)) {
    const n = parseNum(v)
    if (v.trim() && (n == null || n < 0)) errors[k] = 'Valor inválido.'
  }
  if (parsed.coverage != null && parsed.coverage <= 0) errors.coverage = 'Use um valor maior que zero.'
  if (parsed.price != null && parsed.price > 100000) errors.price = 'Preço muito alto.'
  if (parsed.every != null && (parsed.every < 1 || parsed.every > 24 || !Number.isInteger(parsed.every))) errors.every = 'Use de 1 a 24 meses.'
  const valid = Object.keys(errors).length === 0

  const draft: Product = {
    ...(existing ?? ({} as Product)),
    name, unit, stock, category: category.trim(),
    monthlyConsumption: parsed.consumption && parsed.consumption > 0 ? parsed.consumption : null,
    coverageMonths: parsed.coverage || 1,
    safetyStock: parsed.safety ?? 0,
    packSize: parsed.pack && parsed.pack > 0 ? parsed.pack : null,
    avgPrice: parsed.price,
    active: existing?.active ?? true,
  }
  const suggestion = suggestedQty({ ...draft, active: true })
  const hasHistory = purchases.length > 0

  const save = () => {
    setSubmitted(true)
    if (!valid) {
      setMore(true)
      return
    }
    const everyN = parsed.every ? Math.round(parsed.every) : null
    const data = {
      name: draft.name, unit, stock, category: draft.category,
      monthlyConsumption: draft.monthlyConsumption, coverageMonths: draft.coverageMonths, safetyStock: draft.safetyStock,
      packSize: draft.packSize, ...(hasHistory ? {} : { avgPrice: draft.avgPrice }),
    }
    const pid = existing?.id ?? uid()
    if (existing) dispatch({ type: 'product/update', id: pid, patch: data })
    else dispatch({ type: 'product/add', id: pid, data, addToList: toList })
    // lembrete: criar, alterar frequência ou remover
    const r = existing?.reminder
    if (everyN && (!r || r.everyMonths !== everyN))
      dispatch({ type: 'reminder/set', productId: pid, everyMonths: everyN, nextCheck: r?.nextCheck ?? addMonths(today(), everyN) })
    if (!everyN && r?.everyMonths) dispatch({ type: 'reminder/remove', productId: pid })
    toast(existing ? 'Produto atualizado' : toList ? 'Produto criado e incluído na lista' : 'Produto cadastrado')
    close()
  }

  const toggleActive = async () => {
    if (!existing) return
    if (existing.active && !(await confirm({ title: 'Desativar produto?', message: `"${existing.name}" deixa de aparecer nas sugestões e listas novas. O histórico é mantido e você pode reativar depois.`, confirmLabel: 'Desativar' }))) return
    dispatch({ type: 'product/update', id: existing.id, patch: { active: !existing.active } })
    toast(existing.active ? 'Produto desativado' : 'Produto reativado')
    close()
  }

  const remove = async () => {
    if (!existing) return
    if (!(await confirm({ title: 'Excluir produto?', message: `"${existing.name}" será excluído permanentemente.`, confirmLabel: 'Excluir', danger: true }))) return
    dispatch({ type: 'product/delete', id: existing.id })
    toast('Produto excluído')
    close()
  }

  const err = (k: string) => (submitted || nums[k as keyof typeof nums]?.trim() ? errors[k] : undefined)
  const u = unitInfo(unit).value

  return (
    <Sheet
      title={existing ? 'Editar produto' : 'Novo produto'}
      onClose={close}
      footer={
        <Button className="w-full" onClick={save} disabled={submitted && !valid}>
          {existing ? 'Salvar alterações' : 'Cadastrar produto'}
        </Button>
      }
    >
      <div className="space-y-4">
        {existing && (
          <div className="flex flex-wrap gap-2">
            {productState(existing) === 'configured' && <Badge tone="green">Configurado</Badge>}
            {productState(existing) === 'incomplete' && <Badge tone="amber">Incompleto</Badge>}
            {productState(existing) === 'inactive' && <Badge>Inativo</Badge>}
          </div>
        )}
        <Field label="Nome" error={submitted || name ? errors.name : undefined}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Café 500 g" autoFocus={!existing} maxLength={60} />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">Unidade de medida</span>
          <div className="flex flex-wrap gap-2">
            {UNITS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setUnit(o.value)}
                className={cx('min-h-10 rounded-xl border px-3 text-sm', unit === o.value ? 'border-teal-700 bg-teal-50 font-semibold text-teal-800' : 'border-stone-300 bg-white text-stone-600')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-stone-700">Estoque atual ({u})</span>
          <Stepper value={stock} onChange={setStock} step={unitInfo(unit).step} label="estoque" />
        </div>

        {!existing && (
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 ring-1 ring-stone-200">
            <input type="checkbox" className="size-5 accent-teal-700" checked={toList} onChange={(e) => setToList(e.target.checked)} />
            <span className="text-sm text-stone-700">Adicionar à lista de compras</span>
          </label>
        )}

        <button type="button" onClick={() => setMore(!more)} className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-teal-800">
          {existing ? 'Consumo, preço e lembrete' : 'Mais detalhes (opcional)'}
          <ChevronDown size={18} className={cx('transition-transform', more && 'rotate-180')} />
        </button>

        {more && (
          <div className="space-y-4">
            <Field label="Categoria">
              <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} list="gc-categories" placeholder="Ex.: Limpeza" maxLength={30} />
              <datalist id="gc-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Consumo/mês (${u})`} error={err('consumption')}>
                <NumInput value={consumption} onChange={setConsumption} placeholder="—" />
              </Field>
              <Field label="Cobertura (meses)" error={err('coverage')}>
                <NumInput value={coverage} onChange={setCoverage} placeholder="1" />
              </Field>
              <Field label={`Reserva (${u})`} error={err('safety')}>
                <NumInput value={safety} onChange={setSafety} placeholder="0" />
              </Field>
              <Field label={`Por embalagem (${u})`} error={err('pack')}>
                <NumInput value={pack} onChange={setPack} placeholder="opcional" />
              </Field>
              <Field label={`Preço médio / ${u}`} error={err('price')} hint={hasHistory ? 'Calculado pelas compras' : undefined}>
                {hasHistory ? (
                  <div className={cx(inputCls, 'flex items-center bg-stone-100 text-stone-600')}>{existing?.avgPrice != null ? money(existing.avgPrice) : '—'}</div>
                ) : (
                  <NumInput value={price} onChange={setPrice} placeholder="R$" />
                )}
              </Field>
              <Field label="Checar a cada (meses)" error={err('every')} hint="Lembrete opcional">
                <NumInput value={every} onChange={setEvery} placeholder="—" />
              </Field>
            </div>
            <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
              {suggestion == null
                ? 'Informe o consumo mensal para receber sugestões automáticas de compra.'
                : suggestion > 0
                  ? `Sugestão de compra agora: ${qtyLabel(suggestion, unit)}`
                  : 'Estoque suficiente — nada a comprar agora.'}
            </div>
          </div>
        )}

        {existing && (
          <>
            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Histórico de compras</h3>
                <Button variant="soft" className="min-h-9 px-3 text-sm" onClick={() => open({ kind: 'purchase', productId: existing.id, back: { kind: 'product', id: existing.id } })}>
                  <ShoppingCart size={16} /> Registrar
                </Button>
              </div>
              {purchases.length === 0 ? (
                <p className="text-sm text-stone-500">Nenhuma compra registrada ainda.</p>
              ) : (
                <ul className="divide-y divide-stone-200 rounded-xl bg-white ring-1 ring-stone-200">
                  {purchases.slice(0, 12).map((p) => (
                    <li key={p.id}>
                      <button type="button" className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm" onClick={() => open({ kind: 'purchase', productId: existing.id, purchaseId: p.id, back: { kind: 'product', id: existing.id } })}>
                        <span className="w-14 text-stone-500">{dateLabel(p.date)}</span>
                        <span className="flex-1">{qtyLabel(p.qty, existing.unit)} × {money(p.unitPrice)}</span>
                        <span className="font-medium">{money(p.qty * p.unitPrice)}</span>
                        <Pencil size={14} className="text-stone-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={toggleActive}>{existing.active ? 'Desativar' : 'Reativar'}</Button>
              {!hasHistory && <Button variant="ghost" className="flex-1 text-red-600" onClick={remove}>Excluir</Button>}
            </div>
            <p className="text-xs text-stone-400">
              Criado em {dateLabel(existing.createdAt.slice(0, 10))} · atualizado em {dateLabel(existing.updatedAt.slice(0, 10))} · estoque {num(existing.stock)} {u}
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
