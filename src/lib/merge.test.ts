import { describe, expect, it } from 'vitest'
import { merge3 } from './merge'
import { emptyState } from '../seed'
import type { AppState, Product, ShoppingList } from '../types'

const prod = (id: string, p: Partial<Product> = {}): Product => ({
  id, name: id, category: 'Limpeza', unit: 'un', stock: 0, monthlyConsumption: 1, coverageMonths: 1, safetyStock: 0,
  packSize: null, avgPrice: null, lastPrice: null, active: true, reminder: null, createdAt: '', updatedAt: '', ...p,
})
const st = (p: Partial<AppState>): AppState => ({ ...emptyState(), categories: ['Limpeza'], ...p })
const list = (id: string, createdAt: string, items: ShoppingList['items']): ShoppingList => ({ id, name: id, status: 'active', items, createdAt, closedAt: null })
const item = (productId: string, boughtQty = 0) => ({ productId, plannedQty: 1, edited: false, boughtQty, status: boughtQty ? 'bought' as const : 'pending' as const, addedAt: '' })

describe('sincronização (merge de três vias)', () => {
  const base = st({ products: [prod('a'), prod('b')] })

  it('junta alterações em produtos diferentes', () => {
    const local = st({ products: [prod('a', { stock: 3 }), prod('b')] })
    const remote = st({ products: [prod('a'), prod('b', { name: 'Bê' })] })
    const m = merge3(base, local, remote)
    expect(m.products.find((p) => p.id === 'a')!.stock).toBe(3)
    expect(m.products.find((p) => p.id === 'b')!.name).toBe('Bê')
  })

  it('no mesmo produto, junta campo a campo', () => {
    const local = st({ products: [prod('a', { stock: 5 }), prod('b')] })
    const remote = st({ products: [prod('a', { name: 'Arroz' }), prod('b')] })
    const a = merge3(base, local, remote).products.find((p) => p.id === 'a')!
    expect(a.stock).toBe(5)
    expect(a.name).toBe('Arroz')
  })

  it('respeita exclusões e inclusões dos dois lados', () => {
    const local = st({ products: [prod('a'), prod('c')] }) // excluiu b, criou c
    const remote = st({ products: [prod('a'), prod('b'), prod('d')] }) // criou d
    expect(merge3(base, local, remote).products.map((p) => p.id).sort()).toEqual(['a', 'c', 'd'])
  })

  it('duas listas abertas viram uma, preservando o que foi comprado', () => {
    const b = st({ products: [prod('a'), prod('b')] })
    const local = st({ products: b.products, lists: [list('L1', '2026-10-01', [item('a', 1)])] })
    const remote = st({ products: b.products, lists: [list('L2', '2026-10-02', [item('b', 1)])] })
    const m = merge3(b, local, remote)
    expect(m.lists).toHaveLength(1)
    expect(m.lists[0].id).toBe('L1')
    expect(m.lists[0].items.map((i) => i.productId).sort()).toEqual(['a', 'b'])
  })

  it('itens da mesma lista marcados em aparelhos diferentes', () => {
    const l0 = list('L', '2026-10-01', [item('a'), item('b')])
    const b = st({ lists: [l0] })
    const local = st({ lists: [{ ...l0, items: [item('a', 1), item('b')] }] })
    const remote = st({ lists: [{ ...l0, items: [item('a'), item('b', 1)] }] })
    const m = merge3(b, local, remote)
    expect(m.lists[0].items.every((i) => i.boughtQty === 1)).toBe(true)
  })

  it('mercado selecionado é do aparelho', () => {
    const local = st({ marketId: 'giga' })
    const remote = st({ marketId: 'carrefour' })
    expect(merge3(st({}), local, remote).marketId).toBe('giga')
  })
})
