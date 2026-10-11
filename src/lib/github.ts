/**
 * Acesso mínimo à API do GitHub para guardar um único arquivo JSON num repositório
 * privado. O token fica só no aparelho (localStorage), nunca no código publicado.
 */

export interface SyncConfig {
  /** "dono/repositorio" */
  repo: string
  token: string
  device: string
}

export const DATA_PATH = 'dados.json'
const API = 'https://api.github.com'

export class SyncError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'notfound' | 'conflict' | 'offline' | 'other') {
    super(message)
  }
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

async function call(cfg: SyncConfig, path: string, init: RequestInit = {}) {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, { ...init, cache: 'no-store', headers: { ...headers(cfg.token), ...(init.headers ?? {}) } })
  } catch {
    throw new SyncError('Sem conexão com a internet.', 'offline')
  }
  if (res.status === 401) throw new SyncError('Token inválido ou expirado.', 'auth')
  if (res.status === 403) throw new SyncError('O token não tem permissão para este repositório (precisa de Contents: leitura e escrita).', 'auth')
  if (res.status === 409 || res.status === 422) throw new SyncError('Os dados mudaram em outro aparelho.', 'conflict')
  return res
}

// base64 com UTF-8 (acentos) — btoa/atob sozinhos só entendem Latin-1
function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function fromBase64(b64: string) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Confere token e repositório. Retorna se o repositório é privado. */
export async function checkRepo(cfg: SyncConfig): Promise<{ private: boolean }> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) throw new SyncError('Repositório deve estar no formato dono/nome.', 'other')
  const res = await call(cfg, `/repos/${cfg.repo}`)
  if (res.status === 404) throw new SyncError(await notFoundHint(cfg), 'notfound')
  if (!res.ok) throw new SyncError(`GitHub respondeu ${res.status}.`, 'other')
  const data = await res.json()
  return { private: !!data.private }
}

/** Explica o "não encontrado": quase sempre o token é de outra conta ou não inclui o repositório. */
async function notFoundHint(cfg: SyncConfig) {
  const owner = cfg.repo.split('/')[0]
  try {
    const res = await call(cfg, '/user')
    const login: string | undefined = res.ok ? (await res.json()).login : undefined
    if (login && login.toLowerCase() !== owner.toLowerCase())
      return `O token é da conta "${login}", mas o repositório é da conta "${owner}". Crie o token logado como ${owner}.`
    if (login) return `O token (conta ${login}) não tem acesso a ${cfg.repo}. Ao criar o token, escolha "Only select repositories" e marque ${cfg.repo.split('/')[1]}.`
  } catch {
    /* sem detalhe extra */
  }
  return 'Repositório não encontrado — confira o nome e se o token tem acesso a ele.'
}

/** Lê o arquivo de dados. null = ainda não existe. */
export async function getFile(cfg: SyncConfig): Promise<{ json: string; sha: string } | null> {
  const res = await call(cfg, `/repos/${cfg.repo}/contents/${DATA_PATH}`)
  if (res.status === 404) return null
  if (!res.ok) throw new SyncError(`GitHub respondeu ${res.status}.`, 'other')
  const data = await res.json()
  return { json: fromBase64(data.content ?? ''), sha: data.sha }
}

/** Grava o arquivo. Com sha desatualizado o GitHub recusa (conflito) — nada é sobrescrito sem querer. */
export async function putFile(cfg: SyncConfig, json: string, sha: string | null): Promise<string> {
  const res = await call(cfg, `/repos/${cfg.repo}/contents/${DATA_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Atualização pelo app (${cfg.device || 'aparelho'})`, content: toBase64(json), ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) throw new SyncError(`GitHub respondeu ${res.status} ao salvar.`, 'other')
  const data = await res.json()
  return data.content.sha
}
