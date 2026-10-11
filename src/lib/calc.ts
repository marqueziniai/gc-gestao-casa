import type { ListItem, Product, ProductState, Purchase, Reminder, ReminderView, Unit } from '../types'

/** Evita lixo de ponto flutuante (0.1 + 0.2). */
export const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

export const UNITS: { value: Unit; label: string; step: number; decimals: boolean }[] = [
  { value: 'un', label: 'unidade', step: 1, decimals: false },
  { value: 'pct', label: 'pacote', step: 1, decimals: false },
  { value: 'cx', label: 'caixa', step: 1, decimals: false },
  { value: 'rolo', label: 'rolo', step: 1, decimals: false },
  { value: 'kg', label: 'kg', step: 0.5, decimals: true },
  { value: 'g', label: 'g', step: 100, decimals: true },
  { value: 'L', label: 'L', step: 0.5, decimals: true },
  { value: 'mL', label: 'mL', step: 100, decimals: true },
]
export const unitInfo = (u: Unit) => UNITS.find((x) => x.value === u) ?? UNITS[0]

/**
 * necessidade = max(0, consumo × cobertura + reserva − estoque), arredondada para o
 * próximo múltiplo da embalagem. Produtos sem consumo configurado retornam null.
 */
export function suggestedQty(p: Product): number | null {
  if (!p.active || p.monthlyConsumption == null || p.monthlyConsumption <= 0) return null
  let need = Math.max(0, p.monthlyConsumption * p.coverageMonths + p.safetyStock - p.stock)
  need = round(need)
  if (need > 0 && p.packSize && p.packSize > 0) need = round(Math.ceil(round(need / p.packSize)) * p.packSize)
  if (need > 0 && !unitInfo(p.unit).decimals) need = Math.ceil(need)
  return need
}

export const itemCost = (qty: number, price: number | null) => (price == null ? null : round(qty * price, 2))

/** preço médio = Σ(qtd × preço) / Σ(qtd), sobre o histórico real de compras. */
export function weightedAvgPrice(purchases: Purchase[]): number | null {
  let q = 0
  let v = 0
  for (const p of purchases) {
    if (p.qty > 0 && p.unitPrice >= 0) {
      q += p.qty
      v += p.qty * p.unitPrice
    }
  }
  return q > 0 ? round(v / q, 4) : null
}

export function productState(p: Product): ProductState {
  if (!p.active) return 'inactive'
  if (p.monthlyConsumption == null || p.monthlyConsumption <= 0 || p.avgPrice == null || !p.category) return 'incomplete'
  return 'configured'
}

/** Quantidade ainda a comprar de um item da lista. */
export const remainingQty = (i: ListItem) => Math.max(0, round(i.plannedQty - i.boughtQty))

// ---------- datas ----------

const pad = (n: number) => String(n).padStart(2, '0')
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toISODate(new Date())
export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Soma meses preservando o dia quando possível; 31/01 + 1 mês = 28 ou 29/02. */
export function addMonths(date: string, months: number): string {
  const d = parseDate(date)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return toISODate(target)
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)

export function reminderView(r: Reminder, ref = today()): ReminderView {
  if (r.status === 'paused' || r.status === 'done') return r.status
  if (r.nextCheck <= ref) return 'overdue'
  return r.status
}

export const endOfMonth = (date: string) => {
  const d = parseDate(date)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

// ---------- formatação ----------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (n: number) => brl.format(n)
export const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
export const qtyLabel = (n: number, u: Unit) => `${num(n)} ${unitInfo(u).value}`
export const dateLabel = (s: string) =>
  parseDate(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
export const monthName = (date = new Date()) => {
  const s = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Converte texto digitado ("3,5") em número; null se vazio ou inválido. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
