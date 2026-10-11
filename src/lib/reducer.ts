import type { AppState, ItemStatus, ListItem, Product, Purchase, ShoppingList } from '../types'
import { addDays, addMonths, monthName, round, suggestedQty, today, uid, weightedAvgPrice } from './calc'
import { initialState, emptyState } from '../seed'

export type NewProduct = Pick<Product, 'name' | 'unit' | 'stock'> & Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>

export type Action =
  | { type: 'product/add'; id: string; data: NewProduct; addToList?: boolean }
  | { type: 'product/update'; id: string; patch: Partial<Omit<Product, 'id' | 'createdAt'>> }
  | { type: 'product/delete'; id: string }
  | { type: 'stock/set'; id: string; qty: number }
  | { type: 'list/addItem'; productId: string; qty?: number }
  | { type: 'list/setPlanned'; productId: string; qty: number }
  | { type: 'list/skip'; productId: string; skip: boolean }
  | { type: 'list/removeItem'; productId: string }
  | { type: 'list/undoItem'; productId: string }
  | { type: 'list/close' }
  | { type: 'list/archive'; id: string }
  | { type: 'purchase/register'; id: string; productId: string; qty: number; unitPrice: number | null; date?: string }
  | { type: 'purchase/update'; id: string; qty: number; unitPrice: number | null }
  | { type: 'purchase/delete'; id: string }
  | { type: 'reminder/set'; productId: string; everyMonths: number | null; nextCheck: string }
  | { type: 'reminder/remove'; productId: string }
  | { type: 'reminder/enough'; productId: string; qty: number }
  | { type: 'reminder/needBuy'; productId: string }
  | { type: 'reminder/snooze'; productId: string }
  | { type: 'reminder/pause'; productId: string; paused: boolean }
  | { type: 'data/replace'; state: AppState }
  | { type: 'data/clear' }
  | { type: 'data/restoreInitial' }
  | { type: 'market/select'; id: string }
  | { type: 'market/setOrder'; id: string; order: string[] }
  | { type: 'market/add'; id: string; name: string }
  | { type: 'market/remove'; id: string }
  | { type: 'category/add'; name: string }
  | { type: 'category/remove'; name: string; withItems: boolean }

export const openList = (s: AppState) => s.lists.find((l) => l.status === 'preparing' || l.status === 'active') ?? null

const nowISO = () => new Date().toISOString()
const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, round(n)) : 0)

function statusFor(item: ListItem): ItemStatus {
  if (item.boughtQty > 0) return item.boughtQty >= item.plannedQty ? 'bought' : 'partial'
  return item.status === 'skipped' ? 'skipped' : 'pending'
}

const mapProduct = (s: AppState, id: string, fn: (p: Product) => Product): AppState => ({
  ...s,
  products: s.products.map((p) => (p.id === id ? { ...fn(p), updatedAt: nowISO() } : p)),
})

const mapOpenList = (s: AppState, fn: (l: ShoppingList) => ShoppingList): AppState => {
  const ol = openList(s)
  if (!ol) return s
  return { ...s, lists: s.lists.map((l) => (l.id === ol.id ? fn(l) : l)) }
}

const mapItem = (s: AppState, productId: string, fn: (i: ListItem) => ListItem) =>
  mapOpenList(s, (l) => ({ ...l, items: l.items.map((i) => (i.productId === productId ? fn(i) : i)) }))

function newList(s: AppState): ShoppingList {
  const items: ListItem[] = []
  for (const p of s.products) {
    const q = suggestedQty(p)
    if (q && q > 0) items.push({ productId: p.id, plannedQty: q, edited: false, boughtQty: 0, status: 'pending', addedAt: nowISO() })
  }
  return { id: uid(), name: monthName(), status: 'active', items, createdAt: nowISO(), closedAt: null }
}

/** Garante uma (e só uma) lista aberta. */
const ensureList = (s: AppState): AppState => (openList(s) ? s : { ...s, lists: [newList(s), ...s.lists] })

