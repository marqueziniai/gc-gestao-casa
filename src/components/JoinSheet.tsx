import { useState } from 'react'
import { useStore } from '../store'
import { Button, Field, Sheet, inputCls } from './ui'
import { openInvite } from '../lib/invite'
import { SyncError } from '../lib/github'

/** Entrar na casa pelo link de convite: só a senha da casa. */
export function JoinSheet({ code }: { code: string }) {
  const { sync, toast, close } = useStore()
  const [pass, setPass] = useState('')
  const [device, setDevice] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const join = async () => {
    setBusy(true)
    setErr(null)
    try {
      const data = await openInvite(code, pass)
      if (!data) return setErr('Senha da casa incorreta.')
      const cfg = { repo: data.repo, token: data.token, device: device.trim() }
      // entrar numa casa = usar os dados que já estão lá
      if ((await sync.connect(cfg)) === 'needsChoice') await sync.connect(cfg, 'remote')
      toast('Pronto! Este celular está sincronizado')
      close()
    } catch (e) {
      setErr(e instanceof SyncError ? e.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Entrar na casa" onClose={close} footer={<Button className="w-full" onClick={() => void join()} disabled={busy || !pass || !device.trim()}>{busy ? 'Entrando…' : 'Entrar'}</Button>}>
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          Você recebeu um convite para a lista da casa. Digite a <strong>senha da casa</strong> para sincronizar este celular.
          {sync.cfg && ' Este celular já está conectado — entrar troca a conexão atual.'}
        </p>
        <Field label="Senha da casa" error={err ?? undefined}>
          <input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pass && device.trim() && void join()} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="Seu nome (aparece no histórico)">
          <input className={inputCls} value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Ex.: Ana" maxLength={30} />
        </Field>
        <p className="text-xs text-stone-500">Os dados deste celular serão substituídos pelos da casa.</p>
      </div>
    </Sheet>
  )
}
