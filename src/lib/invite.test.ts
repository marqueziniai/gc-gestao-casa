import { expect, it } from 'vitest'
import { createInvite, openInvite } from './invite'

it('convite abre só com a senha certa', async () => {
  const code = await createInvite({ repo: 'dono/dados', token: 'tok_exemplo' }, 'senha certa')
  expect(code).not.toContain('tok_exemplo')
  expect(await openInvite(code, 'senha certa')).toEqual({ repo: 'dono/dados', token: 'tok_exemplo' })
  expect(await openInvite(code, 'senha errada')).toBeNull()
  expect(await openInvite('lixo', 'senha certa')).toBeNull()
}, 20000)

it('reconhece o convite colado como link inteiro, com texto em volta, ou só o código', async () => {
  const { extractInviteCode } = await import('./invite')
  const code = '1.abc_-1.def2.ghi-3_'
  expect(extractInviteCode(`https://marqueziniai.github.io/gc-gestao-casa/#convite=${code}`)).toBe(code)
  expect(extractInviteCode(`Convite para a lista. https://x.io/app/#convite=${code} `)).toBe(code)
  expect(extractInviteCode(code)).toBe(code)
  expect(extractInviteCode('github_pat_123')).toBeNull()
  expect(extractInviteCode('')).toBeNull()
})
