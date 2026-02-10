// noinspection LossyEncoding

import { Button, View, Text, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import './index.scss'
import { loginWithWeChat, uploadAvatar } from '../../services/authService'

const tabPages = new Set([
  '/pages/record/index',
  '/pages/transactions/index',
  // TODO: v1 暂时隐藏分析�?
  // '/pages/analytics/index',
  '/pages/settings/index'
])

const normalizePath = (path?: string) => {
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

const openTarget = (url: string) => {
  const normalized = normalizePath(url)
  const [path] = normalized.split('?')
  if (tabPages.has(path)) {
    Taro.switchTab({ url: path })
    return
  }
  Taro.redirectTo({ url: normalized })
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [nickname, setNickname] = useState(() => {
    const seed = Math.floor(100000 + Math.random() * 900000)
    return `用户${seed}`
  })
  const redirect = decodeURIComponent(router.params?.redirect ?? '')

  const doLogin = async (avatarOverride?: string) => {
    const trimmedName = nickname.trim()
    await loginWithWeChat({
      nickName: trimmedName || undefined,
      avatarUrl: avatarOverride || avatarUrl || undefined
    })
    const target = redirect || '/pages/record/index'
    openTarget(target)
  }

  const handleLogin = async (avatarOverride?: string) => {
    if (loading) return
    setLoading(true)
    try {
      await doLogin(avatarOverride)
    } catch (error) {
      console.error('login----error----', error)
      Taro.showToast({title: '登录失败，请重试', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const handleChooseAvatar = async (event: any) => {
    const url = event?.detail?.avatarUrl ?? ''
    if (!url) {
      Taro.showToast({title: '请先选择头像', icon: 'none'})
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const uploadedUrl = await uploadAvatar(url)
      setAvatarUrl(uploadedUrl)
      await doLogin(uploadedUrl)
    } catch (error) {
      console.error('avatar-upload----error----', error)
      Taro.showToast({title: '上传失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }
  return (
    <View className='login-page'>
      <View className='login-card'>
        <Text className='login-title'>欢迎使用记账</Text>
        <Text className='login-desc'>已为你生成随机昵称，可修改</Text>
          <Input
            className='login-nickname'
            value={nickname}
            onInput={(event) => setNickname(event.detail.value)}
            placeholder='请输入昵称（可选）'
            placeholderClass='login-nickname__placeholder'
          />
          {avatarUrl ? (
            <Button className='login-button' onClick={() => handleLogin()} loading={loading}>
              一键微信登录
            </Button>
          ) : (
            <Button
              className='login-button'
              openType='chooseAvatar'
              onChooseAvatar={handleChooseAvatar}
              loading={loading}
            >
              一键微信登录
            </Button>
          )}
      </View>
    </View>
)
}
