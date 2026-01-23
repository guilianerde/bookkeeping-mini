import Taro from '@tarojs/taro'
import { API_BASE_URL } from '../config/api'
import { getAuthToken } from './authService'

type GroupMessageHandler = (payload: any) => void

type SocketState = {
  task: Taro.SocketTask
  ready: boolean
  pending: string[]
}

export const getGroupSocketState = (groupId: number) => {
  const state = sockets.get(groupId)
  if (!state) return 'none'
  return state.ready ? 'ready' : 'pending'
}

const sockets = new Map<number, SocketState>()
const listeners = new Map<number, Set<GroupMessageHandler>>()

const normalizeWsUrl = (wsPath: string) => {
  if (!wsPath) return ''
  if (wsPath.startsWith('ws://') || wsPath.startsWith('wss://')) return wsPath
  const base = API_BASE_URL.replace(/^http/, 'ws')
  if (wsPath.startsWith('/')) return `${base}${wsPath}`
  return `${base}/${wsPath}`
}

const parseMessage = (data: any) => {
  if (!data) return data
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (error) {
      return { type: 'text', data }
    }
  }
  return data
}

export const connectGroupSocket = async (groupId: number, wsPath: string) => {
  const existing = sockets.get(groupId)
  if (existing) return existing.task
  const url = normalizeWsUrl(wsPath)
  if (!url) return undefined

  const token = getAuthToken()
  const socketOrPromise = Taro.connectSocket({
    url,
    header: token ? { Authorization: `Bearer ${token}` } : undefined
  })
  const socket = socketOrPromise instanceof Promise ? await socketOrPromise : socketOrPromise
  const state: SocketState = { task: socket, ready: false, pending: [] }
  sockets.set(groupId, state)

  socket.onOpen(() => {
    state.ready = true
    if (state.pending.length) {
      state.pending.forEach((data) => socket.send({ data }))
      state.pending = []
    }
  })

  socket.onMessage((event) => {
    const payload = parseMessage(event.data)
    const handlers = listeners.get(groupId)
    if (!handlers) return
    handlers.forEach((handler) => handler(payload))
  })

  socket.onClose(() => {
    sockets.delete(groupId)
  })

  socket.onError(() => {
    sockets.delete(groupId)
  })

  return socket
}

export const ensureGroupSocket = async (groupId: number, wsPath?: string) => {
  const existing = sockets.get(groupId)
  if (existing?.ready) return existing.task
  if (existing && !existing.ready) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return existing.task
  }
  if (!wsPath) return undefined
  return connectGroupSocket(groupId, wsPath)
}

export const disconnectGroupSocket = (groupId: number) => {
  const state = sockets.get(groupId)
  if (!state) return
  state.task.close()
  sockets.delete(groupId)
}

export const sendGroupExpense = async (groupId: number, payload: any, wsPath?: string) => {
  const data = JSON.stringify(payload)
  const existing = sockets.get(groupId)
  if (existing?.ready) {
    existing.task.send({ data })
    return
  }
  if (existing && !existing.ready) {
    existing.pending.push(data)
    return
  }
  if (wsPath) {
    const task = await ensureGroupSocket(groupId, wsPath)
    if (!task) throw new Error('WS_NOT_CONNECTED')
    const state = sockets.get(groupId)
    if (state?.ready) {
      task.send({ data })
      return
    }
    if (state) {
      state.pending.push(data)
      return
    }
  }
  throw new Error('WS_NOT_CONNECTED')
}

export const onGroupMessage = (groupId: number, handler: GroupMessageHandler) => {
  const set = listeners.get(groupId) ?? new Set<GroupMessageHandler>()
  set.add(handler)
  listeners.set(groupId, set)
  return () => {
    const next = listeners.get(groupId)
    if (!next) return
    next.delete(handler)
    if (next.size === 0) listeners.delete(groupId)
  }
}