/** Adiciona o produto à lista aberta ou atualiza a linha existente — nunca duplica. */
function upsertItem(s: AppState, productId: string, qty?: number): AppState {
  s = ensureList(s)
  const p = s.products.find((x) => x.id === productId)
  if (!p) return s
  const ol = openList(s)!
  const existing = ol.items.find((i) => i.productId === productId)
  const fallback = Math.max(suggestedQty(p) ?? 0, p.packSize ?? 0, 1)
  if (existing) {
    return mapItem(s, productId, (i) => {
      // pedido manual: a sincronização automática não mexe mais neste item
      const next: ListItem = { ...i, edited: true, status: i.status === 'skipped' ? 'pending' : i.status }
      if (qty != null) {
        next.plannedQty = clamp0(qty)
        next.edited = true
      } else if (i.boughtQty >= i.plannedQty) {
        // já comprado: pedir de novo significa comprar mais uma vez
        next.plannedQty = round(i.boughtQty + fallback)
      }
      return { ...next, status: statusFor(next) }
    })
  }
  const item: ListItem = { productId, plannedQty: qty != null ? clamp0(qty) : fallback, edited: true, boughtQty: 0, status: 'pending', addedAt: nowISO() }
  return mapOpenList(s, (l) => ({ ...l, items: [...l.items, item] }))
}

/** Recalcula preço médio e último preço a partir do histórico real. */
function repriceProduct(s: AppState, productId: string): AppState {
  const mine = s.purchases.filter((x) => x.productId === productId)
  const avg = weightedAvgPrice(mine)
  const last = mine.filter((x) => x.unitPrice != null).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)).at(-1)
  return mapProduct(s, productId, (p) => ({ ...p, avgPrice: avg ?? p.avgPrice, lastPrice: last?.unitPrice ?? p.lastPrice }))
}

/** Aplica uma variação de compra no item da lista ao qual ela pertence. */
function applyToListItem(s: AppState, listId: string | null, productId: string, delta: number): AppState {
  if (!listId) return s
  return {
    ...s,
    lists: s.lists.map((l) =>
      l.id !== listId
        ? l
        : {
            ...l,
            items: l.items.map((i) => {
              if (i.productId !== productId) return i
              const next = { ...i, boughtQty: clamp0(i.boughtQty + delta) }
              return { ...next, status: statusFor(next) }
            }),
          },
    ),
  }
}

function reschedule(s: AppState, productId: string): AppState {
  const t = today()
  return mapProduct(s, productId, (p) => {
    if (!p.reminder) return p
    const r = p.reminder
    return {
      ...p,
      reminder: r.everyMonths
        ? { ...r, lastCheck: t, nextCheck: addMonths(t, r.everyMonths), status: 'scheduled' }
        : { ...r, lastCheck: t, status: 'done' },
    }
  })
}

function deletePurchase(s: AppState, id: string): AppState {
  const pur = s.purchases.find((x) => x.id === id)
  if (!pur) return s
  s = { ...s, purchases: s.purchases.filter((x) => x.id !== id) }
  s = mapProduct(s, pur.productId, (p) => ({ ...p, stock: clamp0(p.stock - pur.qty) }))
  s = applyToListItem(s, pur.listId, pur.productId, -pur.qty)
  return repriceProduct(s, pur.productId)
}

/**
 * Mantém sempre uma lista aberta e alinhada ao estoque: itens pendentes não editados
 * acompanham a necessidade atual; produtos que passam a faltar entram sozinhos; os que
 * deixam de faltar saem. Itens comprados, ignorados ou ajustados à mão são preservados.
 */
export function syncList(s: AppState): AppState {
  s = ensureList(s)
  return mapOpenList(s, (l) => {
    const byId = new Map(s.products.map((p) => [p.id, p]))
    const items: ListItem[] = []
    for (const i of l.items) {
      const p = byId.get(i.productId)
      if (!p) continue
      if (i.status !== 'pending' || i.edited) {
        if (p.active || i.boughtQty > 0) items.push(i)
        continue
      }
      const q = suggestedQty(p)
      if (q && q > 0) items.push(q === i.plannedQty ? i : { ...i, plannedQty: q })
    }
    for (const p of s.products) {
      const q = suggestedQty(p)
      if (q && q > 0 && !items.some((i) => i.productId === p.id))
        items.push({ productId: p.id, plannedQty: q, edited: false, boughtQty: 0, status: 'pending', addedAt: nowISO() })
    }
    const same = items.length === l.items.length && items.every((i, k) => i === l.items[k])
    return same ? l : { ...l, items }
  })
}

/** Toda categoria usada por um produto passa a existir na lista global. */
function registerCategories(s: AppState): AppState {
  const missing = [...new Set(s.products.map((p) => p.category.trim()).filter((c) => c && !hasCategory(s.categories, c)))]
  return missing.length ? { ...s, categories: [...s.categories, ...missing] } : s
}

export const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')
export const hasCategory = (list: string[], name: string) => list.some((c) => sameName(c, name))

