import Taro from '@tarojs/taro'
import type { Result } from '../models/api'
import { clearAuth, getAuthToken, redirectToLogin } from './authService'

export type RequestOptions<T> = {
  url: string
  method?: Taro.request.Method
  data?: T
  header?: Record<string, string>
}

export const request = async <T, R = unknown>(options: RequestOptions<T>) => {
  const token = getAuthToken()
  if (!token) {
    redirectToLogin()
    throw new Error('AUTH_REQUIRED')
  }

  const res = await Taro.request<Result<R>>({
    url: options.url,
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

  if (!res.data || res.data.code !== 0) {
    throw new Error(res.data?.message || '请求失败')
  }

  return res.data.data
}
