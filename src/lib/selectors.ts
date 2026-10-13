import type { AppState, ListItem, ShoppingList } from '../types'
import { reminderView, round, today } from './calc'

/** Grupo exibido para produtos sem categoria; não é uma categoria cadastrada. */
export const NONE = 'Sem categoria'
export const catOf = (c: string) => c.trim() || NONE

export interface ItemMoney {
  /** Preço por unidade/pacote usado na estimativa (preço médio do produto). */
  unitPrice: number | null
  /** Valor da linha: o que já foi pago + o que falta comprar × preço unitário. */
  total: number | null
  /** Já pago neste item (compras com preço). */
  spent: number
  /** Ainda a gastar: quantidade que falta × preço unitário. */
  toSpend: number | null
}

/**
 * Valor de um item da lista. Comprado com preço vale o que foi pago; o que ainda
 * falta (ou foi comprado sem preço) vale quantidade × preço médio. Sem preço médio,
 * essa parte fica desconhecida (null).
 */
export function itemMoney(s: AppState, listId: string, item: ListItem): ItemMoney {
  const p = s.products.find((x) => x.id === item.productId)
  const unitPrice = p?.avgPrice ?? null
  const mine = s.purchases.filter((x) => x.listId === listId && x.productId === item.productId)
  let spent = 0
  let unpricedQty = 0
  for (const x of mine) {
    if (x.unitPrice != null) spent += x.qty * x.unitPrice
    else unpricedQty += x.qty
  }
  const remaining = item.status === 'skipped' ? 0 : Math.max(0, item.plannedQty - item.boughtQty)
  const unknownQty = remaining + unpricedQty
  const toSpend = remaining === 0 ? 0 : unitPrice == null ? null : remaining * unitPrice
  const total = unknownQty === 0 ? spent : unitPrice == null ? null : spent + unknownQty * unitPrice
  return { unitPrice, total: total == null ? null : round(total, 2), spent: round(spent, 2), toSpend: toSpend == null ? null : round(toSpend, 2) }
}

/**
 * Totais da lista:
 * - estimated: soma do valor de cada item (pago + falta × preço médio)
 * - spent: soma do que já foi pago (compras com preço)
 * - toSpend: soma do que ainda falta comprar × preço médio
 * - missing: itens cujo valor não dá para estimar (sem preço) → estimativa parcial
 */
export function listTotals(s: AppState, list: ShoppingList) {
  let estimated = 0
  let spent = 0
  let toSpend = 0
  let missing = 0
  let count = 0
  let done = 0
  for (const i of list.items) {
    const m = itemMoney(s, list.id, i)
    spent += m.spent // inclui o que foi pago em itens depois tirados da compra
    if (i.status === 'skipped') continue
    count++
    if (i.status === 'bought') done++
    if (m.total == null) missing++
    else estimated += m.total
    if (m.toSpend != null) toSpend += m.toSpend
  }
  return { estimated: round(estimated, 2), spent: round(spent, 2), toSpend: round(toSpend, 2), missing, priced: count - missing, partial: missing > 0, count, done }
}

export const currentMarket = (s: AppState) => s.markets.find((m) => m.id === s.marketId) ?? s.markets[0]

/**
 * Categorias cadastradas na ordem do mercado; as que ainda não estão na ordem dele
 * entram no fim. "Sem categoria" vem por último quando algum produto está sem categoria.
 */
export function orderedCategories(s: AppState, order = currentMarket(s)?.order ?? [], withNone = true): string[] {
  const known = new Set(s.categories)
  const out = order.filter((c) => known.has(c))
  for (const c of s.categories) if (!out.includes(c)) out.push(c)
  if (withNone && s.products.some((p) => !p.category.trim())) out.push(NONE)
  return out
}

/** Agrupa linhas por categoria, na sequência de corredores. Grupos vazios são omitidos. */
export function groupByCategory<T>(rows: T[], cat: (t: T) => string, order: string[]) {
  const groups = new Map<string, T[]>(order.map((c) => [c, []]))
  for (const r of rows) {
    const c = catOf(cat(r))
    if (!groups.has(c)) groups.set(c, [])
    groups.get(c)!.push(r)
  }
  return [...groups].filter(([, rs]) => rs.length).map(([category, rows]) => ({ category, rows }))
}

export function reminderBuckets(s: AppState) {
  const t = today()
  const withR = s.products.filter((p) => p.active && p.reminder).sort((a, b) => a.reminder!.nextCheck.localeCompare(b.reminder!.nextCheck))
  const overdue = withR.filter((p) => reminderView(p.reminder!, t) === 'overdue')
  const upcoming = withR.filter((p) => ['scheduled', 'snoozed'].includes(reminderView(p.reminder!, t)))
  const inactive = withR.filter((p) => ['paused', 'done'].includes(p.reminder!.status))
  return { overdue, upcoming, inactive, all: withR }
}
