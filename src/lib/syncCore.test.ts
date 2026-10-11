import { describe, expect, it } from 'vitest'
import { syncOnce, type Meta, type RemoteApi } from './syncCore'
import { SyncError } from './github'
import { openList, reducer, syncList } from './reducer'
import { initialState } from '../seed'
import type { AppState } from '../types'

/** GitHub de mentira: um arquivo com sha, que recusa gravação com sha velho. */
function fakeRemote() {
  let file: { json: string; sha: string } | null = null
  let n = 0
  let beforePut: (() => void) | null = null
  const api: RemoteApi = {
    async getFile() {
      return file && { ...file }
    },
    async putFile(json, sha) {
      beforePut?.()
      beforePut = null
      if ((file?.sha ?? null) !== sha) throw new SyncError('conflito', 'conflict')
      file = { json, sha: `sha${++n}` }
      return file.sha
    },
  }
  return { api, peek: () => file, raceOnce: (fn: () => void) => (beforePut = fn) }
}

/** Um celular: estado local + meta de sincronização. */
function device(api: RemoteApi, start: AppState) {
  let state = start
  let meta: Meta = { sha: null, base: null, lastSync: null }
  return {
    get state() {
      return state
    },
    act: (a: Parameters<typeof reducer>[1]) => (state = reducer(state, a)),
    sync: () =>
      syncOnce(api, () => state, (s) => (state = reducer(state, { type: 'data/replace', state: s })), () => meta, (m) => (meta = m)),
  }
}

const byName = (s: AppState, name: string) => s.products.find((p) => p.name === name)!

describe('sincronização entre dois celulares', () => {
  it('os dois compram coisas diferentes e tudo aparece nos dois', async () => {
    const remote = fakeRemote()
    const seed = syncList(initialState())
    const a = device(remote.api, seed)
    await a.sync() // primeiro celular envia
    const b = device(remote.api, syncList(initialState())) // segundo celular, ids diferentes
    await b.sync() // sem base: adota o que está no GitHub
    // b ficou com os produtos de a (sem duplicar)
    expect(b.state.products).toHaveLength(seed.products.length)
    expect(byName(b.state, 'Café').id).toBe(byName(a.state, 'Café').id)

    a.act({ type: 'purchase/register', id: 'pa', productId: byName(a.state, 'Café').id, qty: 2, unitPrice: 15 })
    b.act({ type: 'purchase/register', id: 'pb', productId: byName(b.state, 'Arroz').id, qty: 4, unitPrice: null })
    b.act({ type: 'product/update', id: byName(b.state, 'Feijão').id, patch: { name: 'Feijão carioca' } })
    await b.sync()
    await a.sync()
    await b.sync()

    for (const s of [a.state, b.state]) {
      expect(s.purchases.map((p) => p.id).sort()).toEqual(['pa', 'pb'])
      expect(byName(s, 'Café').stock).toBe(2)
      expect(byName(s, 'Arroz').stock).toBe(4)
      expect(s.products.some((p) => p.name === 'Feijão carioca')).toBe(true)
      expect(s.lists.filter((l) => l.status === 'active')).toHaveLength(1)
      const items = openList(s)!.items
      expect(items.find((i) => i.productId === byName(s, 'Café').id)!.status).toBe('bought')
      expect(items.find((i) => i.productId === byName(s, 'Arroz').id)!.status).toBe('bought')
    }
  })

  it('se outro celular salvar no meio, junta e tenta de novo sem perder nada', async () => {
    const remote = fakeRemote()
    const a = device(remote.api, syncList(initialState()))
    await a.sync()
    const b = device(remote.api, a.state)
    await b.sync()

    a.act({ type: 'stock/set', id: byName(a.state, 'Café').id, qty: 3 })
    b.act({ type: 'stock/set', id: byName(b.state, 'Sabonete').id, qty: 6 })
    // b grava exatamente entre o "baixar" e o "enviar" de a
    remote.raceOnce(() => void b.sync())
    await a.sync()
    await new Promise((r) => setTimeout(r, 0))
    await a.sync()
    await b.sync()
    for (const s of [a.state, b.state]) {
      expect(byName(s, 'Café').stock).toBe(3)
      expect(byName(s, 'Sabonete').stock).toBe(6)
    }
  })

  it('sem mudanças não grava de novo', async () => {
    const remote = fakeRemote()
    const a = device(remote.api, syncList(initialState()))
    await a.sync()
    const sha = remote.peek()!.sha
    await a.sync()
    expect(remote.peek()!.sha).toBe(sha)
  })
})
