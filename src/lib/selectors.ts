import type { AppState, Product, ShoppingList } from '../types'
import { endOfMonth, reminderView, round, suggestedQty, today } from './calc'

export function listTotals(s: AppState, list: ShoppingList) {
  let estimated = 0
  let partial = false
  let count = 0
  let done = 0
  for (const i of list.items) {
    if (i.status === 'skipped') continue
    count++
    if (i.status === 'bought') done++
    const p = s.products.find((x) => x.id === i.productId)
    if (p?.avgPrice == null) partial = true
    else estimated += i.plannedQty * p.avgPrice
  }
  const spent = s.purchases.filter((p) => p.listId === list.id).reduce((t, p) => t + p.qty * p.unitPrice, 0)
  return { estimated: round(estimated, 2), partial, spent: round(spent, 2), count, done }
}

/** Produtos que precisam ser comprados segundo as regras (independente da lista). */
export function needsToBuy(s: AppState) {
  const out: { product: Product; qty: number }[] = []
  for (const p of s.products) {
    const q = suggestedQty(p)
    if (q && q > 0) out.push({ product: p, qty: q })
  }
  return out
}

export function reminderBuckets(s: AppState) {
  const t = today()
  const eom = endOfMonth(t)
  const withR = s.products.filter((p) => p.active && p.reminder).sort((a, b) => a.reminder!.nextCheck.localeCompare(b.reminder!.nextCheck))
  const overdue = withR.filter((p) => reminderView(p.reminder!, t) === 'overdue')
  const month = withR.filter((p) => ['overdue', 'scheduled', 'snoozed'].includes(reminderView(p.reminder!, t)) && p.reminder!.nextCheck <= eom)
  const upcoming = withR.filter((p) => ['scheduled', 'snoozed'].includes(reminderView(p.reminder!, t)))
  const inactive = withR.filter((p) => ['paused', 'done'].includes(p.reminder!.status))
  return { overdue, month, upcoming, inactive, all: withR }
}
