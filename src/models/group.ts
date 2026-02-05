export type GroupSession = {
  id: number
  title: string
  wsPath: string
  joinedAt: string
}

export type GroupExpense = {
  id: string
  groupId: number
  amount: number
  title?: string
  remark?: string
  userId?: number
  userName?: string
  userAvatar?: string
  dateISO: string
}

export type GroupMember = {
  groupId: number
  userId: number
  nickName?: string
  avatarUrl?: string
  joinedAt: string
  role?: 'owner' | 'member'
  status?: 0 | 1  // 0=在房，1=离开/被踢
  leaveTime?: string
  leaveReason?: 'leave' | 'kick'
}

export type GroupSettlement = {
  groupId: number
  balances: Array<{
    userId: number
    totalPaid: number
    shouldPay: number
    netAmount: number
  }>
  transfers: Array<{
    fromUserId: number
    toUserId: number
    amount: number
  }>
}

export type GroupFinalExpense = {
  amount: number
  title?: string
  remark?: string
  expenseType?: number
  createTime: string
}

export type GroupFinalMember = {
  userId: number
  name?: string
  avatar?: string
  joinTime: string
  expenses: GroupFinalExpense[]
}

export type GroupFinal = {
  groupId: number
  title: string
  status: number
  endTime?: string
  members: GroupFinalMember[]
  settlement: GroupSettlement
}

// WebSocket 成员变更消息
export type MemberChangeMessage = {
  type: 'member_kick' | 'member_leave'
  groupId: string
  userId: string
  operatorId?: string
  timestamp: number
}

// WebSocket 结算更新消息
export type SettlementMessage = {
  type: 'settlement'
  groupId: string
  settlement: {
    transfers: Array<{
      from: string
      to: string
      amount: number
    }>
    netAmounts: Record<string, number>
  }
  timestamp: number
}
