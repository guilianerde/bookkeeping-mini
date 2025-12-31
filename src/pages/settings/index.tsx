import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import './index.scss'
import type { Settings } from '../../services/settingsService'
import { getSettings, updateSettings } from '../../services/settingsService'
import { clearTransactions } from '../../services/transactionService'
import { applyTheme, useThemeClass } from '../../utils/theme'
import Card from '../../components/ui/Card'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(() => getSettings())
  const themeClass = useThemeClass()

  useDidShow(() => {
    setSettings(getSettings())
  })

  const handleVoiceToggle = (event) => {
    const next = updateSettings({ voiceRecognitionEnabled: event.detail.value })
    setSettings(next)
  }

  const handleDarkModeToggle = (event) => {
    const next = updateSettings({ darkModeEnabled: event.detail.value })
    setSettings(next)
    applyTheme(next.darkModeEnabled ? 'dark' : 'light')
    Taro.showToast({ title: '已切换主题', icon: 'none' })
  }

  const handleBackup = () => {
    Taro.showModal({
      title: '数据备份',
      content: '备份功能开发中，将支持导出到云端。',
      showCancel: false
    })
  }

  const handleRestore = () => {
    Taro.showModal({
      title: '数据恢复',
      content: '恢复功能开发中，将支持从云端恢复。',
      showCancel: false
    })
  }

  const handleClearData = () => {
    Taro.showModal({
      title: '确认清除',
      content: '将清除本地交易记录，操作不可撤销。',
      confirmText: '清除',
      confirmColor: '#dc2626',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          clearTransactions()
          Taro.showModal({
            title: '清除完成',
            content: '本地交易记录已清空。',
            showCancel: false
          })
        }
      }
    })
  }

  const handleAbout = () => {
    Taro.showModal({
      title: '关于',
      content: 'Bookkeeping 小程序\\n版本 1.0.0\\n离线记账与语音录入正在完善。',
      showCancel: false
    })
  }

  return (
    <View className={`page ${themeClass}`}>
      <View className="page__header">
        <Text className="page__title">设置</Text>
        <Text className="page__subtitle">个性化与数据管理</Text>
      </View>

      <Card title="功能开关">
        <View className="setting-row">
          <View className="setting-row__left">
            <Text className="setting-row__title">语音记账</Text>
            <Text className="setting-row__desc">开启后可使用语音输入</Text>
          </View>
          <Switch checked={settings.voiceRecognitionEnabled} onChange={handleVoiceToggle} color="#2563eb" />
        </View>
        <View className="setting-row">
          <View className="setting-row__left">
            <Text className="setting-row__title">深色模式</Text>
            <Text className="setting-row__desc">切换后立即生效</Text>
          </View>
          <Switch checked={settings.darkModeEnabled} onChange={handleDarkModeToggle} color="#2563eb" />
        </View>
      </Card>

      <Card title="数据管理">
        <View className="action-row" onClick={handleBackup}>
          <Text className="action-row__label">数据备份</Text>
          <Text className="action-row__hint">云端备份</Text>
        </View>
        <View className="action-row" onClick={handleRestore}>
          <Text className="action-row__label">数据恢复</Text>
          <Text className="action-row__hint">从云端恢复</Text>
        </View>
        <View className="action-row action-row--danger" onClick={handleClearData}>
          <Text className="action-row__label">清除本地数据</Text>
          <Text className="action-row__hint">删除所有交易</Text>
        </View>
      </Card>

      <Card title="关于">
        <View className="action-row" onClick={handleAbout}>
          <Text className="action-row__label">版本信息</Text>
          <Text className="action-row__hint">1.0.0</Text>
        </View>
      </Card>
    </View>
  )
}
