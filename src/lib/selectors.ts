import type { AppState, ShoppingList } from '../types'
import { reminderView, round, today } from './calc'

export const OTHER = 'Outros'
export const catOf = (c: string) => c.trim() || OTHER

export function listTotals(s: AppState, list: ShoppingList) {
  let estimated = 0
  let priced = 0
  let count = 0
  let done = 0
  for (const i of list.items) {
    if (i.status === 'skipped') continue
    count++
    if (i.status === 'bought') done++
    const p = s.products.find((x) => x.id === i.productId)
    if (p?.avgPrice != null) {
      priced++
      estimated += i.plannedQty * p.avgPrice
    }
  }
  const spent = s.purchases.filter((p) => p.listId === list.id).reduce((t, p) => t + p.qty * (p.unitPrice ?? 0), 0)
  return { estimated: round(estimated, 2), priced, partial: priced < count, spent: round(spent, 2), count, done }
}

export const currentMarket = (s: AppState) => s.markets.find((m) => m.id === s.marketId) ?? s.markets[0]

/** Todas as categorias, na ordem do mercado; categorias novas entram antes de "Outros". */
export function orderedCategories(s: AppState, order = currentMarket(s)?.order ?? []): string[] {
  const used = new Set(s.products.map((p) => catOf(p.category)))
  const out = order.filter((c) => c !== OTHER)
  for (const c of [...used].sort()) if (!out.includes(c) && c !== OTHER) out.push(c)
  out.push(OTHER)
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
