import { uid } from './lib/calc'
import type { AppState, Product, Unit } from './types'

/** Lista inicial da casa: consumo mensal informado, estoque e preços a preencher. */
const ITEMS: [name: string, category: string, unit: Unit, monthly: number][] = [
  ['Café', 'Mercearia', 'pct', 2],
  ['Arroz', 'Mercearia', 'pct', 4],
  ['Feijão', 'Mercearia', 'pct', 3],
  ['Macarrão', 'Mercearia', 'pct', 2],
  ['Molho de tomate', 'Mercearia', 'un', 12],
  ['Azeitona', 'Mercearia', 'un', 8],
  ['Milho', 'Mercearia', 'un', 7],
  ['Óleo', 'Mercearia', 'un', 2],
  ['Azeite', 'Mercearia', 'un', 3],
  ['Miojo', 'Mercearia', 'un', 10],
  ['Orégano', 'Mercearia', 'pct', 1],
  ['Batata palha', 'Mercearia', 'pct', 4],
  ['Vinagre', 'Mercearia', 'un', 1],
  ['Catchup', 'Mercearia', 'un', 1],
  ['Açúcar', 'Mercearia', 'pct', 3],
  ['Filtro de papel', 'Mercearia', 'cx', 1],
  ['Bisnaguinha', 'Padaria e lanches', 'pct', 2],
  ['Pão de queijo', 'Padaria e lanches', 'pct', 3],
  ['Biscoito', 'Padaria e lanches', 'pct', 4],
  ['Bolacha salgada', 'Padaria e lanches', 'pct', 3],
  ['Fardo', 'Outros', 'pct', 2],
  ['Creme dental', 'Higiene', 'un', 3],
  ['Sabonete', 'Higiene', 'un', 6],
  ['Papel toalha', 'Limpeza', 'pct', 2],
  ['Omo', 'Limpeza', 'un', 2],
  ['Amaciante', 'Limpeza', 'un', 2],
  ['Detergente', 'Limpeza', 'un', 10],
  ['Desinfetante', 'Limpeza', 'un', 2],
  ['Cheirinho de banheiro', 'Limpeza', 'un', 2],
]

export function initialState(): AppState {
  const now = new Date().toISOString()
  const products: Product[] = ITEMS.map(([name, category, unit, monthly]) => ({
    id: uid(),
    name,
    category,
    unit,
    stock: 0,
    monthlyConsumption: monthly,
    coverageMonths: 1,
    safetyStock: 0,
    packSize: null,
    avgPrice: null,
    lastPrice: null,
    active: true,
    reminder: null,
    createdAt: now,
    updatedAt: now,
  }))
  return { version: 1, products, lists: [], purchases: [], demo: false }
}

export const emptyState = (): AppState => ({ version: 1, products: [], lists: [], purchases: [], demo: false })
