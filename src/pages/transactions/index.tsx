import { View, Text, Input, Picker } from '@tarojs/components'
import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import './index.scss'
import type { Transaction } from '../../models/transaction'
import { getTransactions } from '../../services/transactionService'
import { getCategories } from '../../services/categoryService'
import { formatAmount, formatDate, formatTime } from '../../utils/format'
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
    <View className={`page ${themeClass}`}>
      <View className="page__header">
        <Text className="page__title">交易明细</Text>
        <Text className="page__subtitle">筛选与搜索账单</Text>
      </View>

      <Card className="filters-card">
        <View className="filters__row">
          <View className="chip-group">
            <Text className={`chip ${typeFilter === 'ALL' ? 'chip--active' : ''}`} onClick={() => handleTypeChange('ALL')}>
              全部
            </Text>
            <Text className={`chip ${typeFilter === 'EXPENSE' ? 'chip--active' : ''}`} onClick={() => handleTypeChange('EXPENSE')}>
              支出
            </Text>
            <Text className={`chip ${typeFilter === 'INCOME' ? 'chip--active' : ''}`} onClick={() => handleTypeChange('INCOME')}>
              收入
            </Text>
          </View>

          <Picker mode="selector" range={monthOptions} value={monthIndex} onChange={handleMonthChange}>
            <View className="month-picker">
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
          <Text className="search-clear" onClick={handleClearSearch}>清空</Text>
        </View>
      </Card>

      <Card title="月度汇总" subtitle={selectedMonth} className="summary-card" actionText="导出" onAction={handleExport}>
        <View className="summary-grid">
          <View className="summary-item summary-item--income">
            <Text className="summary-item__label">收入</Text>
            <Text className="summary-item__value">{formatAmount(monthIncomeTotal, 'INCOME')}</Text>
          </View>
          <View className="summary-item summary-item--expense">
            <Text className="summary-item__label">支出</Text>
            <Text className="summary-item__value">{formatAmount(monthExpenseTotal, 'EXPENSE')}</Text>
          </View>
          <View className="summary-item summary-item--balance">
            <Text className="summary-item__label">结余</Text>
            <Text
              className={`summary-item__value ${monthBalanceTotal >= 0 ? 'summary-item__value--positive' : 'summary-item__value--negative'}`}
            >
              {formatAmount(Math.abs(monthBalanceTotal), monthBalanceTotal >= 0 ? 'INCOME' : 'EXPENSE')}
            </Text>
          </View>
        </View>
        <View className="summary-footer">
          <Text className="summary-footer__text">筛选后合计</Text>
          <Text className={`summary-footer__value ${filteredTotal >= 0 ? 'summary-footer__value--positive' : 'summary-footer__value--negative'}`}>
            {formatAmount(Math.abs(filteredTotal), filteredTotal >= 0 ? 'INCOME' : 'EXPENSE')}
          </Text>
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
            return (
              <View className="transaction-group" key={group.date}>
                <View className="transaction-group__header">
                  <Text className="transaction-group__date">{group.date}</Text>
                  <View className="transaction-group__summary">
                    <Text className="transaction-group__summary-item summary-income">
                      +{formatAmount(dayIncome, 'INCOME')}
                    </Text>
                    <Text className="transaction-group__summary-item summary-expense">
                      {formatAmount(dayExpense, 'EXPENSE')}
                    </Text>
                    <Text
                      className={`transaction-group__summary-item ${dayBalance >= 0 ? 'summary-positive' : 'summary-negative'}`}
                    >
                      {formatAmount(Math.abs(dayBalance), dayBalance >= 0 ? 'INCOME' : 'EXPENSE')}
                    </Text>
                  </View>
                </View>
                {group.items.map((item) => {
                  const category = getCategoryById(item.categoryId)
                  const amountClass = item.type === 'INCOME' ? 'amount amount--income' : 'amount amount--expense'
                  return (
                    <View className="transaction-item" key={item.id}>
                      <View className="transaction-item__left">
                        <Text className="transaction-item__icon">{category?.icon ?? '🧾'}</Text>
                        <View className="transaction-item__meta">
                          <Text className="transaction-item__name">{category?.desc ?? '未分类'}</Text>
                          <Text className="transaction-item__time">{formatTime(item.dateISO)}</Text>
                          {item.description ? (
                            <Text className="transaction-item__desc">{item.description}</Text>
                          ) : null}
                        </View>
                      </View>
                      <Text className={amountClass}>{formatAmount(item.amount, item.type)}</Text>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