export const reducer = (s: AppState, a: Action): AppState => syncList(registerCategories(baseReducer(s, a)))

function baseReducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'product/add': {
      if (s.products.some((p) => p.id === a.id)) return s
      const now = nowISO()
      const p: Product = {
        category: '', monthlyConsumption: null, coverageMonths: 1, safetyStock: 0, packSize: null,
        avgPrice: null, lastPrice: null, active: true, reminder: null,
        ...a.data,
        id: a.id, name: a.data.name.trim(), stock: clamp0(a.data.stock), createdAt: now, updatedAt: now,
      }
      const next = { ...s, products: [...s.products, p] }
      return a.addToList ? upsertItem(next, p.id) : next
    }
    case 'product/update': {
      const patch = { ...a.patch }
      if (patch.stock != null) patch.stock = clamp0(patch.stock)
      if (patch.name != null) patch.name = patch.name.trim()
      return mapProduct(s, a.id, (p) => ({ ...p, ...patch }))
    }
    case 'product/delete': {
      if (s.purchases.some((x) => x.productId === a.id)) return s // histórico preservado: use desativar
      return {
        ...s,
        products: s.products.filter((p) => p.id !== a.id),
        lists: s.lists.map((l) => (l.status === 'preparing' || l.status === 'active' ? { ...l, items: l.items.filter((i) => i.productId !== a.id) } : l)),
      }
    }
    case 'stock/set':
      return mapProduct(s, a.id, (p) => ({ ...p, stock: clamp0(a.qty) }))

    case 'list/addItem':
      return upsertItem(s, a.productId, a.qty)
    case 'list/setPlanned':
      return mapItem(s, a.productId, (i) => {
        const next: ListItem = { ...i, plannedQty: clamp0(a.qty), edited: true }
        // zerar a quantidade tira o item desta compra
        if (next.plannedQty === 0 && next.boughtQty === 0) return { ...next, status: 'skipped' }
        return { ...next, status: statusFor({ ...next, status: 'pending' }) }
      })
    case 'list/skip':
      return mapItem(s, a.productId, (i) => {
        if (i.boughtQty > 0) return i
        if (a.skip) return { ...i, status: 'skipped' }
        const p = s.products.find((x) => x.id === i.productId)
        return { ...i, status: 'pending', plannedQty: Math.max(i.plannedQty, (p && suggestedQty(p)) || 1) }
      })
    case 'list/removeItem':
      return mapOpenList(s, (l) => ({ ...l, items: l.items.filter((i) => i.productId !== a.productId || i.boughtQty > 0) }))
    case 'list/undoItem': {
      const ol = openList(s)
      if (!ol) return s
      const ids = s.purchases.filter((x) => x.listId === ol.id && x.productId === a.productId).map((x) => x.id)
      return ids.reduce(deletePurchase, s)
    }
    case 'list/close':
      return mapOpenList(s, (l) => ({ ...l, status: 'closed', closedAt: nowISO() }))
    case 'list/archive':
      return { ...s, lists: s.lists.map((l) => (l.id === a.id && l.status === 'closed' ? { ...l, status: 'archived' } : l)) }

    case 'purchase/register': {
      // id gerado pela tela: reenviar a mesma ação (duplo toque) não duplica a compra
      if (s.purchases.some((x) => x.id === a.id)) return s
      if (!(a.qty > 0) || (a.unitPrice != null && !(a.unitPrice >= 0))) return s
      if (!s.products.some((p) => p.id === a.productId)) return s
      let ol = openList(s)
      const inList = ol?.items.some((i) => i.productId === a.productId)
      if (ol && inList && ol.status === 'preparing') {
        s = mapOpenList(s, (l) => ({ ...l, status: 'active' }))
        ol = openList(s)
      }
      const pur: Purchase = {
        id: a.id, productId: a.productId, listId: inList ? ol!.id : null,
        qty: round(a.qty), unitPrice: a.unitPrice == null ? null : round(a.unitPrice, 4), date: a.date ?? today(), createdAt: nowISO(),
      }
      s = { ...s, purchases: [...s.purchases, pur] }
      s = mapProduct(s, a.productId, (p) => ({ ...p, stock: clamp0(p.stock + pur.qty) }))
      s = applyToListItem(s, pur.listId, a.productId, pur.qty)
      return repriceProduct(s, a.productId)
    }
    case 'purchase/update': {
      const pur = s.purchases.find((x) => x.id === a.id)
      if (!pur || !(a.qty > 0) || (a.unitPrice != null && !(a.unitPrice >= 0))) return s
      const delta = round(a.qty - pur.qty)
      s = { ...s, purchases: s.purchases.map((x) => (x.id === a.id ? { ...x, qty: round(a.qty), unitPrice: a.unitPrice == null ? null : round(a.unitPrice, 4) } : x)) }
      s = mapProduct(s, pur.productId, (p) => ({ ...p, stock: clamp0(p.stock + delta) }))
      s = applyToListItem(s, pur.listId, pur.productId, delta)
      return repriceProduct(s, pur.productId)
    }
    case 'purchase/delete':
      return deletePurchase(s, a.id)

    case 'reminder/set': {
      const every = a.everyMonths && a.everyMonths > 0 ? Math.round(a.everyMonths) : null
      return mapProduct(s, a.productId, (p) => ({
        ...p,
        reminder: { everyMonths: every, nextCheck: a.nextCheck, status: p.reminder?.status === 'paused' ? 'paused' : 'scheduled', lastCheck: p.reminder?.lastCheck ?? null },
      }))
    }
    case 'reminder/remove':
      return mapProduct(s, a.productId, (p) => ({ ...p, reminder: null }))
    case 'reminder/enough':
      return reschedule(mapProduct(s, a.productId, (p) => ({ ...p, stock: clamp0(a.qty) })), a.productId)
    case 'reminder/needBuy':
      return reschedule(upsertItem(s, a.productId), a.productId)
    case 'reminder/snooze': {
      // adia 7 dias a partir de hoje (ou da data agendada, se ainda for futura — nunca antecipa)
      const t = today()
      return mapProduct(s, a.productId, (p) => {
        if (!p.reminder) return p
        const base = p.reminder.nextCheck > t ? p.reminder.nextCheck : t
        return { ...p, reminder: { ...p.reminder, nextCheck: addDays(base, 7), status: 'snoozed' } }
      })
    }
    case 'reminder/pause':
      return mapProduct(s, a.productId, (p) => {
        if (!p.reminder) return p
        if (a.paused) return { ...p, reminder: { ...p.reminder, status: 'paused' } }
        const nextCheck = p.reminder.nextCheck < today() ? today() : p.reminder.nextCheck
        return { ...p, reminder: { ...p.reminder, status: 'scheduled', nextCheck } }
      })

    case 'market/select':
      return s.markets.some((m) => m.id === a.id) ? { ...s, marketId: a.id } : s
    case 'market/setOrder':
      return { ...s, markets: s.markets.map((m) => (m.id === a.id ? { ...m, order: [...new Set(a.order)] } : m)) }
    case 'market/add': {
      const name = a.name.trim()
      if (!name || s.markets.some((m) => m.id === a.id || sameName(m.name, name))) return s
      // começa com a mesma sequência do mercado atual; depois é só ajustar
      const base = s.markets.find((m) => m.id === s.marketId)?.order ?? s.categories
      return { ...s, markets: [...s.markets, { id: a.id, name, order: [...base] }], marketId: a.id }
    }
    case 'market/remove': {
      if (s.markets.length <= 1) return s // sempre resta um mercado
      const markets = s.markets.filter((m) => m.id !== a.id)
      return { ...s, markets, marketId: s.marketId === a.id ? markets[0].id : s.marketId }
    }
    case 'category/add': {
      const name = a.name.trim()
      if (!name || hasCategory(s.categories, name)) return s
      return { ...s, categories: [...s.categories, name] }
    }
    case 'category/remove': {
      const inCat = (c: string) => sameName(c, a.name)
      const ids = new Set(s.products.filter((p) => inCat(p.category)).map((p) => p.id))
      const base = {
        ...s,
        categories: s.categories.filter((c) => !inCat(c)),
        markets: s.markets.map((m) => ({ ...m, order: m.order.filter((c) => !inCat(c)) })),
      }
      if (!a.withItems) {
        const now = nowISO()
        return { ...base, products: s.products.map((p) => (ids.has(p.id) ? { ...p, category: '', updatedAt: now } : p)) }
      }
      // exclui os produtos; compras já registradas continuam no histórico
      return {
        ...base,
        products: s.products.filter((p) => !ids.has(p.id)),
        lists: s.lists.map((l) => (l.status === 'preparing' || l.status === 'active' ? { ...l, items: l.items.filter((i) => !ids.has(i.productId)) } : l)),
      }
    }

    case 'data/replace':
      return a.state
    case 'data/clear':
      return emptyState()
    case 'data/restoreInitial':
      return initialState()
  }
}
