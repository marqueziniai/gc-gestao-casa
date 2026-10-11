import { useState } from 'react'
import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, Segmented, Sheet, cx, inputCls } from './ui'
import { uid } from '../lib/calc'
import { hasCategory, sameName } from '../lib/reducer'
import { NONE, catOf, orderedCategories } from '../lib/selectors'

/**
 * Mercados e corredores: escolher o mercado, ordenar as categorias dele (tocando na
 * sequência ou com setas) e incluir/excluir mercados e categorias.
 */
export function MarketsSheet({ marketId }: { marketId: string }) {
  const { state, dispatch, close, toast, confirm } = useStore()
  const [editId, setEditId] = useState(marketId)
  const [picking, setPicking] = useState<string[] | null>(null)
  const [newMarket, setNewMarket] = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const market = state.markets.find((m) => m.id === editId) ?? state.markets[0]
  const cats = orderedCategories(state, market.order, false)
  const hasNone = state.products.some((p) => !p.category.trim())
  const countIn = (c: string, onlyActive = true) => state.products.filter((p) => (!onlyActive || p.active) && sameName(catOf(p.category), c)).length

  const save = (order: string[]) => dispatch({ type: 'market/setOrder', id: market.id, order })
  const move = (i: number, d: -1 | 1) => {
    const next = [...cats]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    save(next)
  }

  // ---- mercados ----
  const marketError = newMarket == null ? null : !newMarket.trim() ? 'Informe o nome.' : state.markets.some((m) => sameName(m.name, newMarket)) ? 'Esse mercado já existe.' : null
  const addMarket = () => {
    if (newMarket == null || marketError) return
    const id = uid()
    dispatch({ type: 'market/add', id, name: newMarket })
    setEditId(id)
    setNewMarket(null)
    toast(`${newMarket.trim()} adicionado — ajuste a ordem dos corredores`)
  }
  const removeMarket = async () => {
    if (state.markets.length <= 1) return
    const ok = await confirm({ title: `Excluir ${market.name}?`, message: 'A ordem de corredores deste mercado será apagada. Produtos e compras não são afetados.', confirmLabel: 'Excluir mercado', danger: true })
    if (!ok) return
    dispatch({ type: 'market/remove', id: market.id })
    setEditId(state.markets.find((m) => m.id !== market.id)!.id)
    toast(`${market.name} excluído`)
  }

  // ---- categorias ----
  const catError = !newCat.trim() ? null : hasCategory(state.categories, newCat) || sameName(newCat, NONE) ? 'Essa categoria já existe.' : null
  const addCategory = () => {
    if (!newCat.trim() || catError) return
    dispatch({ type: 'category/add', name: newCat })
    toast(`Categoria ${newCat.trim()} criada`)
    setNewCat('')
  }
  const askRemoveCategory = async (c: string) => {
    if (countIn(c, false) > 0) return setDeleting(c)
    const ok = await confirm({ title: `Excluir ${c}?`, message: 'A categoria sai de todos os mercados. Ela não tem produtos.', confirmLabel: 'Excluir', danger: true })
    if (ok) removeCategory(c, false)
  }
  const removeCategory = (c: string, withItems: boolean) => {
    const n = countIn(c, false)
    dispatch({ type: 'category/remove', name: c, withItems })
    setDeleting(null)
    toast(withItems ? `${c} e ${n} ${n === 1 ? 'produto excluídos' : 'produtos excluídos'}` : n ? `${c} excluída · ${n} ${n === 1 ? 'produto ficou' : 'produtos ficaram'} sem categoria` : `${c} excluída`)
  }

  const iconBtn = 'grid size-11 shrink-0 place-items-center rounded-xl text-stone-600 hover:bg-stone-100 disabled:opacity-20'

  // ---- modo "montar ordem tocando" ----
  if (picking) {
    const finish = () => {
      save([...picking, ...cats.filter((c) => !picking.includes(c))])
      setPicking(null)
      toast(`Ordem do ${market.name} salva`)
    }
    return (
      <Sheet title={`Ordem do ${market.name}`} onClose={() => setPicking(null)} footer={<Button className="w-full" onClick={finish}>{picking.length === cats.length ? 'Salvar ordem' : 'Salvar (o resto vai no fim)'}</Button>}>
        <p className="mb-3 text-sm text-stone-500">Toque nos corredores <strong>na ordem em que você passa</strong> pelo {market.name}. Toque de novo para desmarcar.</p>
        <ul className="grid gap-2">
          {cats.map((c) => {
            const pos = picking.indexOf(c)
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => setPicking(pos >= 0 ? picking.filter((x) => x !== c) : [...picking, c])}
                  className={cx('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ring-1', pos >= 0 ? 'bg-teal-50 ring-teal-600' : 'bg-white ring-stone-200')}
                >
                  <span className={cx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold', pos >= 0 ? 'bg-teal-700 text-white' : 'bg-stone-100 text-stone-400')}>{pos >= 0 ? pos + 1 : ''}</span>
                  <span className="flex-1 font-medium text-stone-900">{c}</span>
                  <span className="text-xs text-stone-500">{countIn(c)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet title="Mercados e corredores" onClose={close} footer={<Button className="w-full" onClick={close}>Pronto</Button>}>
        <div className="space-y-4">
          {/* mercados */}
          <section>
            <div className="overflow-x-auto [scrollbar-width:none]">
              <Segmented value={market.id} onChange={(id) => { setEditId(id); dispatch({ type: 'market/select', id }) }} options={state.markets.map((m) => ({ value: m.id, label: m.name }))} />
            </div>
            {newMarket == null ? (
              <div className="mt-2 flex gap-2">
                <Button variant="soft" className="flex-1 text-sm" onClick={() => setNewMarket('')}><Plus size={16} /> Novo mercado</Button>
                <Button variant="ghost" className="flex-1 text-sm text-red-600" onClick={removeMarket} disabled={state.markets.length <= 1}>
                  <Trash2 size={16} /> Excluir {market.name}
                </Button>
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex gap-2">
                  <input className={inputCls} value={newMarket} onChange={(e) => setNewMarket(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMarket()} placeholder="Nome do mercado" maxLength={20} autoFocus enterKeyHint="done" />
                  <Button onClick={addMarket} disabled={!!marketError}>Adicionar</Button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-red-600">{newMarket.trim() ? marketError : ''}</span>
                  <button type="button" className="min-h-9 text-sm text-stone-500" onClick={() => setNewMarket(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </section>

          {/* corredores */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Corredores do {market.name}</h3>
            </div>
            <Button variant="soft" className="mb-2 w-full" onClick={() => setPicking([])} disabled={cats.length < 2}><ListOrdered size={18} /> Montar ordem tocando</Button>
            <ol className="divide-y divide-stone-200 rounded-xl bg-white ring-1 ring-stone-200">
              {cats.map((c, i) => (
                <li key={c} className="flex min-h-13 items-center gap-1 pl-3">
                  <span className="w-6 shrink-0 text-sm tabular-nums text-stone-400">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">{c}</span>
                    <span className="block text-xs text-stone-500">{countIn(c)} {countIn(c) === 1 ? 'produto' : 'produtos'}</span>
                  </span>
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${c}`}><ArrowUp size={18} /></button>
                  <button type="button" className={iconBtn} disabled={i === cats.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${c}`}><ArrowDown size={18} /></button>
                  <button type="button" className={cx(iconBtn, 'text-stone-400 hover:text-red-600')} onClick={() => askRemoveCategory(c)} aria-label={`Excluir categoria ${c}`}><Trash2 size={17} /></button>
                </li>
              ))}
              {hasNone && (
                <li className="flex min-h-13 items-center gap-1 pl-3 pr-3 text-stone-500">
                  <span className="w-6 shrink-0" />
                  <span className="flex-1">
                    <span className="block font-medium italic">{NONE}</span>
                    <span className="block text-xs">{countIn(NONE)} produtos · sempre no fim</span>
                  </span>
                </li>
              )}
            </ol>
            <div className="mt-2 flex gap-2">
              <input className={inputCls} value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} placeholder="Nova categoria (ex.: Pet)" maxLength={30} enterKeyHint="done" />
              <Button variant="secondary" className="px-3" onClick={addCategory} disabled={!newCat.trim() || !!catError} aria-label="Adicionar categoria"><Plus size={20} /></Button>
            </div>
            {catError && <p className="mt-1 text-xs text-red-600">{catError}</p>}
            <p className="mt-2 text-xs text-stone-500">Categorias valem para todos os mercados; cada mercado tem a sua ordem.</p>
          </section>
        </div>
      </Sheet>

      {deleting && (
        <div className="relative z-[60]">
          <Sheet title={`Excluir ${deleting}?`} onClose={() => setDeleting(null)}>
            <p className="mb-4 text-stone-600">
              {deleting} tem <strong>{countIn(deleting, false)} {countIn(deleting, false) === 1 ? 'produto' : 'produtos'}</strong>. O que fazer com {countIn(deleting, false) === 1 ? 'ele' : 'eles'}?
            </p>
            <div className="space-y-2">
              <Button variant="secondary" className="h-auto w-full flex-col items-start gap-0 py-3 text-left" onClick={() => removeCategory(deleting, false)}>
                <span>Excluir só a categoria</span>
                <span className="text-xs font-normal text-stone-500">Os produtos continuam, em “{NONE}”.</span>
              </Button>
              <Button variant="danger" className="h-auto w-full flex-col items-start gap-0 py-3 text-left" onClick={() => removeCategory(deleting, true)}>
                <span>Excluir categoria e produtos</span>
                <span className="text-xs font-normal text-white/80">Os produtos somem do estoque e da lista. Compras já feitas ficam no histórico.</span>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setDeleting(null)}>Cancelar</Button>
            </div>
          </Sheet>
        </div>
      )}
    </>
  )
}
