import type { AppState } from '../types'

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
      if (!raw) return null
      const data = JSON.parse(raw) as AppState
      return isValidState(data) ? data : null
    } catch {
      return null
    }
  },
  save(state) {
    localStorage.setItem(KEY, JSON.stringify(state))
  },
}

export function isValidState(d: unknown): d is AppState {
  const s = d as AppState
  return !!s && s.version === 1 && Array.isArray(s.products) && Array.isArray(s.lists) && Array.isArray(s.purchases)
}
