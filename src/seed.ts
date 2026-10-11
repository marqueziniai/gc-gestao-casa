import { addDays, addMonths, today, uid, weightedAvgPrice } from './lib/calc'
import type { AppState, Product, Purchase } from './types'

/** Dados de demonstração, com datas relativas a hoje. */
export function demoState(): AppState {
  const now = new Date().toISOString()
  const t = today()
  const lastMonth = addMonths(t, -1)
  const twoMonths = addMonths(t, -2)

  const purchases: Purchase[] = []
  const buy = (productId: string, qty: number, unitPrice: number, date: string) =>
    purchases.push({ id: uid(), productId, listId: null, qty, unitPrice, date, createdAt: now })

  const base = (p: Partial<Product> & Pick<Product, 'name' | 'category' | 'unit' | 'stock'>): Product => ({
    id: uid(),
    monthlyConsumption: null,
    coverageMonths: 1,
    safetyStock: 0,
    packSize: null,
    avgPrice: null,
    lastPrice: null,
    active: true,
    reminder: null,
    demo: true,
    createdAt: now,
    updatedAt: now,
    ...p,
  })

  const products: Product[] = [
    base({ name: 'Detergente', category: 'Limpeza', unit: 'un', stock: 2, monthlyConsumption: 3, safetyStock: 1 }),
    base({
      name: 'Pasta de dente', category: 'Higiene', unit: 'un', stock: 1, monthlyConsumption: 1, safetyStock: 1,
      reminder: { everyMonths: 2, nextCheck: addDays(t, -2), status: 'scheduled', lastCheck: addMonths(addDays(t, -2), -2) },
    }),
    base({ name: 'Arroz 5 kg', category: 'Alimentos', unit: 'pct', stock: 1, monthlyConsumption: 1 }),
    base({ name: 'Leite', category: 'Alimentos', unit: 'L', stock: 4, monthlyConsumption: 12, safetyStock: 2, packSize: 12 }),
    base({
      name: 'Sabão em pó', category: 'Limpeza', unit: 'kg', stock: 0.8, monthlyConsumption: 1.6, packSize: 1.6,
      reminder: { everyMonths: 1, nextCheck: addDays(t, 5), status: 'scheduled', lastCheck: null },
    }),
    base({
      name: 'Papel higiênico', category: 'Higiene', unit: 'rolo', stock: 6, monthlyConsumption: 12, safetyStock: 4, packSize: 12,
      reminder: { everyMonths: 1, nextCheck: addDays(t, 12), status: 'scheduled', lastCheck: null },
    }),
  ]

  const [det, pasta, arroz, leite, sabao, papel] = products
  buy(det.id, 3, 2.49, twoMonths); buy(det.id, 3, 2.79, lastMonth)
  buy(pasta.id, 2, 6.9, twoMonths)
  buy(arroz.id, 1, 26.9, twoMonths); buy(arroz.id, 1, 28.9, lastMonth)
  buy(leite.id, 12, 4.99, twoMonths); buy(leite.id, 12, 5.29, lastMonth)
  buy(sabao.id, 1.6, 14.5, lastMonth)
  buy(papel.id, 12, 1.95, lastMonth)

  for (const p of products) {
    const mine = purchases.filter((x) => x.productId === p.id)
    p.avgPrice = weightedAvgPrice(mine)
    p.lastPrice = mine.at(-1)?.unitPrice ?? null
  }

  return { version: 1, products, lists: [], purchases, demo: true }
}

export const emptyState = (): AppState => ({ version: 1, products: [], lists: [], purchases: [], demo: false })
