import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Empty, Flex, SafeArea } from '@taroify/core'
import { ArrowRight, Audio, ArrowDown, ArrowUp } from '@taroify/icons'
import "@taroify/icons/index.scss"
import "@taroify/core/index.scss"
import '@taroify/core/safe-area/style'
import './index.scss'
import Card from '../../components/ui/Card'
import type { Transaction } from '../../models/transaction'
import { getCategories } from '../../services/categoryService'
import { getTransactions } from '../../services/transactionService'
import { formatDate, formatTime } from '../../utils/format'
import { getCategoryById } from '../../models/types'
import { useThemeClass } from '../../utils/theme'
import { getSettings } from '../../services/settingsService'

export default function RecordPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const themeClass = useThemeClass()
  const monthlyBudget = 3000
  const [animatedTotals, setAnimatedTotals] = useState({ expense: 0, income: 0, balance: 0 })
  const prevTotalsRef = useRef({ expense: 0, income: 0, balance: 0 })

  useDidShow(() => {
    getCategories()
    setTransactions(getTransactions())
  })

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions])
  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        if (item.type === 'INCOME') {
          acc.income += item.amount
        } else {
          acc.expense += item.amount
        }
        return acc
      },
      { income: 0, expense: 0 }
    )
  }, [transactions])

  useEffect(() => {
    const from = prevTotalsRef.current
    const to = {
      expense: totals.expense,
      income: totals.income,
      balance: totals.income - totals.expense
    }
    const duration = 600
    const start = Date.now()
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      setAnimatedTotals({
        expense: from.expense + (to.expense - from.expense) * progress,
        income: from.income + (to.income - from.income) * progress,
        balance: from.balance + (to.balance - from.balance) * progress
      })
      if (progress < 1) {
        timer = setTimeout(tick, 16)
      } else {
        prevTotalsRef.current = to
      }
    }

    tick()
    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [totals])

  const formatCurrencyParts = (value: number) => {
    const [intPart, decPart] = value.toFixed(2).split('.')
    return { intPart, decPart }
  }

  const getAmountDisplay = (amount: number, type: 'INCOME' | 'EXPENSE') => {
    const sign = type === 'INCOME' ? '+' : '-'
    const [intPart, decPart] = amount.toFixed(2).split('.')
    const className = type === 'INCOME' ? 'record-amount record-amount--income' : 'record-amount record-amount--expense'
    return { sign, intPart, decPart, className }
  }

  const categoryToneMap: Record<number, string> = {
    1: 'food',
    2: 'shop',
    3: 'traffic',
    4: 'fun',
    5: 'health',
    6: 'study',
    7: 'travel',
    101: 'income',
    102: 'income',
    103: 'income',
    104: 'income'
  }

  const getCategoryTone = (categoryId?: number) => categoryToneMap[categoryId ?? -1] ?? 'default'
  const categoryColorMap: Record<string, string> = {
    food: 'record-cell__icon--food',
    shop: 'record-cell__icon--shop',
    traffic: 'record-cell__icon--traffic',
    fun: 'record-cell__icon--fun',
    health: 'record-cell__icon--health',
    study: 'record-cell__icon--study',
    travel: 'record-cell__icon--travel',
    income: 'record-cell__icon--income'
  }

  const expenseParts = formatCurrencyParts(animatedTotals.expense)
  const incomeParts = formatCurrencyParts(animatedTotals.income)
  const balanceParts = formatCurrencyParts(animatedTotals.balance)
  const budgetParts = formatCurrencyParts(monthlyBudget)
  const dailyExpenseParts = formatCurrencyParts(animatedTotals.expense / 30)
  const progressPercent = monthlyBudget > 0 ? Math.min(Math.round((totals.expense / monthlyBudget) * 100), 100) : 0
  const dashboardItems = [
    { key: 'balance', label: '本月结余', parts: balanceParts },
    { key: 'budget', label: '总预算', parts: budgetParts },
    { key: 'daily', label: '日均支出', parts: dailyExpenseParts }
  ]
  const recordItems = useMemo(
    () =>
      recentTransactions.map((item) => {
        const category = getCategoryById(item.categoryId)
        const amountDisplay = getAmountDisplay(item.amount, item.type)
        return {
          id: item.id,
          category,
          amountDisplay,
          tone: getCategoryTone(category?.id),
          timeText: `${formatDate(item.dateISO)} ${formatTime(item.dateISO)}`
        }
      }),
    [recentTransactions]
  )

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
    <View className={`page record-page ${themeClass}`}>
      <View className="page__content">
        <View className="page__header">
          <Text className="page__title">记账</Text>
          <Text className="page__helper">几秒钟完成一笔记账。</Text>
        </View>

        <Card className="summary-card">
          <View className="summary-card__top">
            <View className="summary-metric">
              <Text className="summary-metric__label">本月支出</Text>
              <View className="summary-metric__value">
                <Text className="summary-metric__currency">¥</Text>
                <Text className="summary-metric__int">{expenseParts.intPart}</Text>
                <Text className="summary-metric__dec">.{expenseParts.decPart}</Text>
              </View>
            </View>
            <View className="summary-metric">
              <Text className="summary-metric__label">本月收入</Text>
              <View className="summary-metric__value">
                <Text className="summary-metric__currency">¥</Text>
                <Text className="summary-metric__int">{incomeParts.intPart}</Text>
                <Text className="summary-metric__dec">.{incomeParts.decPart}</Text>
              </View>
            </View>
          </View>
          <View className="summary-card__progress">
            <View className="summary-card__progress-bar">
              <View className="summary-card__progress-fill" style={{ width: `${progressPercent}%` }} />
            </View>
            <Text className="summary-card__progress-text">预算已用 {progressPercent}%</Text>
          </View>
          <View className="summary-card__divider" />
          <Flex className="summary-card__stats" align="center">
            {dashboardItems.map((item) => (
              <Flex.Item key={item.key} className="summary-stat">
                <Text className="summary-stat__label">{item.label}</Text>
                <View className="summary-stat__value">
                  <Text className="summary-stat__currency">¥</Text>
                  <Text className="summary-stat__int">{item.parts.intPart}</Text>
                  <Text className="summary-stat__dec">.{item.parts.decPart}</Text>
                </View>
              </Flex.Item>
            ))}
          </Flex>
        </Card>

        <Card className="quick-card">
          <Flex className="quick-split" align="stretch">
            {/*<Flex.Item className="quick-split__main">*/}
              {/*<Cell className="voice-cta" clickable hoverClass="press-opacity" onClick={handleVoiceEntry}>*/}
              {/*  <View className="voice-cta__content">*/}
              {/*    <View className="voice-cta__icon">*/}
              {/*      <Audio />*/}
              {/*    </View>*/}
              {/*    <View className="voice-cta__text">*/}
              {/*      <Text className="voice-cta__title">语音记账</Text>*/}
              {/*      <Text className="voice-cta__hint">轻触开始</Text>*/}
              {/*    </View>*/}
              {/*  </View>*/}
              {/*  <ArrowRight className="voice-cta__chevron" />*/}
              {/*</Cell>*/}
            {/*</Flex.Item>*/}
            <Flex.Item className="quick-split__side">
              <View className="quick-stack">
                <View
                  className="quick-mini quick-mini--expense"
                  hoverClass="quick-mini--active press-opacity"
                  onClick={() => handleQuickEntry('EXPENSE')}
                >
                  <View className="quick-mini__icon quick-mini__icon--expense">
                    <ArrowDown />
                  </View>
                  <Text className="quick-mini__title">支出</Text>
                </View>
                <View
                  className="quick-mini quick-mini--income"
                  hoverClass="quick-mini--active press-opacity"
                  onClick={() => handleQuickEntry('INCOME')}
                >
                  <View className="quick-mini__icon quick-mini__icon--income">
                    <ArrowUp />
                  </View>
                  <Text className="quick-mini__title">收入</Text>
                </View>
              </View>
            </Flex.Item>
          </Flex>
        </Card>

        <View className="section-head">
          <Text className="section-head__title">最近记录</Text>
          <Text className="section-head__action" hoverClass="press-opacity" onClick={handleViewAll}>
            查看全部
          </Text>
        </View>
        <Card className="records-group">
          {recentTransactions.length === 0 ? (
            <View className="records-empty">
              <Empty description="暂无记录" />
              <Text className="records-empty__hint">开始你的第一笔记账</Text>
            </View>
          ) : (
            recordItems.map((item) => {
              const iconClass = categoryColorMap[item.tone] ?? ''
              return (
                <Cell key={item.id} className="record-cell" clickable hoverClass="cell-hover press-opacity">
                  <View className="record-cell__left">
                    <View className={`record-cell__icon ${iconClass}`}>{item.category?.icon ?? '🧾'}</View>
                    <View className="record-cell__meta">
                      <Text className="record-cell__name">{item.category?.desc ?? '未分类'}</Text>
                      <Text className="record-cell__time">{item.timeText}</Text>
                    </View>
                  </View>
                  <View className={item.amountDisplay.className}>
                    <Text className="record-amount__sign">{item.amountDisplay.sign}</Text>
                    <Text className="record-amount__currency">¥</Text>
                    <Text className="record-amount__int">{item.amountDisplay.intPart}</Text>
                    <Text className="record-amount__dec">.{item.amountDisplay.decPart}</Text>
                  </View>
                </Cell>
              )
            })
          )}
        </Card>
      </View>
      <SafeArea position="bottom" />
    </View>
  )
}
