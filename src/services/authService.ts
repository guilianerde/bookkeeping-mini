import Taro from '@tarojs/taro'
import type { Result } from '../models/api'
import { API_BASE_URL, AUTH_LOGIN_PATH } from '../config/api'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_PROFILE_KEY = 'auth_profile'

export const getAuthToken = () => {
  try {
    return Taro.getStorageSync(AUTH_TOKEN_KEY) as string | undefined
  } catch (error) {
    return undefined
  }
}

export const isLoggedIn = () => Boolean(getAuthToken())

export const setAuthToken = (token: string) => {
  Taro.setStorageSync(AUTH_TOKEN_KEY, token)
}

export const setAuthProfile = (profile: Taro.UserInfo | undefined) => {
  if (!profile) return
  Taro.setStorageSync(AUTH_PROFILE_KEY, profile)
}

export const clearAuth = () => {
  try {
    Taro.removeStorageSync(AUTH_TOKEN_KEY)
    Taro.removeStorageSync(AUTH_PROFILE_KEY)
  } catch (error) {
    // ignore
  }
}

const buildRedirectUrl = () => {
  const pages = Taro.getCurrentPages() as Array<{ route?: string; options?: Record<string, string> }>
  console.log("pages", pages)
  const current = pages[pages.length - 1]
  if (!current?.route) return ''
  const query = current.options ?? {}
  const queryString = Object.keys(query)
    .map((key) => `${key}=${encodeURIComponent(query[key] ?? '')}`)
    .join('&')
  return queryString ? `/${current.route}?${queryString}` : `/${current.route}`
}

export const redirectToLogin = (redirect?: string) => {
  const target = redirect || buildRedirectUrl()
  if (target.startsWith('/pages/login/index')) return
  const url = `/pages/login/index?redirect=${encodeURIComponent(target || '/pages/record/index')}`
  Taro.navigateTo({ url })
}

export const ensureLoginOrRedirect = () => {
  if (isLoggedIn()) return true
  redirectToLogin()
  return false
}

export type LoginResponse = {
  token: string
  userId: string
  nickname?: string
}

export const loginWithWeChat = async () => {
  const loginRes = await Taro.login()
  console.log('loginWithWeChat', loginRes)
  if (!loginRes.code) {
    throw new Error('登录失败')
  }

  const profile = await Taro.getUserProfile({ desc: '用于参与多人记账' })
  const res = await Taro.request<Result<LoginResponse>>({
    url: `${API_BASE_URL}${AUTH_LOGIN_PATH}`,
    method: 'POST',
    data: {
      code: loginRes.code,
      userInfo: profile.userInfo
    }
  })

  if (!res.data || res.data.code !== 0) {
    throw new Error(res.data?.message || '登录失败')
  }

  setAuthToken(res.data.data.token)
  setAuthProfile(profile.userInfo)
  return res.data.data
}
