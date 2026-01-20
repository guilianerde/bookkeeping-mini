import Taro from '@tarojs/taro'
import type { Result } from '../models/api'
import { API_BASE_URL, AUTH_LOGIN_PATH } from '../config/api'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_PROFILE_KEY = 'auth_profile'
const AUTH_USER_ID_KEY = 'auth_user_id'

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

export const getAuthUserId = () => {
  try {
    const value = Taro.getStorageSync(AUTH_USER_ID_KEY)
    if (value === '' || value === undefined || value === null) return undefined
    return Number(value)
  } catch (error) {
    return undefined
  }
}

export const setAuthUserId = (userId: number | string) => {
  if (userId === undefined || userId === null) return
  Taro.setStorageSync(AUTH_USER_ID_KEY, Number(userId))
}

export const clearAuth = () => {
  try {
    Taro.removeStorageSync(AUTH_TOKEN_KEY)
    Taro.removeStorageSync(AUTH_PROFILE_KEY)
    Taro.removeStorageSync(AUTH_USER_ID_KEY)
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
  if (!Taro.canIUse('getUserProfile')) {
    throw new Error('当前环境不支持用户授权')
  }

  // 注意：getUserProfile 必须在用户手势内调用，放在 login 之前以避免失去手势上下文
  const profile = await Taro.getUserProfile({ desc: '用于参与多人记账' })
  console.log('profile', profile)

  const loginRes = await Taro.login()
  console.log('loginWithWeChat', loginRes)
  if (!loginRes.code) {
    throw new Error('登录失败')
  }
  const res = await Taro.request<Result<LoginResponse>>({
    url: `${API_BASE_URL}${AUTH_LOGIN_PATH}`,
    method: 'POST',
    data: {
      code: loginRes.code,
      userInfo: profile.userInfo
    }
  })
  console.log('loginWithWeChat-res', res)
  if (!res.data || res.data.code != 200) {
    throw new Error(res.data?.message || '登录失败')
  }
  setAuthToken(res.data.data.token)
  setAuthProfile(profile.userInfo)
  setAuthUserId(res.data.data.userId)
  return res.data.data
}
