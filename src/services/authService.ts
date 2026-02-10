import Taro from '@tarojs/taro'
import type { Result } from '../models/api'
import { API_BASE_URL, AUTH_LOGIN_PATH, UPLOAD_AVATAR_PATH } from '../config/api'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_PROFILE_KEY = 'auth_profile'
const AUTH_USER_ID_KEY = 'auth_user_id'

export type AuthProfile = {
  nickName?: string
  avatarUrl?: string
}

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

export const setAuthProfile = (profile: AuthProfile | undefined) => {
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

type UploadAvatarPayload = {
  url?: string
}

export const uploadAvatar = async (filePath: string) => {
  const res = await Taro.uploadFile({
    url: `${API_BASE_URL}${UPLOAD_AVATAR_PATH}`,
    filePath,
    name: 'file'
  })
  let data: any = res.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      data = null
    }
  }
  const successCodes = new Set([0, 200, '0', '200'])
  if (!data || !successCodes.has(data.code)) {
    throw new Error(data?.message || '头像上传失败')
  }
  const payload = data.data as UploadAvatarPayload
  const url = payload?.url
  if (!url) {
    throw new Error('头像上传失败')
  }
  return url
}

export const loginWithWeChat = async (profile?: AuthProfile) => {
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
      // TODO(backend): 接收并保存用户自定义的昵称/头像（不要依赖 getUserProfile）
      nickname: profile?.nickName,
      avatarUrl: profile?.avatarUrl
    }
  })
  console.log('loginWithWeChat-res', res)
  if (!res.data || (res.data.code !== 0 && res.data.code !== 200)) {
    throw new Error(res.data?.message || '登录失败')
  }
  setAuthToken(res.data.data.token)
  setAuthProfile(profile)
  setAuthUserId(res.data.data.userId)
  return res.data.data
}
