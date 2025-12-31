import type { TransactionType } from './types'

export type Transaction = {
  id: number
  type: TransactionType
  amount: number
  categoryId: number
  description?: string
  dateISO: string
  synced: boolean
}
