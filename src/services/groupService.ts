import { readStorage, storageKeys, writeStorage } from './storage'
import type { GroupMember, GroupSession, GroupTransaction } from '../models/group'
import { demoDataEnabled } from '../config/demo'

const demoMembers: GroupMember[] = [
  { id: 'self', name: '我', isSelf: true },
  { id: 'u1', name: '阿敏' },
  { id: 'u2', name: 'Leo' },
  { id: 'u3', name: '可可' }
]

const createDemoSession = (): GroupSession => ({
  id: 'demo',
  title: '周末露营',
  createdAt: new Date().toISOString(),
  members: demoMembers
})

const createDemoTransactions = (): GroupTransaction[] => {
  const now = new Date()
  const withOffset = (hoursAgo: number) => {
    const date = new Date(now)
    date.setHours(date.getHours() - hoursAgo)
    return date.toISOString()
  }

  return [
    {
      id: 'g1',
      sessionId: 'demo',
      amount: 268,
      description: '营地门票',
      payerId: 'self',
      participantIds: ['self', 'u1', 'u2', 'u3'],
      dateISO: withOffset(6)
    },
    {
      id: 'g2',
      sessionId: 'demo',
      amount: 198,
      description: '晚餐食材',
      payerId: 'u1',
      participantIds: ['self', 'u1', 'u2', 'u3'],
      dateISO: withOffset(2)
    }
  ]
}

export const getGroupSessions = (): GroupSession[] => {
  const sessions = readStorage<GroupSession[]>(storageKeys.groupSessions, [])
  if (sessions.length === 0 && demoDataEnabled) {
    const demoSession = createDemoSession()
    writeStorage(storageKeys.groupSessions, [demoSession])
    return [demoSession]
  }
  return sessions
}

export const addGroupSession = (title: string, members: GroupMember[]): GroupSession => {
  const sessions = readStorage<GroupSession[]>(storageKeys.groupSessions, [])
  const session: GroupSession = {
    id: `group_${Date.now()}`,
    title: title.trim() || '临时多人记账',
    createdAt: new Date().toISOString(),
    members
  }
  sessions.unshift(session)
  writeStorage(storageKeys.groupSessions, sessions)
  return session
}

export const getGroupTransactions = (): GroupTransaction[] => {
  const transactions = readStorage<GroupTransaction[]>(storageKeys.groupTransactions, [])
  if (transactions.length === 0 && demoDataEnabled) {
    const demo = createDemoTransactions()
    writeStorage(storageKeys.groupTransactions, demo)
    return demo
  }
  return transactions
}

export const getGroupTransactionsBySession = (sessionId: string): GroupTransaction[] => {
  return getGroupTransactions().filter((item) => item.sessionId === sessionId)
}

export const addGroupTransaction = (input: Omit<GroupTransaction, 'id' | 'dateISO'>): GroupTransaction => {
  const transactions = readStorage<GroupTransaction[]>(storageKeys.groupTransactions, [])
  const transaction: GroupTransaction = {
    ...input,
    id: `gt_${Date.now()}`,
    dateISO: new Date().toISOString()
  }
  transactions.unshift(transaction)
  writeStorage(storageKeys.groupTransactions, transactions)
  return transaction
}
