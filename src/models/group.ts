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
  dateISO: string
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
