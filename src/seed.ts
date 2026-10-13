import { uid } from './lib/calc'
import type { AppState, Market, Product, Unit } from './types'

/** Categorias pensadas como corredores de mercado. */
export const DEFAULT_CATEGORY_ORDER = [
  'Bebidas',
  'Hortifruti',
  'Padaria',
  'Frios e laticínios',
  'Matinais',
  'Grãos e massas',
  'Molhos e conservas',
  'Óleos e temperos',
  'Biscoitos e snacks',
  'Congelados',
  'Higiene',
  'Limpeza',
  'Outros',
]

/** Mercados na sequência em que são visitados. */
export const defaultMarkets = (): Market[] =>
  ['Andorinha', 'Giga', 'Carrefour'].map((name) => ({ id: name.toLowerCase(), name, order: [...DEFAULT_CATEGORY_ORDER] }))

/** Lista inicial da casa: consumo mensal informado, estoque e preços a preencher. */
export const ITEMS: [name: string, category: string, unit: Unit, monthly: number][] = [
  ['Fardo', 'Bebidas', 'pct', 2],
  ['Bisnaguinha', 'Padaria', 'pct', 2],
  ['Café', 'Matinais', 'pct', 2],
  ['Açúcar', 'Matinais', 'pct', 3],
  ['Filtro de papel', 'Matinais', 'pct', 1],
  ['Arroz', 'Grãos e massas', 'pct', 4],
  ['Feijão', 'Grãos e massas', 'pct', 3],
  ['Macarrão', 'Grãos e massas', 'pct', 2],
  ['Miojo', 'Grãos e massas', 'un', 10],
  ['Molho de tomate', 'Molhos e conservas', 'un', 12],
  ['Azeitona', 'Molhos e conservas', 'un', 8],
  ['Milho', 'Molhos e conservas', 'un', 7],
  ['Catchup', 'Molhos e conservas', 'un', 1],
  ['Óleo', 'Óleos e temperos', 'un', 2],
  ['Azeite', 'Óleos e temperos', 'un', 3],
  ['Vinagre', 'Óleos e temperos', 'un', 1],
  ['Orégano', 'Óleos e temperos', 'pct', 1],
  ['Biscoito', 'Biscoitos e snacks', 'pct', 4],
  ['Bolacha salgada', 'Biscoitos e snacks', 'pct', 3],
  ['Batata palha', 'Biscoitos e snacks', 'pct', 4],
  ['Pão de queijo', 'Congelados', 'pct', 3],
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
  return { ...emptyState(), products }
}

export const emptyState = (): AppState => ({
  version: 2,
  products: [],
  lists: [],
  purchases: [],
  categories: [...DEFAULT_CATEGORY_ORDER],
  markets: defaultMarkets(),
  marketId: 'andorinha',
  log: [],
  demo: false,
})
