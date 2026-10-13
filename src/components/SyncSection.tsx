import { useState } from 'react'
import { ChevronDown, Cloud, CloudOff, Copy, RefreshCw, Share2, UserPlus } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, cx, inputCls } from './ui'
import { SyncError } from '../lib/github'
import { createInvite, inviteLink } from '../lib/invite'
import type { SyncStatus } from '../lib/useSync'

const DEFAULT_REPO = 'marqueziniai/gc-gestao-casa-dados'
const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

const timeLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

/** Conectar/desconectar a sincronização via repositório privado do GitHub. */
export function SyncSection() {
  const { sync, toast, confirm } = useStore()
  const [repo, setRepo] = useState(DEFAULT_REPO)
  const [token, setToken] = useState('')
  const [device, setDevice] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [needsChoice, setNeedsChoice] = useState(false)
  const [help, setHelp] = useState(false)

  const doConnect = async (choice?: 'remote' | 'local') => {
    setBusy(true)
    setErr(null)
    try {
      const r = await sync.connect({ repo: repo.trim(), token: token.trim(), device: device.trim() }, choice)
      if (r === 'needsChoice') return setNeedsChoice(true)
      setNeedsChoice(false)
      setToken('')
      toast(choice === 'remote' ? 'Conectado — dados baixados do GitHub' : 'Conectado — dados salvos no GitHub')
    } catch (e) {
      setErr(e instanceof SyncError ? e.message : 'Não foi possível conectar.')
    } finally {
      setBusy(false)
    }
  }

  const chooseLocal = async () => {
    const ok = await confirm({ title: 'Substituir os dados do GitHub?', message: 'Os dados salvos no GitHub serão trocados pelos deste aparelho. O histórico de versões fica guardado no repositório.', confirmLabel: 'Substituir', danger: true })
    if (ok) void doConnect('local')
  }

  const disconnect = async () => {
    const ok = await confirm({ title: 'Desconectar este aparelho?', message: 'Os dados continuam neste aparelho e no GitHub, mas param de sincronizar. Para reconectar, será preciso colar o token de novo.', confirmLabel: 'Desconectar' })
    if (!ok) return
    sync.disconnect()
    toast('Sincronização desligada neste aparelho')
  }

  if (sync.cfg) {
    return (
      <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <div className="flex items-start gap-3">
          <SyncIcon status={sync.status} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-stone-900">{sync.status === 'error' || sync.status === 'offline' ? 'Sincronização com problema' : 'Sincronizado com o GitHub'}</p>
            <p className="truncate text-xs text-stone-500">{sync.cfg.repo}{sync.cfg.device && ` · ${sync.cfg.device}`}</p>
            <p className="mt-1 text-xs text-stone-500">Última sincronização: {timeLabel(sync.lastSync)}</p>
            {sync.error && <p className="mt-1 text-xs text-red-600">{sync.error}</p>}
            <p className="mt-2 text-xs text-stone-500">
              Sincroniza: produtos, estoque, listas, compras, lembretes, mercados, ordem dos corredores e categorias. Só deste celular: o mercado selecionado em Compras.
            </p>
          </div>
        </div>
        <InviteBox />
        <div className="mt-3 flex gap-2">
          <Button variant="soft" className="flex-1 text-sm" onClick={() => void sync.syncNow()} disabled={sync.status === 'syncing'}>
            <RefreshCw size={16} className={cx(sync.status === 'syncing' && 'animate-spin')} /> Sincronizar agora
          </Button>
          <Button variant="ghost" className="text-sm text-stone-500" onClick={disconnect}>Desconectar</Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex items-center gap-2">
        <CloudOff size={20} className="text-red-600" />
        <p className="font-semibold text-stone-900">Sincronizar entre celulares</p>
      </div>
      <p className="mt-1 text-sm text-stone-500">Os dados ficam num repositório <strong>privado</strong> do GitHub. Cole o mesmo token nos dois celulares.</p>

      {needsChoice ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Já existem dados salvos no GitHub. Qual versão usar?</p>
          <Button className="w-full" onClick={() => void doConnect('remote')} disabled={busy}>Usar os dados do GitHub</Button>
          <Button variant="secondary" className="w-full" onClick={chooseLocal} disabled={busy}>Enviar os deste aparelho</Button>
          <Button variant="ghost" className="w-full" onClick={() => setNeedsChoice(false)}>Cancelar</Button>
          <p className="text-xs text-stone-500">No segundo celular, normalmente é “Usar os dados do GitHub”.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Field label="Repositório privado">
            <input className={inputCls} value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label="Token do GitHub">
            <input className={inputCls} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label="Nome deste aparelho (opcional)">
            <input className={inputCls} value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Ex.: celular do Matheus" maxLength={30} />
          </Field>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button className="w-full" onClick={() => void doConnect()} disabled={busy || !token.trim() || !repo.trim()}>
            {busy ? 'Conectando…' : 'Conectar'}
          </Button>
          <button type="button" onClick={() => setHelp(!help)} className="flex min-h-10 w-full items-center justify-between text-sm font-medium text-teal-800">
            Como criar o token
            <ChevronDown size={16} className={cx('transition-transform', help && 'rotate-180')} />
          </button>
          {help && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
              <li>No GitHub, abra <a className="font-medium text-teal-800 underline" href={TOKEN_URL} target="_blank" rel="noreferrer">Fine-grained tokens → Generate new token</a>.</li>
              <li>Nome: “GC Casa”. Validade: até 1 ano.</li>
              <li>Repository access: <strong>Only select repositories</strong> → <strong>gc-gestao-casa-dados</strong>.</li>
              <li>Permissions → Repository → <strong>Contents: Read and write</strong>.</li>
              <li>Gere, copie o token e cole aqui. Faça o mesmo no outro celular.</li>
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

/** Gera o link de convite protegido pela senha da casa. */
function InviteBox() {
  const { sync, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!sync.cfg) return null
  const error = pass.length > 0 && pass.length < 8 ? 'Use pelo menos 8 caracteres.' : pass2 && pass !== pass2 ? 'As senhas não conferem.' : null

  const generate = async () => {
    if (!sync.cfg || error || !pass || pass !== pass2) return
    setBusy(true)
    try {
      setLink(inviteLink(await createInvite({ repo: sync.cfg.repo, token: sync.cfg.token }, pass)))
      setPass('')
      setPass2('')
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado')
    } catch {
      toast('Não foi possível copiar', 'error')
    }
  }
  const share = async () => {
    if (!link) return
    if (!navigator.share) return copy()
    try {
      await navigator.share({ title: 'GC - Gestão Casa', text: 'Convite para a lista de compras da casa. Abra e digite a senha da casa.', url: link })
    } catch {
      /* compartilhamento cancelado */
    }
  }

  if (!open)
    return (
      <Button variant="secondary" className="mt-3 w-full text-sm" onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Convidar outro celular
      </Button>
    )

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
      {link ? (
        <>
          <p className="text-sm text-stone-700">Link pronto. Envie para o outro celular: lá, basta abrir e digitar a <strong>senha da casa</strong>.</p>
          <div className="flex gap-2">
            <Button className="flex-1 text-sm" onClick={() => void share()}><Share2 size={16} /> Compartilhar</Button>
            <Button variant="secondary" className="flex-1 text-sm" onClick={() => void copy()}><Copy size={16} /> Copiar</Button>
          </div>
          <p className="text-xs text-stone-500">Dica: diga a senha pessoalmente, não junto com o link.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-700">Crie a <strong>senha da casa</strong>. Ela protege o link de convite.</p>
          <input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Senha da casa" autoComplete="new-password" />
          <input className={inputCls} type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button className="w-full text-sm" onClick={() => void generate()} disabled={busy || !!error || !pass || pass !== pass2}>{busy ? 'Gerando…' : 'Gerar link de convite'}</Button>
        </>
      )}
      <button type="button" className="min-h-9 w-full text-sm text-stone-500" onClick={() => { setOpen(false); setLink(null) }}>Fechar</button>
    </div>
  )
}

export function SyncIcon({ status, size = 20 }: { status: SyncStatus; size?: number }) {
  if (status === 'off') return <CloudOff size={size} className="shrink-0 text-red-600" aria-label="Não sincronizado" />
  if (status === 'syncing') return <RefreshCw size={size} className="shrink-0 animate-spin text-teal-700" aria-label="Sincronizando" />
  if (status === 'error' || status === 'offline') return <CloudOff size={size} className="shrink-0 text-amber-600" aria-label="Sem sincronizar" />
  return <Cloud size={size} className="shrink-0 text-teal-700" aria-label="Sincronizado" />
}
