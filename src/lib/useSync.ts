import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from '../types'
import { reducer, type Action } from './reducer'
import { sharedJson } from './merge'
import { migrate } from './storage'
import { SyncError, checkRepo, getFile, putFile, type SyncConfig } from './github'
import { syncOnce, type Meta } from './syncCore'

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'offline'


const CFG_KEY = 'gc-sync:config'
const META_KEY = 'gc-sync:meta'
const read = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* armazenamento indisponível: segue só em memória */
  }
}
const emptyMeta = (): Meta => ({ sha: null, base: null, lastSync: null })

/** Escolha ao conectar quando já existem dados no GitHub. */
export type ConnectChoice = 'remote' | 'local'

export function useSync(state: AppState, dispatch: (a: Action) => void) {
  const [cfg, setCfg] = useState<SyncConfig | null>(() => read<SyncConfig>(CFG_KEY))
  const [status, setStatus] = useState<SyncStatus>(cfg ? 'idle' : 'off')
  const [error, setError] = useState<string | null>(null)
  const meta = useRef<Meta>(read<Meta>(META_KEY) ?? emptyMeta())
  const [lastSync, setLastSync] = useState(meta.current.lastSync)
  const stateRef = useRef(state)
  stateRef.current = state
  const running = useRef(false)
  const again = useRef(false)

  const setMeta = (m: Meta) => {
    meta.current = m
    write(META_KEY, m)
    setLastSync(m.lastSync)
  }
  /** Aplica um estado vindo de fora pelo mesmo caminho das ações (mantém a lista coerente). */
  const apply = (next: AppState) => {
    const normalized = reducer(stateRef.current, { type: 'data/replace', state: next })
    stateRef.current = normalized
    dispatch({ type: 'data/replace', state: normalized })
    return normalized
  }

  const run = useCallback(async () => {
    const c = cfg
    if (!c) return
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    setStatus('syncing')
    try {
      await syncOnce({ getFile: () => getFile(c), putFile: (json, sha) => putFile(c, json, sha) }, () => stateRef.current, apply, () => meta.current, setMeta)
      setMeta({ ...meta.current, lastSync: new Date().toISOString() })
      setError(null)
      setStatus('idle')
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError('Falha ao sincronizar.', 'other')
      setError(err.message)
      setStatus(err.kind === 'offline' ? 'offline' : 'error')
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        void run()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg])

  // ao abrir, ao voltar para o app, ao reconectar e a cada 20 s com o app aberto
  useEffect(() => {
    if (!cfg) return
    void run()
    const onVisible = () => document.visibilityState === 'visible' && void run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    window.addEventListener('focus', onVisible)
    const t = setInterval(onVisible, 20_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(t)
    }
  }, [cfg, run])

  // alterações locais: envia alguns segundos depois da última
  useEffect(() => {
    if (!cfg || sharedJson(state) === meta.current.base) return
    const t = setTimeout(() => void run(), 2500)
    return () => clearTimeout(t)
  }, [state, cfg, run])

  /**
   * Conecta este aparelho. Se já houver dados no GitHub e nenhuma escolha for passada,
   * retorna 'needsChoice' para a tela perguntar qual versão manter.
   */
  const connect = async (next: SyncConfig, choice?: ConnectChoice): Promise<'ok' | 'needsChoice'> => {
    const info = await checkRepo(next)
    if (!info.private) throw new SyncError('Este repositório é público. Use um repositório privado para guardar os dados.', 'other')
    const remote = await getFile(next)
    if (remote && !choice) return 'needsChoice'
    let current = stateRef.current
    let m: Meta
    if (remote && choice === 'remote') {
      const r = migrate(JSON.parse(remote.json))
      if (!r) throw new SyncError('O arquivo de dados no GitHub está inválido.', 'other')
      current = apply({ ...r, marketId: current.marketId })
      m = { sha: remote.sha, base: remote.json, lastSync: null }
    } else {
      const json = sharedJson(current)
      const sha = await putFile(next, json, remote?.sha ?? null)
      m = { sha, base: json, lastSync: null }
    }
    setMeta({ ...m, lastSync: new Date().toISOString() })
    write(CFG_KEY, next)
    setCfg(next)
    setError(null)
    setStatus('idle')
    return 'ok'
  }

  const disconnect = () => {
    write(CFG_KEY, null)
    setMeta(emptyMeta())
    setCfg(null)
    setStatus('off')
    setError(null)
  }

  return { cfg, status, error, lastSync, connect, disconnect, syncNow: run }
}

export type SyncApi = ReturnType<typeof useSync>
