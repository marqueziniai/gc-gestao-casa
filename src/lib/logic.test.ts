import { describe, expect, it } from 'vitest'
import { addMonths, suggestedQty, weightedAvgPrice } from './calc'
import { openList, reducer, syncList } from './reducer'
import { emptyState } from '../seed'
import type { AppState, Product } from '../types'

const prod = (p: Partial<Product>): Product => ({
  id: 'p1', name: 'Detergente', category: 'Limpeza', unit: 'un', stock: 2, monthlyConsumption: 3, coverageMonths: 1,
  safetyStock: 1, packSize: null, avgPrice: 2.5, lastPrice: 2.5, active: true, reminder: null, createdAt: '', updatedAt: '', ...p,
})
const withProduct = (p: Partial<Product> = {}): AppState => ({ ...emptyState(), products: [prod(p)] })

describe('cálculos', () => {
  it('sugestão do exemplo do enunciado = 2', () => expect(suggestedQty(prod({}))).toBe(2))
  it('arredonda para múltiplo da embalagem', () => expect(suggestedQty(prod({ stock: 4, monthlyConsumption: 12, safetyStock: 2, packSize: 12 }))).toBe(12))
  it('sem consumo configurado não sugere', () => expect(suggestedQty(prod({ monthlyConsumption: null }))).toBeNull())
  it('estoque sobrando não sugere quantidade negativa', () => expect(suggestedQty(prod({ stock: 10 }))).toBe(0))
  it('preço médio ponderado', () =>
    expect(weightedAvgPrice([
      { id: 'a', productId: 'p', listId: null, qty: 1, unitPrice: 10, date: '', createdAt: '' },
      { id: 'b', productId: 'p', listId: null, qty: 3, unitPrice: 2, date: '', createdAt: '' },
    ])).toBe(4))
  it('soma de meses respeita fim de mês', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15')
  })
})

describe('fluxo de compras', () => {
  it('gera lista sem duplicar e só uma lista aberta', () => {
    let s = syncList(withProduct())
    s = reducer(s, { type: 'list/addItem', productId: 'p1' })
    s = reducer(s, { type: 'stock/set', id: 'p1', qty: 1 })
    expect(s.lists).toHaveLength(1)
    expect(openList(s)!.items).toHaveLength(1)
  })

  it('compra atualiza estoque, preço médio e status uma única vez', () => {
    let s = syncList(withProduct())
    const buy = { type: 'purchase/register', id: 'c1', productId: 'p1', qty: 2, unitPrice: 4 } as const
    s = reducer(reducer(s, buy), buy) // duplo envio
    expect(s.purchases).toHaveLength(1)
    expect(s.products[0].stock).toBe(4)
    expect(s.products[0].avgPrice).toBe(4)
    expect(openList(s)!.items[0].status).toBe('bought')
    expect(openList(s)!.status).toBe('active')
  })

  it('editar compra histórica recalcula média e estoque', () => {
    let s = reducer(withProduct(), { type: 'purchase/register', id: 'c1', productId: 'p1', qty: 1, unitPrice: 10 })
    s = reducer(s, { type: 'purchase/register', id: 'c2', productId: 'p1', qty: 1, unitPrice: 2 })
    expect(s.products[0].avgPrice).toBe(6)
    s = reducer(s, { type: 'purchase/update', id: 'c2', qty: 3, unitPrice: 2 })
    expect(s.products[0].avgPrice).toBe(4)
    expect(s.products[0].stock).toBe(6)
  })

  it('estoque nunca negativo', () => {
    const s = reducer(withProduct(), { type: 'stock/set', id: 'p1', qty: -5 })
    expect(s.products[0].stock).toBe(0)
  })

  it('fechar ciclo preserva estoque e histórico', () => {
    let s = syncList(withProduct())
    s = reducer(s, { type: 'purchase/register', id: 'c1', productId: 'p1', qty: 1, unitPrice: 3 })
    s = reducer(s, { type: 'list/close' })
    expect(s.lists.filter((l) => l.status === 'closed')).toHaveLength(1)
    expect(openList(s)!.items).toHaveLength(1) // nova lista já recalculada: ainda falta 1
    expect(s.products[0].stock).toBe(3)
    expect(s.purchases).toHaveLength(1)
  })
})

describe('lista automática', () => {
  it('entra quando falta e sai quando o estoque cobre', () => {
    let s = syncList(withProduct({ stock: 0, safetyStock: 0 }))
    expect(openList(s)!.items[0].plannedQty).toBe(3)
    s = reducer(s, { type: 'stock/set', id: 'p1', qty: 3 })
    expect(openList(s)!.items).toHaveLength(0)
  })
  it('compra sem preço soma estoque e não altera o preço médio', () => {
    let s = syncList(withProduct({ avgPrice: 2.5 }))
    s = reducer(s, { type: 'purchase/register', id: 'c1', productId: 'p1', qty: 2, unitPrice: null })
    expect(s.products[0].stock).toBe(4)
    expect(s.products[0].avgPrice).toBe(2.5)
    expect(openList(s)!.items[0].status).toBe('bought')
  })
  it('zerar a quantidade tira o item da compra sem removê-lo', () => {
    let s = syncList(withProduct())
    s = reducer(s, { type: 'list/setPlanned', productId: 'p1', qty: 0 })
    expect(openList(s)!.items[0].status).toBe('skipped')
  })
})

describe('lembretes', () => {
  const rem = { everyMonths: 2, nextCheck: '2020-01-01', status: 'scheduled' as const, lastCheck: null }
  it('"preciso comprar" adiciona à lista e reagenda', () => {
    const s = reducer(withProduct({ stock: 10, reminder: rem }), { type: 'reminder/needBuy', productId: 'p1' })
    expect(openList(s)!.items).toHaveLength(1)
    expect(s.products[0].reminder!.nextCheck > '2020-01-01').toBe(true)
  })
  it('"tenho suficiente" atualiza estoque', () => {
    const s = reducer(withProduct({ reminder: rem }), { type: 'reminder/enough', productId: 'p1', qty: 7 })
    expect(s.products[0].stock).toBe(7)
    expect(s.products[0].reminder!.status).toBe('scheduled')
  })
  it('adiar não mexe no estoque', () => {
    const s = reducer(withProduct({ reminder: rem }), { type: 'reminder/snooze', productId: 'p1' })
    expect(s.products[0].stock).toBe(2)
    expect(s.products[0].reminder!.status).toBe('snoozed')
  })
  it('adiar lembrete futuro nunca antecipa a data', () => {
    const s = reducer(withProduct({ reminder: { ...rem, nextCheck: '2999-01-10' } }), { type: 'reminder/snooze', productId: 'p1' })
    expect(s.products[0].reminder!.nextCheck).toBe('2999-01-17')
  })
})
