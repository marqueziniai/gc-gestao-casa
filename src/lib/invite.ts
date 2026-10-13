/**
 * Convite com "senha da casa": o token é criptografado (AES-GCM) com uma chave derivada
 * da senha (PBKDF2-SHA256) e vai dentro do link, depois do "#" — essa parte nunca é
 * enviada a servidor algum. Sem a senha, o link não serve para nada.
 */

const ITERATIONS = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64Url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export interface InvitePayload {
  repo: string
  token: string
}

/** Gera o código do convite: versão.salt.iv.cifra (base64url). */
export async function createInvite(payload: InvitePayload, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))))
  return ['1', toB64Url(salt), toB64Url(iv), toB64Url(cipher)].join('.')
}

/** Abre o convite. Senha errada → null (o AES-GCM detecta). */
export async function openInvite(code: string, password: string): Promise<InvitePayload | null> {
  try {
    const [v, salt, iv, cipher] = code.split('.')
    if (v !== '1') return null
    const key = await deriveKey(password, fromB64Url(salt))
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64Url(iv) }, key, fromB64Url(cipher))
    const data = JSON.parse(dec.decode(plain)) as InvitePayload
    return data.repo && data.token ? data : null
  } catch {
    return null
  }
}

export const INVITE_PREFIX = '#convite='

/** Aceita o link inteiro (como vem do WhatsApp) ou só o código. null se não parecer um convite. */
export function extractInviteCode(text: string): string | null {
  const t = text.trim()
  const i = t.indexOf(INVITE_PREFIX)
  const code = (i >= 0 ? t.slice(i + INVITE_PREFIX.length) : t).split(/\s/)[0]
  return /^1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(code) ? code : null
}
export const inviteLink = (code: string) => `${location.origin}${location.pathname}${INVITE_PREFIX}${code}`
