// Modelo de dados do GC - Gestão Casa.
// Datas de calendário são strings "YYYY-MM-DD"; carimbos de tempo são ISO completos.

export type Unit = 'un' | 'pct' | 'cx' | 'rolo' | 'kg' | 'g' | 'L' | 'mL'

export type ReminderStatus = 'scheduled' | 'snoozed' | 'done' | 'paused'
/** Estado exibido: inclui "vencido", que é derivado da data. */
export type ReminderView = ReminderStatus | 'overdue'

export interface Reminder {
  /** Repetir a cada N meses; null = lembrete único. */
  everyMonths: number | null
  nextCheck: string
  status: ReminderStatus
  lastCheck: string | null
}

export interface Product {
  id: string
  name: string
  category: string
  unit: Unit
  stock: number
  /** null = consumo não configurado (sem sugestão automática). */
  monthlyConsumption: number | null
  coverageMonths: number
  safetyStock: number
  /** Unidades por embalagem; arredonda a sugestão para múltiplos. */
  packSize: number | null
  /** Preço médio ponderado por unidade de medida (derivado das compras ou informado). */
  avgPrice: number | null
  lastPrice: number | null
  active: boolean
  /** Um lembrete por produto (evita lembretes duplicados). */
  reminder: Reminder | null
  demo?: boolean
  createdAt: string
  updatedAt: string
}

export type ProductState = 'configured' | 'incomplete' | 'inactive'

export type ItemStatus = 'pending' | 'partial' | 'bought' | 'skipped'

export interface ListItem {
  productId: string
  plannedQty: number
  /** true quando o usuário alterou a quantidade planejada manualmente. */
  edited: boolean
  boughtQty: number
  status: ItemStatus
  addedAt: string
}

export type ListStatus = 'preparing' | 'active' | 'closed' | 'archived'

export interface ShoppingList {
  id: string
  name: string
  status: ListStatus
  items: ListItem[]
  createdAt: string
  closedAt: string | null
}

export interface Purchase {
  id: string
  productId: string
  listId: string | null
  qty: number
  unitPrice: number
  date: string
  createdAt: string
}

export interface AppState {
  version: 1
  products: Product[]
  lists: ShoppingList[]
  purchases: Purchase[]
  demo: boolean
}
