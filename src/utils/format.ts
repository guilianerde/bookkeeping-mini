import type { TransactionType } from '../models/types'

export const formatTime = (dateISO: string) => {
  if (!dateISO) {
    return '--:--'
  }
  const date = new Date(dateISO)
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

export const formatDate = (dateISO: string) => {
  if (!dateISO) {
    return '----/--/--'
  }
  const date = new Date(dateISO)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatAmount = (amount: number, type: TransactionType) => {
  const sign = type === 'INCOME' ? '+' : '-'
  return `${sign}¥${amount.toFixed(2)}`
}
