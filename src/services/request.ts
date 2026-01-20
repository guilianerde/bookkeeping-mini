import Taro from '@tarojs/taro'
import type { Result } from '../models/api'
import { API_BASE_URL } from '../config/api'
import { clearAuth, getAuthToken, redirectToLogin } from './authService'

export type RequestOptions<T> = {
  url: string
  method?: keyof Taro.request.Method
  data?: T
  header?: Record<string, string>
}

export const request = async <T, R = unknown>(options: RequestOptions<T>) => {
  const token = getAuthToken()
  if (!token) {
    redirectToLogin()
    throw new Error('AUTH_REQUIRED')
  }

  const url = options.url.startsWith('http') ? options.url : `${API_BASE_URL}${options.url}`

  const res = await Taro.request<Result<R>>({
    url,
    method: options.method ?? 'GET',
    data: options.data,
    header: {
      ...options.header,
      Authorization: `Bearer ${token}`
    }
  })

  if (res.statusCode === 401 || res.data?.code === 401) {
    clearAuth()
    redirectToLogin()
    throw new Error('AUTH_EXPIRED')
  }

  const successCodes = new Set([0, 200, '0', '200'])
  if (!res.data || !successCodes.has(res.data.code)) {
    throw new Error(res.data?.message || '请求失败')
  }

  return res.data.data
}
