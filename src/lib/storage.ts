import type { AppState, Product, Unit } from '../types'
import { DEFAULT_CATEGORY_ORDER, ITEMS, defaultMarkets } from '../seed'

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
  if (s.version === 2) return withCategories(s)
  if (s.version !== 1) return null
  const products: Product[] = s.products.map((p) => {
    const unit: Unit = p.unit === 'un' || (p.unit as string) === 'rolo' ? 'un' : p.unit === 'pct' || (p.unit as string) === 'cx' ? 'pct' : 'un'
    const category = OLD_SEED_CATEGORIES.includes(p.category) && NEW_CATEGORY.has(p.name) ? NEW_CATEGORY.get(p.name)! : p.category
    return { ...p, unit, category }
  })
  return withCategories({ ...s, version: 2, products, categories: [], markets: defaultMarkets(), marketId: 'andorinha' })
}

/** Dados anteriores à lista global de categorias: deriva das ordens dos mercados e dos produtos. */
function withCategories(s: AppState): AppState {
  const log = Array.isArray(s.log) ? s.log : []
  // cobertura, reserva e embalagem saíram da tela: zerá-los evita "falta comprar" que o usuário não consegue explicar
  const products = s.products.map((p) =>
    p.coverageMonths === 1 && p.safetyStock === 0 && p.packSize == null ? p : { ...p, coverageMonths: 1, safetyStock: 0, packSize: null },
  )
  if (Array.isArray(s.categories) && s.categories.length) return { ...s, products, log }
  const all = [...DEFAULT_CATEGORY_ORDER, ...s.markets.flatMap((m) => m.order), ...s.products.map((p) => p.category.trim())]
  return { ...s, products, log, categories: [...new Set(all.filter(Boolean))] }
}
