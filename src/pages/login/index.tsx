import { Button, View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import './index.scss'
import { loginWithWeChat } from '../../services/authService'

const tabPages = new Set([
  '/pages/record/index',
  '/pages/transactions/index',
  // TODO: v1 暂时隐藏分析页
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
  const redirect = decodeURIComponent(router.params?.redirect ?? '')

  const handleLogin = async () => {
    if (loading) return
    setLoading(true)
    try {
      await loginWithWeChat()
      const target = redirect || '/pages/record/index'
      openTarget(target)
    } catch (error) {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login-page'>
      <View className='login-card'>
        <Text className='login-title'>欢迎使用记账</Text>
        <Text className='login-desc'>首次进入需要微信授权登录</Text>
        <Button className='login-button' onClick={handleLogin} loading={loading}>
          一键微信登录
        </Button>
      </View>
    </View>
  )
}
