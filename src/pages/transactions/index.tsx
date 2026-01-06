import { View, Text, Input, Picker } from '@tarojs/components'
import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Cell, SafeArea } from '@taroify/core'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import type { Transaction } from '../../models/transaction'
import { getTransactions } from '../../services/transactionService'
import { getCategories } from '../../services/categoryService'
import { formatDate, formatTime } from '../../utils/format'
import { getCategoryById } from '../../models/types'
import { useThemeClass } from '../../utils/theme'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { exportCSV, exportJSON, showExportResult } from '../../utils/export'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [monthIndex, setMonthIndex] = useState(0)
  const themeClass = useThemeClass()

  useDidShow(() => {
    getCategories()
    setTransactions(getTransactions())
  })

  const monthOptions = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach((item) => {
      const date = new Date(item.dateISO)
      const month = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
      months.add(month)
    })
    const list = Array.from(months).sort((a, b) => b.localeCompare(a))
    return list.length === 0 ? ['全部月份'] : ['全部月份', ...list]
  }, [transactions])

  const selectedMonth = monthOptions[monthIndex] ?? '全部月份'

  const monthTransactions = useMemo(() => {
    if (selectedMonth === '全部月份') {
      return transactions
    }
    return transactions.filter((item) => {
      const date = new Date(item.dateISO)
      const month = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
      return month === selectedMonth
    })
  }, [transactions, selectedMonth])

  const monthIncomeTotal = useMemo(
    () => monthTransactions.filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0),
    [monthTransactions]
  )

  const monthExpenseTotal = useMemo(
    () => monthTransactions.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0),
    [monthTransactions]
  )

  const monthBalanceTotal = monthIncomeTotal - monthExpenseTotal

  const filtered = useMemo(() => {
    return transactions.filter((item) => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) {
        return false
      }
      if (selectedMonth !== '全部月份') {
        const date = new Date(item.dateISO)
        const month = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
        if (month !== selectedMonth) {
          return false
        }
      }
      if (query.trim()) {
        const text = `${item.description ?? ''}`.toLowerCase()
        const category = getCategoryById(item.categoryId)
        const categoryText = `${category?.desc ?? ''}`.toLowerCase()
        const queryValue = query.trim().toLowerCase()
        return text.includes(queryValue) || categoryText.includes(queryValue)
      }
      return true
    })
  }, [transactions, typeFilter, selectedMonth, query])

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    filtered.forEach((item) => {
      const dateKey = formatDate(item.dateISO)
      const group = groups.get(dateKey) ?? []
      group.push(item)
      groups.set(dateKey, group)
    })
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items }))
  }, [filtered])

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, item) => sum + (item.type === 'INCOME' ? item.amount : -item.amount), 0),
    [filtered]
  )

  const formatCurrencyParts = (value: number) => {
    const [intPart, decPart] = Math.abs(value).toFixed(2).split('.')
    return { intPart, decPart }
  }

  const getAmountParts = (amount: number, type: 'INCOME' | 'EXPENSE') => {
    const sign = type === 'INCOME' ? '+' : '-'
    const [intPart, decPart] = amount.toFixed(2).split('.')
    return { sign, intPart, decPart }
  }

  const incomeParts = formatCurrencyParts(monthIncomeTotal)
  const expenseParts = formatCurrencyParts(monthExpenseTotal)
  const balanceParts = formatCurrencyParts(monthBalanceTotal)
  const filteredParts = formatCurrencyParts(filteredTotal)

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
    food: 'transaction-icon--food',
    shop: 'transaction-icon--shop',
    traffic: 'transaction-icon--traffic',
    fun: 'transaction-icon--fun',
    health: 'transaction-icon--health',
    study: 'transaction-icon--study',
    travel: 'transaction-icon--travel',
    income: 'transaction-icon--income'
  }

  const handleExport = async () => {
    const baseFileName = `transactions_${selectedMonth === '全部月份' ? 'all' : selectedMonth.replace('-', '')}`
    const exportData = filtered.map((item) => {
      const category = getCategoryById(item.categoryId)
      return {
        id: item.id,
        type: item.type,
        amount: item.amount,
        categoryId: item.categoryId,
        category: category?.desc ?? '未分类',
        description: item.description ?? '',
        date: formatDate(item.dateISO),
        time: formatTime(item.dateISO)
      }
    })

    try {
      const { tapIndex } = await Taro.showActionSheet({ itemList: ['导出 JSON', '导出 CSV'] })
      if (tapIndex === 0) {
        const filePath = exportJSON(`${baseFileName}.json`, exportData)
        await showExportResult(filePath)
      } else if (tapIndex === 1) {
        const csvRows = [
          ['日期', '时间', '类型', '分类', '金额', '备注'],
          ...exportData.map((item) => [
            item.date,
            item.time,
            item.type === 'INCOME' ? '收入' : '支出',
            item.category,
            item.amount,
            item.description
          ])
        ]
        const filePath = exportCSV(`${baseFileName}.csv`, csvRows)
        await showExportResult(filePath)
      }
    } catch (error) {
      // 用户取消导出时无需提示
    }
  }

  const handleTypeChange = (next: 'ALL' | 'INCOME' | 'EXPENSE') => {
    setTypeFilter(next)
  }

  const handleMonthChange = (event) => {
    setMonthIndex(event.detail.value)
  }

  const handleClearSearch = () => {
    setQuery('')
    Taro.showToast({ title: '已清空搜索', icon: 'none' })
  }

  return (
    <View className={`page transactions-page ${themeClass}`}>
      <View className="page__content">
        <View className="page__header">
          <Text className="page__title">交易明细</Text>
          <Text className="page__subtitle">筛选与搜索账单</Text>
        </View>

        <Card className="filters-card">
          <View className="filters__row">
            <View className="chip-group">
              <View
                className={`chip ${typeFilter === 'ALL' ? 'chip--active' : ''}`}
                hoverClass="press-opacity"
                onClick={() => handleTypeChange('ALL')}
              >
                <Text>全部</Text>
              </View>
              <View
                className={`chip ${typeFilter === 'EXPENSE' ? 'chip--active' : ''}`}
                hoverClass="press-opacity"
                onClick={() => handleTypeChange('EXPENSE')}
              >
                <Text>支出</Text>
              </View>
              <View
                className={`chip ${typeFilter === 'INCOME' ? 'chip--active' : ''}`}
                hoverClass="press-opacity"
                onClick={() => handleTypeChange('INCOME')}
              >
                <Text>收入</Text>
              </View>
            </View>

            <Picker mode="selector" range={monthOptions} value={monthIndex} onChange={handleMonthChange}>
              <View className="month-picker" hoverClass="press-opacity">
                <Text className="month-picker__label">{selectedMonth}</Text>
                <Text className="month-picker__icon">▾</Text>
              </View>
            </Picker>
          </View>

          <View className="filters__row">
            <Input
              className="search-input"
              value={query}
              onInput={(event) => setQuery(event.detail.value)}
              placeholder="搜索分类或备注"
              placeholderClass="search-input__placeholder"
            />
            <Text className="search-clear" hoverClass="press-opacity" onClick={handleClearSearch}>
              清空
            </Text>
          </View>
        </Card>

        <Card title="月度汇总" subtitle={selectedMonth} className="summary-card" actionText="导出" onAction={handleExport}>
          <View className="summary-grid">
            <View className="summary-item">
              <Text className="summary-item__label">收入</Text>
              <View className="summary-amount summary-amount--income">
                <Text className="summary-amount__currency">¥</Text>
                <Text className="summary-amount__int">{incomeParts.intPart}</Text>
                <Text className="summary-amount__dec">.{incomeParts.decPart}</Text>
              </View>
            </View>
            <View className="summary-item">
              <Text className="summary-item__label">支出</Text>
              <View className="summary-amount summary-amount--expense">
                <Text className="summary-amount__currency">¥</Text>
                <Text className="summary-amount__int">{expenseParts.intPart}</Text>
                <Text className="summary-amount__dec">.{expenseParts.decPart}</Text>
              </View>
            </View>
            <View className="summary-item">
              <Text className="summary-item__label">结余</Text>
              <View
                className={`summary-amount ${monthBalanceTotal >= 0 ? 'summary-amount--income' : 'summary-amount--expense'}`}
              >
                {monthBalanceTotal < 0 ? <Text className="summary-amount__sign">-</Text> : null}
                <Text className="summary-amount__currency">¥</Text>
                <Text className="summary-amount__int">{balanceParts.intPart}</Text>
                <Text className="summary-amount__dec">.{balanceParts.decPart}</Text>
              </View>
            </View>
          </View>
          <View className="summary-footer">
            <Text className="summary-footer__text">筛选后合计</Text>
            <View
              className={`summary-footer__value summary-amount ${filteredTotal >= 0 ? 'summary-footer__value--positive' : 'summary-footer__value--negative'}`}
            >
              {filteredTotal < 0 ? <Text className="summary-amount__sign">-</Text> : null}
              <Text className="summary-amount__currency">¥</Text>
              <Text className="summary-amount__int">{filteredParts.intPart}</Text>
              <Text className="summary-amount__dec">.{filteredParts.decPart}</Text>
            </View>
            <Text className="summary-footer__count">{filtered.length} 笔</Text>
          </View>
        </Card>

        {filtered.length === 0 ? (
          <EmptyState text="暂无记录，调整筛选或去记一笔。" />
        ) : (
          <View className="transaction-list">
            {groupedByDate.map((group) => {
              const dayIncome = group.items
                .filter((item) => item.type === 'INCOME')
                .reduce((sum, item) => sum + item.amount, 0)
              const dayExpense = group.items
                .filter((item) => item.type === 'EXPENSE')
                .reduce((sum, item) => sum + item.amount, 0)
              const dayBalance = dayIncome - dayExpense
              const dayIncomeParts = getAmountParts(dayIncome, 'INCOME')
              const dayExpenseParts = getAmountParts(dayExpense, 'EXPENSE')
              const dayBalanceParts = formatCurrencyParts(dayBalance)
              return (
                <Card className="transaction-group" key={group.date}>
                  <View className="transaction-group__header">
                    <Text className="transaction-group__date">{group.date}</Text>
                    <View className="transaction-group__summary">
                      <View className="transaction-summary transaction-summary--income">
                        <Text className="transaction-summary__sign">{dayIncomeParts.sign}</Text>
                        <Text className="transaction-summary__currency">¥</Text>
                        <Text className="transaction-summary__int">{dayIncomeParts.intPart}</Text>
                        <Text className="transaction-summary__dec">.{dayIncomeParts.decPart}</Text>
                      </View>
                      <View className="transaction-summary transaction-summary--expense">
                        <Text className="transaction-summary__sign">{dayExpenseParts.sign}</Text>
                        <Text className="transaction-summary__currency">¥</Text>
                        <Text className="transaction-summary__int">{dayExpenseParts.intPart}</Text>
                        <Text className="transaction-summary__dec">.{dayExpenseParts.decPart}</Text>
                      </View>
                      <View
                        className={`transaction-summary ${dayBalance >= 0 ? 'transaction-summary--income' : 'transaction-summary--expense'}`}
                      >
                        {dayBalance < 0 ? <Text className="transaction-summary__sign">-</Text> : <Text className="transaction-summary__sign">+</Text>}
                        <Text className="transaction-summary__currency">¥</Text>
                        <Text className="transaction-summary__int">{dayBalanceParts.intPart}</Text>
                        <Text className="transaction-summary__dec">.{dayBalanceParts.decPart}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="transaction-group__list">
                    {group.items.map((item) => {
                      const category = getCategoryById(item.categoryId)
                      const amountParts = getAmountParts(item.amount, item.type)
                      const iconClass = categoryColorMap[getCategoryTone(category?.id)] ?? ''
                      return (
                        <Cell
                          key={item.id}
                          className="transaction-item"
                          clickable
                          hoverClass="press-opacity"
                          activeOpacity={0.7}
                        >
                          <View className="transaction-item__left">
                            <View className={`transaction-item__icon ${iconClass}`}>{category?.icon ?? '🧾'}</View>
                            <View className="transaction-item__meta">
                              <Text className="transaction-item__name">{category?.desc ?? '未分类'}</Text>
                              <Text className="transaction-item__time">{formatTime(item.dateISO)}</Text>
                              {item.description ? (
                                <Text className="transaction-item__desc">{item.description}</Text>
                              ) : null}
                            </View>
                          </View>
                          <View className={`transaction-amount ${item.type === 'INCOME' ? 'transaction-amount--income' : 'transaction-amount--expense'}`}>
                            <Text className="transaction-amount__sign">{amountParts.sign}</Text>
                            <Text className="transaction-amount__currency">¥</Text>
                            <Text className="transaction-amount__int">{amountParts.intPart}</Text>
                            <Text className="transaction-amount__dec">.{amountParts.decPart}</Text>
                          </View>
                        </Cell>
                      )
                    })}
                  </View>
                </Card>
              )
            })}
          </View>
        )}
      </View>
      <SafeArea position="bottom" />
    </View>
  )
}
