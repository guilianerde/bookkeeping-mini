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

// 清除指定房间的所有缓存数据
export const clearGroupCache = (groupId: number) => {
  // 清除成员缓存
  const members = readStorage<any[]>(storageKeys.groupMembers, [])
  const filteredMembers = members.filter((m) => m.groupId !== groupId)
  writeStorage(storageKeys.groupMembers, filteredMembers)

  // 清除流水缓存
  const transactions = readStorage<any[]>(storageKeys.groupTransactions, [])
  const filteredTransactions = transactions.filter((t) => t.groupId !== groupId)
  writeStorage(storageKeys.groupTransactions, filteredTransactions)

  // 清除房间会话
  const sessions = readStorage<any[]>(storageKeys.groupSessions, [])
  const filteredSessions = sessions.filter((s) => s.id !== groupId)
  writeStorage(storageKeys.groupSessions, filteredSessions)
}

// 更新成员缓存（移除指定成员）
export const removeMemberFromCache = (groupId: number, userId: number) => {
  const members = readStorage<any[]>(storageKeys.groupMembers, [])
  const filteredMembers = members.filter(
    (m) => !(m.groupId === groupId && m.userId === userId)
  )
  writeStorage(storageKeys.groupMembers, filteredMembers)
}

// 更新成员缓存（标记成员状态）
export const updateMemberStatus = (groupId: number, userId: number, status: 0 | 1, reason?: 'leave' | 'kick') => {
  const members = readStorage<any[]>(storageKeys.groupMembers, [])
  const updatedMembers = members.map((m) => {
    if (m.groupId === groupId && m.userId === userId) {
      return {
        ...m,
        status,
        leaveTime: status === 1 ? new Date().toISOString() : undefined,
        leaveReason: status === 1 ? reason : undefined
      }
    }
    return m
  })
  writeStorage(storageKeys.groupMembers, updatedMembers)
}
