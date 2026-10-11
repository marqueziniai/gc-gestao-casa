import { expect, it } from 'vitest'
import { createInvite, openInvite } from './invite'

it('convite abre só com a senha certa', async () => {
  const code = await createInvite({ repo: 'dono/dados', token: 'tok_exemplo' }, 'senha certa')
  expect(code).not.toContain('tok_exemplo')
  expect(await openInvite(code, 'senha certa')).toEqual({ repo: 'dono/dados', token: 'tok_exemplo' })
  expect(await openInvite(code, 'senha errada')).toBeNull()
  expect(await openInvite('lixo', 'senha certa')).toBeNull()
}, 20000)
