import type { AppState, ListItem, ShoppingList } from '../types'

/**
 * Junção de três vias entre o que este aparelho tinha na última sincronização (base),
 * o que está nele agora (local) e o que está no GitHub (remote). Funciona por registro:
 * quem alterou um registro desde a base vence; se os dois alteraram, junta campo a campo
 * (o local vence só nos campos que ele mesmo mudou). Exclusões também são respeitadas.
 */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Campo a campo: pega do local o que ele mudou desde a base; o resto vem do remoto. */
function mergeFields<T extends object>(base: T, local: T, remote: T): T {
  const out = { ...remote } as Record<string, unknown>
  const b = base as Record<string, unknown>
  const l = local as Record<string, unknown>
  for (const k of new Set([...Object.keys(l), ...Object.keys(remote)])) if (!same(b[k], l[k])) out[k] = l[k]
  return out as T
}

export function mergeById<T>(base: T[], local: T[], remote: T[], key: (t: T) => string, mergeItem: (b: T, l: T, r: T) => T = mergeFields as never): T[] {
  const B = new Map(base.map((t) => [key(t), t]))
  const L = new Map(local.map((t) => [key(t), t]))
  const R = new Map(remote.map((t) => [key(t), t]))
  const ids = [...new Set([...remote.map(key), ...local.map(key)])]
  const out: T[] = []
  for (const id of ids) {
    const b = B.get(id)
    const l = L.get(id)
    const r = R.get(id)
    const lChanged = !same(b, l)
    const rChanged = !same(b, r)
    if (!l && !r) continue
    if (!l) {
      // excluído aqui e intocado lá → excluir; novo (ou alterado) lá → manter
      if (b && !rChanged) continue
      out.push(r!)
    } else if (!r) {
      if (b && !lChanged) continue
      out.push(l)
    } else if (lChanged && rChanged && b) out.push(mergeItem(b, l, r))
    else out.push(lChanged ? l : r)
  }
  return out
}

/** Conjunto de três vias (categorias): sai se algum lado removeu; entra se algum lado incluiu. */
function mergeSet(base: string[], local: string[], remote: string[]) {
  const B = new Set(base)
  const L = new Set(local)
  const R = new Set(remote)
  const keep = (c: string) => (L.has(c) && R.has(c)) || (!B.has(c) && (L.has(c) || R.has(c)))
  return [...new Set([...local, ...remote])].filter(keep)
}

function mergeList(b: ShoppingList, l: ShoppingList, r: ShoppingList): ShoppingList {
  const items = mergeById<ListItem>(b.items, l.items, r.items, (i) => i.productId)
  return { ...mergeFields(b, l, r), items }
}

/**
 * Se cada aparelho abriu a sua própria lista, mantém uma só: a mais antiga recebe
 * os itens já comprados das outras, e as compras passam a apontar para ela.
 */
export function dedupeOpenLists(s: AppState): AppState {
  const open = s.lists.filter((l) => l.status === 'preparing' || l.status === 'active').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (open.length <= 1) return s
  const [keep, ...drop] = open
  const items = [...keep.items]
  for (const l of drop) for (const i of l.items) if (i.boughtQty > 0 && !items.some((x) => x.productId === i.productId)) items.push(i)
  const dropIds = new Set(drop.map((l) => l.id))
  return {
    ...s,
    lists: s.lists.filter((l) => !dropIds.has(l.id)).map((l) => (l.id === keep.id ? { ...l, items } : l)),
    purchases: s.purchases.map((p) => (p.listId && dropIds.has(p.listId) ? { ...p, listId: keep.id } : p)),
  }
}

export function merge3(base: AppState, local: AppState, remote: AppState): AppState {
  const merged: AppState = {
    ...local,
    products: mergeById(base.products, local.products, remote.products, (p) => p.id),
    purchases: mergeById(base.purchases, local.purchases, remote.purchases, (p) => p.id),
    lists: mergeById(base.lists, local.lists, remote.lists, (l) => l.id, mergeList),
    markets: mergeById(base.markets, local.markets, remote.markets, (m) => m.id),
    categories: mergeSet(base.categories, local.categories, remote.categories),
    // histórico: une os dois lados, mais recentes primeiro
    log: mergeById(base.log ?? [], local.log ?? [], remote.log ?? [], (e) => e.id)
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 300),
    // mercado selecionado é preferência deste aparelho
    marketId: local.marketId,
  }
  if (!merged.markets.some((m) => m.id === merged.marketId) && merged.markets[0]) merged.marketId = merged.markets[0].id
  return dedupeOpenLists(merged)
}

/** O que vai para o GitHub: tudo menos preferências do aparelho. */
export const sharedJson = (s: AppState) => JSON.stringify({ ...s, marketId: undefined }, null, 1)
