export type GroupMember = {
  id: string
  name: string
  avatar?: string
  isSelf?: boolean
}

export type GroupSession = {
  id: string
  title: string
  createdAt: string
  members: GroupMember[]
}

export type GroupTransaction = {
  id: string
  sessionId: string
  amount: number
  description?: string
  payerId: string
  participantIds: string[]
  dateISO: string
}
