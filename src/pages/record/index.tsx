import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Empty, Flex, Popup, SafeArea } from '@taroify/core'
import { ArrowDown, ArrowUp } from '@taroify/icons'
import '@taroify/icons/index.scss'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import Card from '../../components/ui/Card'
import PrimaryButton from '../../components/ui/PrimaryButton'
import type { Transaction } from '../../models/transaction'
import type { GroupSession, GroupExpense } from '../../models/group'
import { getCategories } from '../../services/categoryService'
import { getTransactions } from '../../services/transactionService'
import { createGroup, getGroupExpenses, getJoinedGroups } from '../../services/groupService'
import { formatDate, formatTime } from '../../utils/format'
import { getCategoryById } from '../../models/types'
import { useThemeClass } from '../../utils/theme'

export default function RecordPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [groupSessions, setGroupSessions] = useState<GroupSession[]>([])
  const [groupExpenses, setGroupExpenses] = useState<GroupExpense[]>([])
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const themeClass = useThemeClass()
  const monthlyBudget = 3000
  const [animatedTotals, setAnimatedTotals] = useState({ expense: 0, income: 0, balance: 0 })
  const prevTotalsRef = useRef({ expense: 0, income: 0, balance: 0 })

  useDidShow(() => {
    getCategories()
    setTransactions(getTransactions())
    const groups = getJoinedGroups()
    setGroupSessions(groups)
    const allExpenses = groups.flatMap((session) => getGroupExpenses(session.id))
    setGroupExpenses(allExpenses)
  })

  const recentTransactions = useMemo(() => transactions, [transactions])
  const groupSessionMap = useMemo(
    () => new Map(groupSessions.map((session) => [session.id, session])),
    [groupSessions]
  )
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
    income: 'record-cell__icon--income',
    group: 'record-cell__icon--group'
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
  const recordItems = useMemo(() => {
    const personalItems = recentTransactions.map((item) => {
      const category = getCategoryById(item.categoryId)
      const amountDisplay = getAmountDisplay(item.amount, item.type)
      return {
        id: `personal-${item.id}`,
        source: 'personal' as const,
        name: category?.desc ?? '未分类',
        icon: category?.icon ?? '🧾',
        amountDisplay,
        tone: getCategoryTone(category?.id),
        timeText: `${formatDate(item.dateISO)} ${formatTime(item.dateISO)}`,
        dateISO: item.dateISO
      }
    })

    const groupItems = groupExpenses.map((item) => {
      const session = groupSessionMap.get(item.groupId)
      const amountDisplay = getAmountDisplay(item.amount, 'EXPENSE')
      return {
        id: `group-${item.id}`,
        source: 'group' as const,
        name: session?.title ?? '多人记账',
        icon: '👥',
        amountDisplay: { ...amountDisplay, className: 'record-amount record-amount--group' },
        tone: 'group',
        timeText: `${formatDate(item.dateISO)} ${formatTime(item.dateISO)}`,
        dateISO: item.dateISO
      }
    })

    return [...personalItems, ...groupItems]
      .sort((a, b) => (b.dateISO ?? '').localeCompare(a.dateISO ?? ''))
      .slice(0, 5)
  }, [recentTransactions, groupExpenses, groupSessionMap])

  const handleQuickEntry = (type: 'EXPENSE' | 'INCOME') => {
    Taro.navigateTo({
      url: `/pages/record/quick/index?type=${type}`,
      animationType: 'fade-in',
      animationDuration: 180
    })
  }


  const handleOpenGroupSheet = () => {
    setGroupSheetOpen(true)
  }

  const handleCreateGroup = async () => {
    try {
      const session = await createGroup(groupTitle.trim() || '临时多人记账')
      setGroupSheetOpen(false)
      setGroupTitle('')
      Taro.navigateTo({ url: `/pages/group/index?id=${session.id}` })
    } catch (error) {
      Taro.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  }


  const handleViewAll = () => {
    Taro.switchTab({ url: '/pages/transactions/index' })
  }

  return (
    <View className={`page record-page ${themeClass}`}>
      <View className='page__content'>
        <View className='page__header'>
          <Text className='page__title'>记账</Text>
          <Text className='page__helper'>几秒钟完成一笔记账。</Text>
        </View>

        <Card className='summary-card'>
          <View className='summary-card__top'>
            <View className='summary-metric'>
              <Text className='summary-metric__label'>本月支出</Text>
              <View className='summary-metric__value'>
                <Text className='summary-metric__currency'>¥</Text>
                <Text className='summary-metric__int'>{expenseParts.intPart}</Text>
                <Text className='summary-metric__dec'>.{expenseParts.decPart}</Text>
              </View>
            </View>
            <View className='summary-metric'>
              <Text className='summary-metric__label'>本月收入</Text>
              <View className='summary-metric__value'>
                <Text className='summary-metric__currency'>¥</Text>
                <Text className='summary-metric__int'>{incomeParts.intPart}</Text>
                <Text className='summary-metric__dec'>.{incomeParts.decPart}</Text>
              </View>
            </View>
          </View>
          <View className='summary-card__progress'>
            <View className='summary-card__progress-bar'>
              <View className='summary-card__progress-fill' style={{ width: `${progressPercent}%` }} />
            </View>
            <Text className='summary-card__progress-text'>预算已用 {progressPercent}%</Text>
          </View>
          <View className='summary-card__divider' />
          <Flex className='summary-card__stats' align='center'>
            {dashboardItems.map((item) => (
              <Flex.Item key={item.key} className='summary-stat'>
                <Text className='summary-stat__label'>{item.label}</Text>
                <View className='summary-stat__value'>
                  <Text className='summary-stat__currency'>¥</Text>
                  <Text className='summary-stat__int'>{item.parts.intPart}</Text>
                  <Text className='summary-stat__dec'>.{item.parts.decPart}</Text>
                </View>
              </Flex.Item>
            ))}
          </Flex>
        </Card>

        <Card className='group-card'>
          <View className='group-card__content'>
            <View className='group-card__text'>
              <Text className='group-card__title'>多人记账</Text>
              <Text className='group-card__hint'>适合旅行、团建、聚餐临时记账</Text>
            </View>
            <View className='group-card__action' hoverClass='press-opacity' onClick={handleOpenGroupSheet}>
              <Text>发起活动</Text>
            </View>
          </View>
        </Card>

        <Card className='quick-card'>
          <View className='quick-stack quick-stack--full'>
            <View
              className='quick-mini quick-mini--expense'
              hoverClass='quick-mini--active press-opacity'
              onClick={() => handleQuickEntry('EXPENSE')}
            >
              <View className='quick-mini__icon quick-mini__icon--expense'>
                <ArrowDown />
              </View>
              <Text className='quick-mini__title'>支出</Text>
            </View>
            <View
              className='quick-mini quick-mini--income'
              hoverClass='quick-mini--active press-opacity'
              onClick={() => handleQuickEntry('INCOME')}
            >
              <View className='quick-mini__icon quick-mini__icon--income'>
                <ArrowUp />
              </View>
              <Text className='quick-mini__title'>收入</Text>
            </View>
          </View>
        </Card>

        <View className='section-head'>
          <Text className='section-head__title'>最近记录</Text>
          <Text className='section-head__action' hoverClass='press-opacity' onClick={handleViewAll}>
            查看全部
          </Text>
        </View>
        <Card className='records-group'>
          {recentTransactions.length === 0 ? (
            <View className='records-empty'>
              <Empty description='暂无记录' />
              <Text className='records-empty__hint'>开始你的第一笔记账</Text>
            </View>
          ) : (
            recordItems.map((item) => {
              const iconClass = categoryColorMap[item.tone] ?? ''
              return (
                <Cell key={item.id} className='record-cell' clickable hoverClass='cell-hover press-opacity'>
                  <View className='record-cell__left'>
                    <View className={`record-cell__icon ${iconClass}`}>{item.icon}</View>
                    <View className='record-cell__meta'>
                      <View className='record-cell__title'>
                        <Text className='record-cell__name'>{item.name}</Text>
                        {item.source === 'group' ? <Text className='record-cell__badge'>多人</Text> : null}
                      </View>
                      <Text className='record-cell__time'>{item.timeText}</Text>
                    </View>
                  </View>
                  <View className={item.amountDisplay.className}>
                    <Text className='record-amount__sign'>{item.amountDisplay.sign}</Text>
                    <Text className='record-amount__currency'>¥</Text>
                    <Text className='record-amount__int'>{item.amountDisplay.intPart}</Text>
                    <Text className='record-amount__dec'>.{item.amountDisplay.decPart}</Text>
                  </View>
                </Cell>
              )
            })
          )}
        </Card>
      </View>
      <SafeArea position='bottom' />
      <Popup
        open={groupSheetOpen}
        onClose={() => setGroupSheetOpen(false)}
        rounded
        placement='bottom'
        className='group-sheet'
      >
        <View className='group-sheet__header'>
          <Text className='group-sheet__title'>发起多人记账</Text>
          <Text className='group-sheet__subtitle'>输入活动主题并分享给好友</Text>
        </View>
        <View className='group-sheet__body'>
          <Text className='group-sheet__label'>活动主题</Text>
          <Input
            className='group-sheet__input'
            value={groupTitle}
            onInput={(event) => setGroupTitle(event.detail.value)}
            placeholder='例如 周末露营 / 团建聚餐'
            placeholderClass='group-sheet__placeholder'
          />
          <PrimaryButton text='一键发起分享' onClick={handleCreateGroup} />
        </View>
        <SafeArea position='bottom' />
      </Popup>
    </View>
  )
}
