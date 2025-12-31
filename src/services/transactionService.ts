import type { Transaction } from '../models/transaction'
import type { TransactionType } from '../models/types'
import { readStorage, storageKeys, writeStorage } from './storage'

const readNextTransactionId = () =>
  readStorage<number>(storageKeys.nextTransactionId, 1)

const writeNextTransactionId = (nextId: number) => {
  writeStorage(storageKeys.nextTransactionId, nextId)
}

const getNextTransactionId = () => {
  const current = readNextTransactionId()
  writeNextTransactionId(current + 1)
  return current
}

export const getTransactions = (): Transaction[] => {
  const items = readStorage<Transaction[]>(storageKeys.transactions, [])
  return [...items].sort((a, b) => {
    const left = a.dateISO ?? ''
    const right = b.dateISO ?? ''
    return right.localeCompare(left)
  })
}

export type TransactionInput = {
  type: TransactionType
  amount: number
  categoryId: number
  description?: string
  dateISO?: string
}

export const addTransaction = (input: TransactionInput): Transaction => {
  const transactions = readStorage<Transaction[]>(storageKeys.transactions, [])
  const nextTransaction: Transaction = {
    id: getNextTransactionId(),
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    description: input.description,
    dateISO: input.dateISO ?? new Date().toISOString(),
    synced: false
  }

  transactions.push(nextTransaction)
  writeStorage(storageKeys.transactions, transactions)
  return nextTransaction
}

export const replaceTransactions = (transactions: Transaction[]) => {
  writeStorage(storageKeys.transactions, transactions)
}

export const clearTransactions = () => {
  writeStorage(storageKeys.transactions, [])
  writeNextTransactionId(1)
}
