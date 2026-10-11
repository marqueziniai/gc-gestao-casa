import type { AppState, Product, Unit } from '../types'
import { ITEMS, defaultMarkets } from '../seed'

/**
 * Camada de persistência. O app só conversa com esta interface, então trocar
 * localStorage por uma API/banco no futuro significa escrever outro adapter.
 */
export interface StorageAdapter {
  load(): AppState | null
  save(state: AppState): void
}

const KEY = 'gc-gestao-casa:v1'

export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? migrate(JSON.parse(raw)) : null
    } catch {
      return null
    }
  },
  save(state) {
    localStorage.setItem(KEY, JSON.stringify(state))
  },
}

// categorias da lista inicial antiga (v0.2) → corredores novos
const OLD_SEED_CATEGORIES = ['Mercearia', 'Padaria e lanches', 'Outros', 'Higiene', 'Limpeza']
const NEW_CATEGORY = new Map(ITEMS.map(([name, category]) => [name, category]))

/** Aceita dados de qualquer versão anterior e devolve no formato atual (ou null se inválido). */
export function migrate(d: unknown): AppState | null {
  const s = d as AppState & { version: number }
  if (!s || !Array.isArray(s.products) || !Array.isArray(s.lists) || !Array.isArray(s.purchases)) return null
  if (s.version === 2) return s
  if (s.version !== 1) return null
  const products: Product[] = s.products.map((p) => {
    const unit: Unit = p.unit === 'un' || (p.unit as string) === 'rolo' ? 'un' : p.unit === 'pct' || (p.unit as string) === 'cx' ? 'pct' : 'un'
    const category = OLD_SEED_CATEGORIES.includes(p.category) && NEW_CATEGORY.has(p.name) ? NEW_CATEGORY.get(p.name)! : p.category
    return { ...p, unit, category }
  })
  return { ...s, version: 2, products, markets: defaultMarkets(), marketId: 'andorinha' }
}
