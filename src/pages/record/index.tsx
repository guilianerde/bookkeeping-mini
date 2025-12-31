import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import './index.scss'
import type { Transaction } from '../../models/transaction'
import { getCategories } from '../../services/categoryService'
import { getTransactions } from '../../services/transactionService'
import { formatAmount, formatDate, formatTime } from '../../utils/format'
import { getCategoryById } from '../../models/types'
import { useThemeClass } from '../../utils/theme'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PrimaryButton from '../../components/ui/PrimaryButton'
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
    Taro.navigateTo({ url: `/pages/record/quick?type=${type}` })
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
      <View className="page__header">
        <Text className="page__title">记账</Text>
        <Text className="page__subtitle">快速录入与最近交易</Text>
      </View>

      <Card title="快速记一笔">
        <View className="quick-actions">
          <Button className="quick-actions__button quick-actions__button--expense" onClick={() => handleQuickEntry('EXPENSE')}>
            记支出
          </Button>
          <Button className="quick-actions__button quick-actions__button--income" onClick={() => handleQuickEntry('INCOME')}>
            记收入
          </Button>
        </View>
        <View className="quick-actions__footer">
          <PrimaryButton text="语音记账" onClick={handleVoiceEntry} />
        </View>
      </Card>

      <Card title="最近记录" actionText="查看全部" onAction={handleViewAll} className="card--list">

        {recentTransactions.length === 0 ? (
          <EmptyState text="暂无记录，开始你的第一笔记账吧。" />
        ) : (
          <View className="transaction-list">
            {recentTransactions.map((item) => {
              const category = getCategoryById(item.categoryId)
              const amountClass = item.type === 'INCOME' ? 'amount amount--income' : 'amount amount--expense'
              return (
                <View className="transaction-item" key={item.id}>
                  <View className="transaction-item__left">
                    <Text className="transaction-item__icon">{category?.icon ?? '🧾'}</Text>
                    <View className="transaction-item__meta">
                      <Text className="transaction-item__name">{category?.desc ?? '未分类'}</Text>
                      <Text className="transaction-item__time">
                        {formatDate(item.dateISO)} {formatTime(item.dateISO)}
                      </Text>
                    </View>
                  </View>
                  <Text className={amountClass}>{formatAmount(item.amount, item.type)}</Text>
                </View>
              )
            })}
          </View>
        )}
      </Card>
    </View>
  )
}
