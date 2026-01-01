import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { Cell, Empty, Flex, SafeArea } from '@taroify/core'
import { ArrowRight, Audio, ArrowDown, ArrowUp } from '@taroify/icons'
import "@taroify/icons/index.scss"
import "@taroify/core/index.scss"
import '@taroify/core/safe-area/style'
import './index.scss'
import type { Transaction } from '../../models/transaction'
import { getCategories } from '../../services/categoryService'
import { getTransactions } from '../../services/transactionService'
import { formatAmount, formatDate, formatTime } from '../../utils/format'
import { getCategoryById } from '../../models/types'
import { useThemeClass } from '../../utils/theme'
import { getSettings } from '../../services/settingsService'

export default function RecordPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const themeClass = useThemeClass()

  useDidShow(() => {
    getCategories()
    setTransactions(getTransactions())
  })

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions])

  const handleQuickEntry = (type: 'EXPENSE' | 'INCOME') => {
    Taro.navigateTo({
      url: `/pages/record/quick/index?type=${type}`,
      animationType: 'fade-in',
      animationDuration: 180
    })
  }

  const handleVoiceEntry = () => {
    if (!getSettings().voiceRecognitionEnabled) {
      Taro.showToast({ title: '语音记账已关闭', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/record/voice/index' })
  }

  const handleViewAll = () => {
    Taro.switchTab({ url: '/pages/transactions/index' })
  }

  return (
    <View className={`page ${themeClass}`}>
      <View className="page__content">
        <View className="page__header">
          <Text className="page__title">记账</Text>
          <Text className="page__helper">几秒钟完成一笔记账。</Text>
        </View>

        <View className="summary-row">
          <Text className="summary-row__label">本月支出</Text>
          <Text className="summary-row__value summary-row__value--expense">¥0</Text>
          <Text className="summary-row__separator">/</Text>
          <Text className="summary-row__label">收入</Text>
          <Text className="summary-row__value summary-row__value--income">¥0</Text>
        </View>

        <Cell.Group className="quick-card">
          <Text className="section-title">快捷记账</Text>
          <Flex className="quick-split" align="stretch">
            <Flex.Item className="quick-split__main">
              <Cell className="voice-cta" clickable onClick={handleVoiceEntry}>
                <View className="voice-cta__content">
                  <View className="voice-cta__icon">
                    <Audio />
                  </View>
                  <View className="voice-cta__text">
                    <Text className="voice-cta__title">语音记账</Text>
                    <Text className="voice-cta__hint">轻触开始</Text>
                  </View>
                </View>
                <ArrowRight className="voice-cta__chevron" />
              </Cell>
            </Flex.Item>
            <Flex.Item className="quick-split__side">
              <View className="quick-stack">
                <View className="quick-mini quick-mini--expense" onClick={() => handleQuickEntry('EXPENSE')}>
                  <View className="quick-mini__icon quick-mini__icon--expense">
                    <ArrowDown />
                  </View>
                  <Text className="quick-mini__title">支出</Text>
                </View>
                <View className="quick-mini quick-mini--income" onClick={() => handleQuickEntry('INCOME')}>
                  <View className="quick-mini__icon quick-mini__icon--income">
                    <ArrowUp />
                  </View>
                  <Text className="quick-mini__title">收入</Text>
                </View>
              </View>
            </Flex.Item>
          </Flex>
        </Cell.Group>

        <View className="section-head">
          <Text className="section-head__title">最近记录</Text>
          <Text className="section-head__action" onClick={handleViewAll}>
            查看全部
          </Text>
        </View>
        <Cell.Group className="records-group">
          {recentTransactions.length === 0 ? (
            <View className="records-empty">
              <Empty description="暂无记录" />
              <Text className="records-empty__hint">开始你的第一笔记账</Text>
            </View>
          ) : (
            recentTransactions.map((item) => {
              const category = getCategoryById(item.categoryId)
              const amountClass = item.type === 'INCOME' ? 'record-amount record-amount--income' : 'record-amount record-amount--expense'
              return (
                <Cell key={item.id} className="record-cell">
                  <View className="record-cell__left">
                    <View className="record-cell__icon">{category?.icon ?? '🧾'}</View>
                    <View className="record-cell__meta">
                      <Text className="record-cell__name">{category?.desc ?? '未分类'}</Text>
                      <Text className="record-cell__time">
                        {formatDate(item.dateISO)} {formatTime(item.dateISO)}
                      </Text>
                    </View>
                  </View>
                  <Text className={amountClass}>{formatAmount(item.amount, item.type)}</Text>
                </Cell>
              )
            })
          )}
        </Cell.Group>
      </View>
      <SafeArea position="bottom" />
    </View>
  )
}
