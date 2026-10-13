import { useEffect, useState } from 'react'
import { BellRing, Package, Plus, Settings, ShoppingBasket } from 'lucide-react'
import { StoreProvider, useStore } from './store'
import { Shopping } from './pages/Shopping'
import { Stock } from './pages/Stock'
import { Reminders } from './pages/Reminders'
import { ProductSheet } from './components/ProductSheet'
import { MarketsSheet } from './components/MarketsSheet'
import { SyncIcon } from './components/SyncSection'
import { JoinSheet } from './components/JoinSheet'
import { INVITE_PREFIX } from './lib/invite'
import { EnoughSheet, ListSheet, PickItemSheet, PurchaseSheet, ReminderSheet, SettingsSheet } from './components/Sheets'
import { Button, cx, useTyping } from './components/ui'
import { openList } from './lib/reducer'
import { reminderBuckets } from './lib/selectors'

export type Tab = 'estoque' | 'compras' | 'lembretes'

const TABS: { id: Tab; label: string; title: string; icon: typeof Package }[] = [
  { id: 'estoque', label: 'Estoque', title: 'Estoque', icon: Package },
  { id: 'compras', label: 'Compras', title: 'Compras', icon: ShoppingBasket },
  { id: 'lembretes', label: 'Lembretes', title: 'Lembretes', icon: BellRing },
]

const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'estoque'
}

function Shell() {
  const { state, modal, open, sync, toast } = useStore()
  const [tab, setTab] = useState<Tab>(fromHash)
  // teclado aberto no celular: esconde barra inferior e botão + para não cobrirem o campo
  const typing = useTyping()

  // link de convite: tira o código da barra de endereço e pede a senha da casa
  useEffect(() => {
    if (!location.hash.startsWith(INVITE_PREFIX)) return
    const code = location.hash.slice(INVITE_PREFIX.length)
    history.replaceState(null, '', `${location.pathname}#estoque`)
    open({ kind: 'join', code })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onHash = () => setTab(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (t: Tab) => {
    if (t !== tab) location.hash = t
    window.scrollTo({ top: 0 })
  }

  const badges: Partial<Record<Tab, number>> = {
    compras: openList(state)?.items.filter((i) => i.status === 'pending' || i.status === 'partial').length,
    lembretes: reminderBuckets(state).overdue.length,
  }
  const current = TABS.find((t) => t.id === tab)!
  // atualizar = recarregar o app: pega a versão nova publicada e, se conectado, baixa os dados na abertura
  const refresh = () => {
    toast('Atualizando…')
    setTimeout(() => location.reload(), 150)
  }
  // inclusão rápida: nas compras, escolhe um produto (ou cadastra) para a lista
  const quickAdd = () => open(tab === 'compras' ? { kind: 'pickItem' } : { kind: 'product' })

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-900 md:flex">
      {/* navegação lateral (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-stone-200 bg-white px-3 py-5 md:flex">
        <button type="button" onClick={refresh} className="mb-6 flex items-center gap-2 rounded-xl px-2 py-1 text-left hover:bg-stone-100" title="Atualizar">
          <img src="./icon.svg" alt="" className="size-8" />
          <span className="font-bold tracking-tight">GC - Gestão Casa</span>
        </button>
        <Button className="mb-4" onClick={quickAdd}><Plus size={18} /> {tab === 'compras' ? 'Adicionar item' : 'Novo produto'}</Button>
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              className={cx('flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium', tab === t.id ? 'bg-teal-50 text-teal-800' : 'text-stone-600 hover:bg-stone-100')}
            >
              <t.icon size={20} />
              <span className="flex-1 text-left">{t.label}</span>
              {!!badges[t.id] && <span className="rounded-full bg-teal-700 px-2 text-xs text-white">{badges[t.id]}</span>}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => open({ kind: 'settings' })} className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-stone-500 hover:bg-stone-100">
          <Settings size={18} /> Ajustes e sincronização
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-stone-100/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:px-8 md:pt-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <button type="button" onClick={refresh} className="-ml-1 min-w-0 rounded-xl px-1 text-left active:bg-stone-200" aria-label="Atualizar" title="Toque para atualizar">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 md:hidden">GC - Gestão Casa</p>
              <h1 className="truncate text-2xl font-bold tracking-tight">{current.title}</h1>
            </button>
            <div className="flex items-center gap-1">
              {tab === 'lembretes' && (
                <Button variant="soft" className="min-h-10 px-3 text-sm" onClick={() => open({ kind: 'reminder' })}><Plus size={16} /> Lembrete</Button>
              )}
              <button
                type="button"
                onClick={() => (sync.status === 'idle' ? void sync.syncNow() : open({ kind: 'settings' }))}
                className="grid size-11 place-items-center rounded-full hover:bg-stone-200"
                aria-label={sync.cfg ? 'Sincronização' : 'Não sincronizado — conectar'}
                title={!sync.cfg ? 'Não sincronizado' : sync.error ?? 'Sincronizado'}
              >
                <SyncIcon status={sync.status} />
              </button>
              <button type="button" onClick={() => open({ kind: 'settings' })} className="grid size-11 place-items-center rounded-full text-stone-500 hover:bg-stone-200 md:hidden" aria-label="Ajustes">
                <Settings size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-32 pt-4 md:px-8 md:pb-12">
          {tab === 'estoque' && <Stock go={go} />}
          {tab === 'compras' && <Shopping />}
          {tab === 'lembretes' && <Reminders />}
        </main>
      </div>

      {/* botão de inclusão rápida (mobile) */}
      <button
        type="button"
        onClick={quickAdd}
        aria-label={tab === 'compras' ? 'Adicionar item' : 'Adicionar produto'}
        hidden={typing || tab === 'lembretes'}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-900/20 active:scale-95 md:hidden"
      >
        <Plus size={26} />
      </button>

      {/* barra inferior (mobile) */}
      <nav hidden={typing} className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cx('relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', tab === t.id ? 'text-teal-700' : 'text-stone-500')}
            >
              <span className={cx('grid h-8 w-14 place-items-center rounded-full transition-colors', tab === t.id && 'bg-teal-50')}>
                <t.icon size={22} />
              </span>
              {t.label}
              {!!badges[t.id] && (
                <span className="absolute right-[calc(50%-1.6rem)] top-1.5 min-w-5 rounded-full bg-teal-700 px-1 text-center text-[10px] leading-5 text-white">{badges[t.id]}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {modal?.kind === 'product' && <ProductSheet key={modal.id ?? 'new'} id={modal.id} addToList={modal.addToList} />}
      {modal?.kind === 'purchase' && <PurchaseSheet key={modal.purchaseId ?? modal.productId} productId={modal.productId} purchaseId={modal.purchaseId} back={modal.back} />}
      {modal?.kind === 'reminder' && <ReminderSheet productId={modal.productId} />}
      {modal?.kind === 'enough' && <EnoughSheet productId={modal.productId} />}
      {modal?.kind === 'pickItem' && <PickItemSheet />}
      {modal?.kind === 'list' && <ListSheet id={modal.id} />}
      {modal?.kind === 'marketOrder' && <MarketsSheet marketId={modal.id} />}
      {modal?.kind === 'join' && <JoinSheet code={modal.code} />}
      {modal?.kind === 'settings' && <SettingsSheet />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
