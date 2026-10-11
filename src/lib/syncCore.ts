import type { AppState } from '../types'
import { merge3, sharedJson } from './merge'
import { migrate } from './storage'
import { SyncError } from './github'

/** sha e conteúdo do dados.json na última sincronização (a "base" da junção). */
export interface Meta {
  sha: string | null
  base: string | null
  lastSync: string | null
}

export interface RemoteApi {
  getFile(): Promise<{ json: string; sha: string } | null>
  putFile(json: string, sha: string | null): Promise<string>
}

/**
 * Uma rodada de sincronização: baixa; se mudou lá, junta com o local; envia o resultado.
 * Se outro aparelho salvar no meio (conflito), repete — nada é sobrescrito às cegas.
 */
export async function syncOnce(api: RemoteApi, getState: () => AppState, apply: (s: AppState) => AppState, getMeta: () => Meta, setMeta: (m: Meta) => void) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await api.getFile()
    let current = getState()
    if (remote && remote.sha !== getMeta().sha) {
      const r = migrate(JSON.parse(remote.json))
      if (!r) throw new SyncError('O arquivo de dados no GitHub está inválido.', 'other')
      const meta = getMeta()
      // nunca sincronizado: adota o GitHub (juntar sem base duplicaria ou apagaria dados)
      current = apply(meta.base ? merge3(JSON.parse(meta.base) as AppState, current, r) : { ...r, marketId: current.marketId })
      setMeta({ ...meta, sha: remote.sha, base: remote.json })
    }
    const json = sharedJson(current)
    if (json === getMeta().base) return
    try {
      const sha = await api.putFile(json, remote ? getMeta().sha : null)
      setMeta({ ...getMeta(), sha, base: json })
      return
    } catch (e) {
      if (e instanceof SyncError && e.kind === 'conflict') continue
      throw e
    }
  }
  throw new SyncError('Muitas alterações ao mesmo tempo — tente de novo.', 'other')
}
