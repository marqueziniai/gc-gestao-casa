import { useMemo, useRef, useState } from 'react'
import { Archive, Download, Plus, RotateCcw, Trash2, Undo2, Upload } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Field, NumInput, SearchBox, Sheet, Stepper, cx, inputCls, normalize } from './ui'
import { addMonths, dateLabel, money, num, parseNum, qtyLabel, remainingQty, today, uid, unitInfo } from '../lib/calc'
import { openList } from '../lib/reducer'
import { migrate } from '../lib/storage'
import type { Modal } from '../store'

/**
 * Registrar (ou editar) uma compra: só a quantidade é obrigatória; o preço é opcional.
 * Para itens da lista, oferece também "não comprar desta vez".
 */
export function PurchaseSheet({ productId, purchaseId, back }: { productId: string; purchaseId?: string; back?: Modal }) {
  const { state, dispatch, toast, close, open, confirm } = useStore()
  const p = state.products.find((x) => x.id === productId)
  const editing = purchaseId ? state.purchases.find((x) => x.id === purchaseId) : undefined
  const item = openList(state)?.items.find((i) => i.productId === productId)
  // id fixo por abertura do formulário: toques repetidos não duplicam a compra
  const opId = useRef(uid())
  const [qty, setQty] = useState(() => editing?.qty ?? (item && remainingQty(item) > 0 ? remainingQty(item) : 1))
  const [price, setPrice] = useState(() => (editing?.unitPrice == null ? '' : editing.unitPrice.toFixed(2).replace('.', ',')))
  const done = () => (back ? open(back) : close())
  if (!p) return null

  const priceN = parseNum(price)
  const priceError = price.trim() && (priceN == null || priceN < 0 || priceN > 100000) ? 'Preço inválido.' : null
  const u = unitInfo(p.unit)

  const submit = () => {
    if (qty <= 0 || priceError) return
    if (editing) dispatch({ type: 'purchase/update', id: editing.id, qty, unitPrice: priceN })
    else dispatch({ type: 'purchase/register', id: opId.current, productId, qty, unitPrice: priceN })
    toast(editing ? 'Compra atualizada' : `${p.name} comprado · estoque ${num(p.stock + qty)} ${u.short}`)
    done()
  }
  const remove = async () => {
    if (!editing || !(await confirm({ title: 'Desfazer compra?', message: `O estoque de ${p.name} volta ${qtyLabel(editing.qty, p.unit)}.`, confirmLabel: 'Desfazer', danger: true }))) return
    dispatch({ type: 'purchase/delete', id: editing.id })
    toast('Compra desfeita')
    done()
  }
  const skip = () => {
    dispatch({ type: 'list/skip', productId, skip: true })
    toast(`${p.name} fora desta compra`)
    done()
  }

  return (
    <Sheet
      title={p.name}
      onClose={done}
      footer={
        <Button className="w-full" onClick={submit} disabled={qty <= 0 || !!priceError}>
          {editing ? 'Salvar' : 'Comprei'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-stone-700">Quantidade ({u.label.toLowerCase()})</span>
          <Stepper value={qty} onChange={setQty} label="quantidade comprada" />
        </div>
        <Field label={`Preço por ${u.label.toLowerCase()} (opcional)`} error={priceError ?? undefined} hint={priceN != null && qty > 0 ? `Total: ${money(priceN * qty)}` : p.avgPrice != null ? `Preço médio: ${money(p.avgPrice)}` : undefined}>
          <NumInput value={price} onChange={setPrice} placeholder="R$ 0,00" />
        </Field>
        <div className="flex gap-2">
          {editing && <Button variant="secondary" className="flex-1" onClick={remove}><Undo2 size={16} /> Desfazer compra</Button>}
          {!editing && item && item.boughtQty === 0 && item.status !== 'skipped' && (
            <Button variant="secondary" className="flex-1" onClick={skip}>Não comprar desta vez</Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

const FREQ = [
  { v: '', label: 'Uma vez' },
  { v: '1', label: '1 mês' },
  { v: '2', label: '2 meses' },
  { v: '3', label: '3 meses' },
  { v: '6', label: '6 meses' },
  { v: '12', label: '12 meses' },
]

/** Criar/editar lembrete. Um lembrete por produto: escolher um produto que já tem lembrete o substitui. */
export function ReminderSheet({ productId }: { productId?: string }) {
  const { state, dispatch, toast, close } = useStore()
  const products = state.products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name))
  const [pid, setPid] = useState(productId ?? products[0]?.id ?? '')
  const current = state.products.find((p) => p.id === pid)
  const [every, setEvery] = useState(String(current?.reminder?.everyMonths ?? (current?.reminder ? '' : '1')))
  const [date, setDate] = useState(current?.reminder?.nextCheck ?? addMonths(today(), 1))
  const [submitted, setSubmitted] = useState(false)
  const error = !pid ? 'Escolha um produto.' : !date ? 'Escolha a data da próxima checagem.' : null

  const save = () => {
    setSubmitted(true)
    if (error) return
    dispatch({ type: 'reminder/set', productId: pid, everyMonths: every ? Number(every) : null, nextCheck: date })
    toast('Lembrete salvo')
    close()
  }

  return (
    <Sheet title={productId ? 'Editar lembrete' : 'Novo lembrete'} onClose={close} footer={<Button className="w-full" onClick={save} disabled={!products.length}>Salvar lembrete</Button>}>
      {!products.length ? (
        <p className="text-stone-600">Cadastre um produto antes de criar lembretes.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Produto" hint={!productId && current?.reminder ? 'Este produto já tem um lembrete — ele será atualizado, sem duplicar.' : undefined}>
            <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)} disabled={!!productId}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.reminder ? ' (já tem lembrete)' : ''}</option>)}
            </select>
          </Field>
          {current && <p className="rounded-xl bg-white px-3 py-2 text-sm text-stone-600 ring-1 ring-stone-200">Pergunta: <strong>“Tem {current.name.toLowerCase()}?”</strong></p>}
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-700">Repetir a cada</span>
            <div className="grid grid-cols-3 gap-2">
              {FREQ.map((f) => (
                <button key={f.v} type="button" onClick={() => setEvery(f.v)} className={cx('min-h-11 rounded-xl border text-sm', every === f.v ? 'border-teal-700 bg-teal-50 font-semibold text-teal-800' : 'border-stone-300 bg-white text-stone-600')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Próxima checagem">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {submitted && error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Sheet>
  )
}

/** "Tenho suficiente": confirma o estoque atual e reagenda. */
export function EnoughSheet({ productId }: { productId: string }) {
  const { state, dispatch, toast, close } = useStore()
  const p = state.products.find((x) => x.id === productId)
  const [qty, setQty] = useState(p?.stock ?? 0)
  if (!p) return null
  const r = p.reminder
  const save = () => {
    dispatch({ type: 'reminder/enough', productId, qty })
    toast(r?.everyMonths ? `Ok! Próxima checagem em ${dateLabel(addMonths(today(), r.everyMonths))}` : 'Lembrete concluído')
    close()
  }
  return (
    <Sheet title={`Quanto ${p.name.toLowerCase()} você tem?`} onClose={close} footer={<Button className="w-full" onClick={save}>Confirmar estoque</Button>}>
      <div className="flex flex-col items-center gap-3 py-2">
        <Stepper value={qty} onChange={setQty} step={unitInfo(p.unit).step} label="estoque" />
        <span className="text-sm text-stone-500">{unitInfo(p.unit).label} em casa agora</span>
      </div>
    </Sheet>
  )
}

/** Adicionar produto existente à lista aberta (sem duplicar). */
export function PickItemSheet() {
  const { state, dispatch, toast, close, open } = useStore()
  const [q, setQ] = useState('')
  const ol = openList(state)
  const inList = new Set(ol?.items.map((i) => i.productId))
  const options = state.products
    .filter((p) => p.active && normalize(p.name + ' ' + p.category).includes(normalize(q)))
    .sort((a, b) => Number(inList.has(a.id)) - Number(inList.has(b.id)) || a.name.localeCompare(b.name))
  return (
    <Sheet title="Adicionar à lista" onClose={close}>
      <div className="space-y-3">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar produto" />
        <ul className="divide-y divide-stone-200 rounded-xl bg-white ring-1 ring-stone-200">
          {options.map((p) => {
            const has = inList.has(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={has}
                  className="flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-50"
                  onClick={() => {
                    dispatch({ type: 'list/addItem', productId: p.id })
                    toast(`${p.name} adicionado à lista`)
                    close()
                  }}
                >
                  <span className="flex-1">
                    <span className="block font-medium text-stone-900">{p.name}</span>
                    <span className="block text-xs text-stone-500">{p.category || 'Sem categoria'} · estoque {qtyLabel(p.stock, p.unit)}</span>
                  </span>
                  {has ? <Badge>Na lista</Badge> : <Plus size={18} className="text-teal-700" />}
                </button>
              </li>
            )
          })}
        </ul>
        {options.length === 0 && <p className="text-sm text-stone-500">Nenhum produto encontrado.</p>}
        <Button variant="soft" className="w-full" onClick={() => open({ kind: 'product', addToList: true })}>
          <Plus size={18} /> Cadastrar produto novo
        </Button>
      </div>
    </Sheet>
  )
}

/** Detalhe de uma lista fechada (histórico). */
export function ListSheet({ id }: { id: string }) {
  const { state, dispatch, toast, close } = useStore()
  const list = state.lists.find((l) => l.id === id)
  const purchases = useMemo(() => state.purchases.filter((p) => p.listId === id), [state.purchases, id])
  if (!list) return null
  const spent = purchases.reduce((s, p) => s + p.qty * (p.unitPrice ?? 0), 0)
  const name = (pid: string) => state.products.find((p) => p.id === pid)
  return (
    <Sheet
      title={list.name}
      onClose={close}
      footer={
        list.status === 'closed' ? (
          <Button variant="secondary" className="w-full" onClick={() => { dispatch({ type: 'list/archive', id }); toast('Lista arquivada'); close() }}>
            <Archive size={18} /> Arquivar
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm text-stone-500">
        {list.status === 'archived' ? 'Arquivada' : 'Fechada'} em {list.closedAt ? dateLabel(list.closedAt.slice(0, 10)) : '—'} · gasto {money(spent)}
      </p>
      <ul className="divide-y divide-stone-200 rounded-xl bg-white ring-1 ring-stone-200">
        {list.items.map((i) => {
          const p = name(i.productId)
          return (
            <li key={i.productId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{p?.name ?? 'Produto removido'}</span>
              <span className="text-stone-500">{p ? `${num(i.boughtQty)}/${num(i.plannedQty)} ${p.unit}` : ''}</span>
              <ItemStatusBadge status={i.status} />
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

export function ItemStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, 'neutral' | 'amber' | 'green' | 'teal']> = {
    pending: ['Pendente', 'neutral'],
    partial: ['Parcial', 'amber'],
    bought: ['Comprado', 'green'],
    skipped: ['Ignorado', 'neutral'],
  }
  const [label, tone] = map[status] ?? ['—', 'neutral']
  return <Badge tone={tone}>{label}</Badge>
}

/** Ajustes: backup e lista inicial. */
export function SettingsSheet() {
  const { state, dispatch, toast, close, confirm } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gc-gestao-casa-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Backup exportado')
  }
  const importData = async (file: File) => {
    try {
      const data = migrate(JSON.parse(await file.text()))
      if (!data) throw new Error()
      if (!(await confirm({ title: 'Importar backup?', message: 'Os dados atuais deste aparelho serão substituídos pelos do arquivo.', confirmLabel: 'Importar', danger: true }))) return
      dispatch({ type: 'data/replace', state: data })
      toast('Backup importado')
      close()
    } catch {
      toast('Arquivo de backup inválido', 'error')
    }
  }
  const reset = async (initial: boolean) => {
    const ok = await confirm(
      initial
        ? { title: 'Restaurar lista inicial?', message: 'Todos os dados atuais (estoque, listas e compras) serão substituídos pela lista inicial de produtos.', confirmLabel: 'Restaurar', danger: true }
        : { title: 'Apagar todos os dados?', message: 'Produtos, listas, compras e lembretes serão apagados deste aparelho. Exporte um backup antes, se quiser.', confirmLabel: 'Apagar tudo', danger: true },
    )
    if (!ok) return
    dispatch({ type: initial ? 'data/restoreInitial' : 'data/clear' })
    toast(initial ? 'Lista inicial restaurada' : 'Dados apagados — comece cadastrando seus produtos')
    close()
  }

  return (
    <Sheet title="Ajustes" onClose={close}>
      <div className="space-y-3">
        <p className="text-sm text-stone-500">Os dados ficam salvos neste aparelho/navegador. Use o backup para levar para outro aparelho.</p>
        <Button variant="secondary" className="w-full justify-start" onClick={exportData}><Download size={18} /> Exportar backup (.json)</Button>
        <Button variant="secondary" className="w-full justify-start" onClick={() => fileRef.current?.click()}><Upload size={18} /> Importar backup</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }} />
        <hr className="border-stone-200" />
        <Button variant="secondary" className="w-full justify-start" onClick={() => reset(true)}><RotateCcw size={18} /> Restaurar lista inicial de produtos</Button>
        <Button variant="ghost" className="w-full justify-start text-red-600" onClick={() => reset(false)}><Trash2 size={18} /> Apagar todos os dados</Button>
        <p className="pt-2 text-center text-xs text-stone-400">GC - Gestão Casa · v0.4</p>
      </div>
    </Sheet>
  )
}

