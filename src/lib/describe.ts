import type { AppState, Product } from '../types'
import type { Action } from './reducer'
import { money, num, unitInfo } from './calc'

/**
 * Frase do histórico para cada ação. `key` agrupa cliques seguidos no mesmo
 * controle (ex.: vários "+" no estoque do café viram uma linha só).
 * Ações sem efeito para o histórico (ex.: trocar o mercado exibido) retornam null.
 */
export function describeAction(s: AppState, a: Action): { text: string; key?: string } | null {
  const prod = (id: string) => s.products.find((p) => p.id === id)
  const name = (id: string) => prod(id)?.name ?? 'produto'
  const u = (p?: Product) => (p ? unitInfo(p.unit).short : '')
  const market = (id: string) => s.markets.find((m) => m.id === id)?.name ?? 'mercado'

  switch (a.type) {
    case 'product/add':
      return { text: `Cadastrou ${a.data.name.trim()}` }
    case 'product/update': {
      const p = prod(a.id)
      if (!p) return null
      const parts: string[] = []
      const ch = a.patch
      if (ch.name != null && ch.name.trim() !== p.name) parts.push(`renomeou para ${ch.name.trim()}`)
      if (ch.stock != null && ch.stock !== p.stock) parts.push(`tenho ${num(p.stock)} → ${num(ch.stock)}`)
      if (ch.monthlyConsumption !== undefined && ch.monthlyConsumption !== p.monthlyConsumption) parts.push(`preciso no mês ${num(ch.monthlyConsumption ?? 0)}`)
      if (ch.unit && ch.unit !== p.unit) parts.push(`contar por ${unitInfo(ch.unit).label.toLowerCase()}`)
      if (ch.category !== undefined && ch.category !== p.category) parts.push(`categoria ${ch.category || 'nenhuma'}`)
      if (ch.avgPrice !== undefined && ch.avgPrice !== p.avgPrice) parts.push(ch.avgPrice == null ? 'sem preço médio' : `preço médio ${money(ch.avgPrice)}`)
      if (ch.active !== undefined && ch.active !== p.active) parts.push(ch.active ? 'reativou' : 'desativou')
      if (!parts.length) return null
      // ajustes de um campo só (steppers) agrupam; edições do formulário não
      const key = parts.length === 1 && (ch.stock != null || ch.monthlyConsumption !== undefined) ? `prod:${a.id}:${Object.keys(ch).join()}` : undefined
      return { text: `${p.name}: ${parts.join(', ')}`, key }
    }
    case 'product/delete':
      return { text: `Excluiu ${name(a.id)}` }
    case 'stock/set': {
      const p = prod(a.id)
      return p ? { text: `${p.name}: tenho ${num(a.qty)} ${u(p)}`, key: `stock:${a.id}` } : null
    }
    case 'list/addItem':
      return { text: `Adicionou ${name(a.productId)} à lista` }
    case 'list/setPlanned': {
      const p = prod(a.productId)
      return p ? { text: `${p.name}: comprar ${num(a.qty)} ${u(p)}`, key: `planned:${a.productId}` } : null
    }
    case 'list/skip':
      return { text: a.skip ? `Tirou ${name(a.productId)} desta compra` : `Voltou ${name(a.productId)} para a lista` }
    case 'list/removeItem':
      return { text: `Removeu ${name(a.productId)} da lista` }
    case 'list/undoItem':
      return { text: `Desfez a compra de ${name(a.productId)}` }
    case 'list/close':
      return { text: 'Finalizou as compras' }
    case 'list/archive':
      return { text: 'Arquivou uma lista do histórico' }
    case 'purchase/register': {
      const p = prod(a.productId)
      if (!p) return null
      const value = a.unitPrice != null ? ` · ${num(a.qty)} × ${money(a.unitPrice)} = ${money(a.qty * a.unitPrice)}` : ' · sem preço'
      return { text: `Comprou ${num(a.qty)} ${u(p)} de ${p.name}${value}` }
    }
    case 'purchase/update': {
      const pur = s.purchases.find((x) => x.id === a.id)
      const p = pur && prod(pur.productId)
      if (!p) return null
      const value = a.unitPrice != null ? ` · ${num(a.qty)} × ${money(a.unitPrice)} = ${money(a.qty * a.unitPrice)}` : ''
      return { text: `Corrigiu a compra de ${p.name}${value}` }
    }
    case 'purchase/delete': {
      const pur = s.purchases.find((x) => x.id === a.id)
      return pur ? { text: `Desfez a compra de ${name(pur.productId)}` } : null
    }
    case 'reminder/set':
      return { text: `Lembrete de ${name(a.productId)}: ${a.everyMonths ? `a cada ${a.everyMonths} ${a.everyMonths === 1 ? 'mês' : 'meses'}` : 'uma vez'}` }
    case 'reminder/remove':
      return { text: `Removeu o lembrete de ${name(a.productId)}` }
    case 'reminder/enough':
      return { text: `Confirmou estoque de ${name(a.productId)}: ${num(a.qty)}` }
    case 'reminder/needBuy':
      return { text: `Lembrete: precisa comprar ${name(a.productId)}` }
    case 'reminder/snooze':
      return { text: `Adiou o lembrete de ${name(a.productId)}` }
    case 'reminder/pause':
      return { text: `${a.paused ? 'Pausou' : 'Retomou'} o lembrete de ${name(a.productId)}` }
    case 'market/setOrder':
      return { text: `Reordenou os corredores do ${market(a.id)}`, key: `order:${a.id}` }
    case 'market/add':
      return { text: `Criou o mercado ${a.name.trim()}` }
    case 'market/remove':
      return { text: `Excluiu o mercado ${market(a.id)}` }
    case 'category/add':
      return { text: `Criou a categoria ${a.name.trim()}` }
    case 'category/remove':
      return { text: `Excluiu a categoria ${a.name}${a.withItems ? ' e seus produtos' : ''}` }
    case 'data/clear':
      return { text: 'Apagou todos os dados' }
    case 'data/restoreInitial':
      return { text: 'Restaurou a lista inicial de produtos' }
    // data/replace vem da sincronização/backup; market/select é preferência do aparelho
    default:
      return null
  }
}
