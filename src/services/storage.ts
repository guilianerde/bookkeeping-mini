import Taro from '@tarojs/taro'

export const storageKeys = {
  transactions: 'transactions',
  categories: 'categories',
  nextTransactionId: 'transactions_next_id',
  settings: 'settings',
  groupSessions: 'group_sessions',
  groupTransactions: 'group_transactions',
  groupMembers: 'group_members'
}

export const readStorage = <T>(key: string, fallback: T): T => {
  try {
    const value = Taro.getStorageSync(key)
    if (value === '' || value === undefined) {
      return fallback
    }
    return value as T
  } catch (error) {
    return fallback
  }
}

export const writeStorage = <T>(key: string, value: T) => {
  Taro.setStorageSync(key, value)
}
