import { describe, expect, it } from 'vitest'
import { openList, reducer, syncList } from './reducer'
import { itemMoney, listTotals } from './selectors'
import { describeAction } from './describe'
import { merge3 } from './merge'
import { migrate } from './storage'
import { emptyState } from '../seed'
import type { AppState, LogEntry, Product } from '../types'

const prod = (id: string, p: Partial<Product> = {}): Product => ({
  id, name: id, category: 'Bebidas', unit: 'un', stock: 0, monthlyConsumption: 1, coverageMonths: 1, safetyStock: 0,
  packSize: null, avgPrice: null, lastPrice: null, active: true, reminder: null, createdAt: '', updatedAt: '', ...p,
})
const agua = () => prod('agua', { name: 'Água', monthlyConsumption: 32, avgPrice: 3.2 })
const state = (...products: Product[]): AppState => syncList({ ...emptyState(), products })
const totals = (s: AppState) => listTotals(s, openList(s)!)
const item = (s: AppState, id: string) => openList(s)!.items.find((i) => i.productId === id)!

describe('contas: 32 águas de R$ 3,20', () => {
  it('estimado = 32 × 3,20 antes de comprar', () => {
    const s = state(agua())
    expect(itemMoney(s, openList(s)!.id, item(s, 'agua'))).toMatchObject({ unitPrice: 3.2, total: 102.4, toSpend: 102.4, spent: 0 })
    expect(totals(s)).toMatchObject({ estimated: 102.4, spent: 0, toSpend: 102.4, partial: false })
  })

  it('concluir a compra com o preço médio: gasto = 32 × 3,20 = 102,40', () => {
    let s = state(agua())
    s = reducer(s, { type: 'purchase/register', id: 'c', productId: 'agua', qty: 32, unitPrice: 3.2 })
    expect(totals(s)).toMatchObject({ estimated: 102.4, spent: 102.4, toSpend: 0 })
    expect(s.products[0].stock).toBe(32)
  })

  it('compra parcial: pago + falta × preço médio', () => {
    let s = state(agua())
    s = reducer(s, { type: 'purchase/register', id: 'c', productId: 'agua', qty: 10, unitPrice: 3.5 })
    // 10 × 3,50 pagos = 35; preço médio vira 3,50 (única compra com preço); faltam 22 × 3,50 = 77
    expect(totals(s)).toMatchObject({ spent: 35, toSpend: 77, estimated: 112 })
  })

  it('compra sem preço usa o preço médio na estimativa, mas não no gasto', () => {
    let s = state(agua())
    s = reducer(s, { type: 'purchase/register', id: 'c', productId: 'agua', qty: 32, unitPrice: null })
    expect(totals(s)).toMatchObject({ spent: 0, toSpend: 0, estimated: 102.4, partial: false })
  })

  it('item sem preço deixa a estimativa parcial; item tirado da compra não conta', () => {
    let s = state(agua(), prod('sabao', { monthlyConsumption: 2 }), prod('sal', { monthlyConsumption: 1, avgPrice: 5 }))
    expect(totals(s)).toMatchObject({ estimated: 107.4, missing: 1, partial: true, count: 3 })
    s = reducer(s, { type: 'list/skip', productId: 'sal', skip: true })
    expect(totals(s)).toMatchObject({ estimated: 102.4, count: 2 })
  })

  it('quantidade ajustada recalcula o total na hora', () => {
    let s = state(agua())
    s = reducer(s, { type: 'list/setPlanned', productId: 'agua', qty: 48 })
    expect(totals(s).estimated).toBe(153.6)
  })
})

describe('histórico de alterações', () => {
  const add = (s: AppState, e: Partial<LogEntry> & { text: string }) =>
    reducer(s, { type: 'log/add', entry: { id: Math.random().toString(), at: new Date().toISOString(), by: 'Matheus', ...e } })

  it('descreve a compra com a conta', () => {
    const s = state(agua())
    expect(describeAction(s, { type: 'purchase/register', id: 'c', productId: 'agua', qty: 32, unitPrice: 3.2 })!.text.replace(/ /g, ' ')).toBe('Comprou 32 un de Água · 32 × R$ 3,20 = R$ 102,40')
  })

  it('cliques seguidos no mesmo controle viram uma linha; outro aparelho, outra linha', () => {
    let s = state(agua())
    s = add(s, { text: 'Água: tenho 1 un', key: 'stock:agua' })
    s = add(s, { text: 'Água: tenho 2 un', key: 'stock:agua' })
    expect(s.log).toHaveLength(1)
    expect(s.log[0].text).toBe('Água: tenho 2 un')
    s = add(s, { text: 'Água: tenho 3 un', key: 'stock:agua', by: 'Esposa' })
    expect(s.log).toHaveLength(2)
  })

  it('a sincronização une os históricos dos dois celulares', () => {
    const e = (id: string, at: string, by: string): LogEntry => ({ id, at, by, text: id })
    const base = { ...emptyState(), log: [e('a', '2026-10-01T10:00:00Z', 'Matheus')] }
    const local = { ...base, log: [e('b', '2026-10-01T11:00:00Z', 'Matheus'), ...base.log] }
    const remote = { ...base, log: [e('c', '2026-10-01T10:30:00Z', 'Esposa'), ...base.log] }
    expect(merge3(base, local, remote).log.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })
})

it('migração zera parâmetros que não aparecem mais na tela', () => {
  const old = { ...emptyState(), log: undefined, products: [prod('x', { safetyStock: 2, coverageMonths: 2, packSize: 12 })] }
  const m = migrate(old)!
  expect(m.products[0]).toMatchObject({ safetyStock: 0, coverageMonths: 1, packSize: null })
  expect(m.log).toEqual([])
})
