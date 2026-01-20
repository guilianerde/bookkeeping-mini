import Taro from '@tarojs/taro'
import { API_BASE_URL } from '../config/api'
import { getAuthToken } from './authService'

type GroupMessageHandler = (payload: any) => void
type SocketValue = Taro.SocketTask | Promise<Taro.SocketTask>

const sockets = new Map<number, SocketValue>()
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

const isPromise = (value: SocketValue): value is Promise<Taro.SocketTask> => {
  return typeof (value as Promise<Taro.SocketTask>)?.then === 'function'
}

const resolveSocket = async (groupId: number) => {
  const socket = sockets.get(groupId)
  if (!socket) return null
  if (isPromise(socket)) {
    return socket
  }
  return socket
}

export const connectGroupSocket = (groupId: number, wsPath: string) => {
  if (sockets.has(groupId)) return
  const url = normalizeWsUrl(wsPath)
  if (!url) return

  const token = getAuthToken()
  const socketPromise = Taro.connectSocket({
    url,
    header: token ? { Authorization: `Bearer ${token}` } : undefined
  })

  sockets.set(groupId, socketPromise)

  socketPromise
    .then((socket) => {
      sockets.set(groupId, socket)

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
    })
    .catch(() => {
      sockets.delete(groupId)
    })
}

export const disconnectGroupSocket = async (groupId: number) => {
  const socket = await resolveSocket(groupId)
  if (!socket) return
  socket.close()
  sockets.delete(groupId)
}

export const sendGroupExpense = async (groupId: number, payload: any) => {
  const socket = await resolveSocket(groupId)
  if (!socket) {
    throw new Error('WS_NOT_CONNECTED')
  }
  socket.send({ data: JSON.stringify(payload) })
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
