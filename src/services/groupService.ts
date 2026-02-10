import { request } from './request'
import { readStorage, storageKeys, writeStorage } from './storage'
import type { GroupExpense, GroupFinal, GroupMember, GroupSession, GroupSettlement } from '../models/group'
import { connectGroupSocket, disconnectGroupSocket, getGroupSocketState } from './groupWs'

type GroupApiResponse = {
  groupId: number
  title: string
  wsPath: string
}

export type GroupSummary = {
  groupId: number
  title: string
  time: string
  totalAmount: number
  participantCount: number
  status: 0 | 1
}

const toSession = (data: GroupApiResponse): GroupSession => ({
  id: data.groupId,
  title: data.title,
  wsPath: data.wsPath,
  joinedAt: new Date().toISOString()
})

export const getJoinedGroups = (): GroupSession[] => {
  return readStorage<GroupSession[]>(storageKeys.groupSessions, [])
}

export const getJoinedGroupById = (groupId: number) => {
  return getJoinedGroups().find((item) => item.id === groupId)
}

export const saveJoinedGroup = (session: GroupSession) => {
  const groups = getJoinedGroups()
  const next = [session, ...groups.filter((item) => item.id !== session.id)]
  writeStorage(storageKeys.groupSessions, next)
  return session
}

export const removeJoinedGroup = (groupId: number) => {
  const groups = getJoinedGroups().filter((item) => item.id !== groupId)
  writeStorage(storageKeys.groupSessions, groups)
}

export const createGroup = async (title: string) => {
  const data = await request<{ title: string }, GroupApiResponse>({
    url: '/groups/create',
    method: 'POST',
    data: { title }
  })
  console.log("data:::::::--",data)
  const session = saveJoinedGroup(toSession(data))
  connectGroupSocket(session.id, session.wsPath)
  return session
}

export const joinGroup = async (groupId: number, options?: { force?: boolean }) => {
  const forceJoin = options?.force ?? false
  const existing = getJoinedGroupById(groupId)
  if (existing && !forceJoin) {
    connectGroupSocket(existing.id, existing.wsPath)
    return existing
  }
  const data = await request<{ groupId: number }, GroupApiResponse>({
    url: `/groups/join/${groupId}`,
    method: 'POST',
    data: { groupId }
  })
  const session = saveJoinedGroup(toSession(data))
  connectGroupSocket(session.id, session.wsPath)
  return session
}

export const ensureGroupSession = async (groupId: number) => {
  const existing = getJoinedGroupById(groupId)
  if (existing?.wsPath) {
    const state = getGroupSocketState(groupId)
    if (state === 'ready' || state === 'pending') return existing
  }
  return joinGroup(groupId, { force: true })
}

export const leaveGroup = async (groupId: number) => {
  await request<Record<string, never>, GroupApiResponse>({
    url: `/groups/leave/${groupId}`,
    method: 'POST'
  })
  disconnectGroupSocket(groupId)
  removeJoinedGroup(groupId)
}

export const kickGroupMember = async (groupId: number, userId: number) => {
  await request<Record<string, never>, GroupApiResponse>({
    url: `/groups/kick/${groupId}/${userId}`,
    method: 'POST'
  })
}

export const fetchSettlement = async (groupId: number) => {
  return request<Record<string, never>, GroupSettlement>({
    url: `/groups/settlement/${groupId}`,
    method: 'GET'
  })
}

export const fetchMyGroups = async () => {
  return request<Record<string, never>, GroupSummary[]>({
    url: '/groups/mine',
    method: 'GET'
  })
}

export const getGroupExpenses = (groupId: number): GroupExpense[] => {
  const all = readStorage<GroupExpense[]>(storageKeys.groupTransactions, [])
  return all.filter((item) => item.groupId === groupId)
}

export const saveGroupExpense = (expense: GroupExpense) => {
  const all = readStorage<GroupExpense[]>(storageKeys.groupTransactions, [])
  const next = [expense, ...all.filter((item) => item.id !== expense.id)]
  writeStorage(storageKeys.groupTransactions, next)
}

export const addLocalExpense = (groupId: number, payload: { amount: number; title?: string; remark?: string; userId?: number; userName?: string; userAvatar?: string }) => {
  const expense: GroupExpense = {
    id: `local_${Date.now()}`,
    groupId,
    amount: payload.amount,
    title: payload.title,
    remark: payload.remark,
    userId: payload.userId,
    userName: payload.userName,
    userAvatar: payload.userAvatar,
    dateISO: new Date().toISOString()
  }
  saveGroupExpense(expense)
  return expense
}

export const getGroupMembers = (groupId: number): GroupMember[] => {
  const all = readStorage<GroupMember[]>(storageKeys.groupMembers, [])
  return all.filter((item) => item.groupId === groupId)
}

export const fetchGroupMembers = async (groupId: number) => {
  return request<Record<string, never>, GroupMember[]>({
    url: `/groups/${groupId}/members`,
    method: 'GET'
  })
}

export const upsertGroupMember = (member: GroupMember) => {
  const all = readStorage<GroupMember[]>(storageKeys.groupMembers, [])
  const next = [member, ...all.filter((item) => !(item.groupId === member.groupId && item.userId === member.userId))]
  writeStorage(storageKeys.groupMembers, next)
  return member
}

export const fetchGroupFinal = async (groupId: number) => {
  const data = await request<Record<string, never>, GroupFinal>({
    url: `/groups/final/${groupId}`,
    method: 'GET'
  })
  if (data?.members?.length) {
    data.members.forEach((member) => {
      if (!member.userId) return
      upsertGroupMember({
        groupId: data.groupId,
        userId: member.userId,
        nickName: member.name,
        avatarUrl: member.avatar,
        joinedAt: member.joinTime || data.endTime || new Date().toISOString()
      })
    })
  }
  return data
}
