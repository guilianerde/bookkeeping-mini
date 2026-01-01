import type { Transaction } from '../models/transaction'
import type { TransactionType } from '../models/types'
import { demoDataEnabled } from '../config/demo'
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

const createDemoTransactions = (): Transaction[] => {
  const now = new Date()
  const withOffset = (daysAgo: number, hours: number, minutes = 0) => {
    const date = new Date(now)
    date.setDate(date.getDate() - daysAgo)
    date.setHours(hours, minutes, 0, 0)
    return date.toISOString()
  }

  return [
    {
      id: -1,
      type: 'EXPENSE',
      amount: 28.5,
      categoryId: 1,
      description: 'Coffee',
      dateISO: withOffset(0, 9, 20),
      synced: true
    },
    {
      id: -2,
      type: 'EXPENSE',
      amount: 86,
      categoryId: 2,
      description: 'Groceries',
      dateISO: withOffset(1, 19, 10),
      synced: true
    },
    {
      id: -3,
      type: 'EXPENSE',
      amount: 16,
      categoryId: 3,
      description: 'Metro',
      dateISO: withOffset(2, 8, 45),
      synced: true
    },
    {
      id: -4,
      type: 'INCOME',
      amount: 6800,
      categoryId: 101,
      description: 'Salary',
      dateISO: withOffset(3, 10, 0),
      synced: true
    },
    {
      id: -5,
      type: 'EXPENSE',
      amount: 128,
      categoryId: 4,
      description: 'Movie night',
      dateISO: withOffset(4, 21, 30),
      synced: true
    },
    {
      id: -6,
      type: 'INCOME',
      amount: 420,
      categoryId: 102,
      description: 'Bonus',
      dateISO: withOffset(5, 14, 0),
      synced: true
    }
  ]
}

export const getTransactions = (): Transaction[] => {
  const items = readStorage<Transaction[]>(storageKeys.transactions, [])
  const source = items.length === 0 && demoDataEnabled ? createDemoTransactions() : items
  return [...source].sort((a, b) => {
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
