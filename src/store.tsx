import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { AppState } from './types'
import { reducer, syncList, type Action } from './lib/reducer'
import { localAdapter, type StorageAdapter } from './lib/storage'
import { initialState } from './seed'
import { useSync, type SyncApi } from './lib/useSync'
import { Button, Sheet, cx } from './components/ui'

/** Modais globais, abertos de qualquer tela. */
export type Modal =
  | { kind: 'product'; id?: string; addToList?: boolean }
  | { kind: 'purchase'; productId: string; purchaseId?: string; back?: Modal }
  | { kind: 'reminder'; productId?: string }
  | { kind: 'enough'; productId: string }
  | { kind: 'pickItem' }
  | { kind: 'list'; id: string }
  | { kind: 'marketOrder'; id: string }
  | { kind: 'join'; code: string }
  | { kind: 'settings' }

interface Ctx {
  state: AppState
  dispatch: (a: Action) => void
  toast: (msg: string, kind?: 'ok' | 'error') => void
  confirm: (o: ConfirmOpts) => Promise<boolean>
  modal: Modal | null
  open: (m: Modal) => void
  close: () => void
  sync: SyncApi
}
interface ConfirmOpts {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

const StoreCtx = createContext<Ctx | null>(null)
export const useStore = () => {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('StoreProvider ausente')
  return c
}

export function StoreProvider({ children, adapter = localAdapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const saved = adapter.load()
    // dados de demonstração antigos (v0.1) são trocados pela lista inicial da casa
    return syncList(saved && !saved.demo ? saved : initialState())
  })
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'error' }[]>([])
  const [confirmState, setConfirm] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const seq = useRef(0)

  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  useEffect(() => {
    try {
      adapter.save(state)
    } catch {
      toast('Não foi possível salvar os dados neste aparelho.', 'error')
    }
  }, [state, adapter, toast])

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), [])
  const answer = (b: boolean) => {
    confirmState?.resolve(b)
    setConfirm(null)
  }
  const close = useCallback(() => setModal(null), [])
  const sync = useSync(state, dispatch)

  return (
    <StoreCtx.Provider value={{ state, dispatch, toast, confirm, modal, open: setModal, close, sync }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg animate-[down_.2s_ease-out]',
              t.kind === 'ok' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white',
            )}
          >
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="text-teal-300" /> : <AlertTriangle size={18} />}
            {t.msg}
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="relative z-[60]">
          <Sheet
            title={confirmState.title}
            onClose={() => answer(false)}
            footer={
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => answer(false)}>Cancelar</Button>
                <Button variant={confirmState.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => answer(true)}>
                  {confirmState.confirmLabel ?? 'Confirmar'}
                </Button>
              </div>
            }
          >
            <p className="text-stone-600">{confirmState.message}</p>
          </Sheet>
        </div>
      )}
    </StoreCtx.Provider>
  )
}
