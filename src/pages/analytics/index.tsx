import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import './index.scss'
import type { Transaction } from '../../models/transaction'
import type { Category } from '../../models/category'
import { getTransactions } from '../../services/transactionService'
import { getCategories } from '../../services/categoryService'
import { formatAmount } from '../../utils/format'
import { getCategoryById } from '../../models/types'
import * as echarts from 'echarts'
import { useThemeClass } from '../../utils/theme'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { exportCSV, exportJSON, showExportResult } from '../../utils/export'

export default function AnalyticsPage() {
  const trendChartRef = useRef<echarts.ECharts | null>(null)
  const categoryChartRef = useRef<echarts.ECharts | null>(null)
  const themeClass = useThemeClass()
  const isDark = themeClass === 'theme-dark'
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useDidShow(() => {
    setCategories(getCategories())
    setTransactions(getTransactions())
  })

  const monthKey = (date: Date) => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    return `${year}-${month}`
  }

  const monthLabel = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    return `${year}年${month}月`
  }

  const shiftMonth = (offset: number) => {
    const next = new Date(currentDate)
    next.setMonth(next.getMonth() + offset)
    setCurrentDate(next)
  }

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((item) => map.set(item.id, item))
    return map
  }, [categories])

  const monthTransactions = useMemo(() => {
    const key = monthKey(currentDate)
    return transactions.filter((item) => monthKey(new Date(item.dateISO)) === key)
  }, [transactions, currentDate])

  const incomeTotal = useMemo(
    () => monthTransactions.filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0),
    [monthTransactions]
  )

  const expenseTotal = useMemo(
    () => monthTransactions.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0),
    [monthTransactions]
  )

  const balanceTotal = incomeTotal - expenseTotal

  const trendData = useMemo(() => {
    const points: Array<{ label: string; income: number; expense: number }> = []
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(currentDate)
      date.setMonth(date.getMonth() - offset)
      const key = monthKey(date)
      const monthItems = transactions.filter((item) => monthKey(new Date(item.dateISO)) === key)
      const income = monthItems.filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0)
      const expense = monthItems.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0)
      points.push({ label: `${date.getMonth() + 1}月`, income, expense })
    }
    return points
  }, [transactions, currentDate])

  const topCategories = useMemo(() => {
    const totals = new Map<number, number>()
    monthTransactions
      .filter((item) => item.type === 'EXPENSE')
      .forEach((item) => {
        totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amount)
      })

    return Array.from(totals.entries())
      .map(([categoryId, amount]) => ({
        categoryId,
        amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
  }, [monthTransactions])

  const trendOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params) => {
          if (!params || !params.length) return ''
          const [income, expense] = params
          return `${params[0].axisValue}<br/>收入: ¥${Number(income?.data ?? 0).toFixed(2)}<br/>支出: ¥${Number(expense?.data ?? 0).toFixed(2)}`
        }
      },
      legend: {
        data: ['收入', '支出'],
        bottom: 0,
        textStyle: {
          color: isDark ? '#cbd5f5' : '#475569',
          fontSize: 11
        }
      },
      grid: {
        left: 10,
        right: 20,
        top: 30,
        bottom: 35,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: trendData.map((item) => item.label),
        axisLine: { lineStyle: { color: isDark ? '#1e293b' : '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#f1f5f9' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#94a3b8', fontSize: 10 }
      },
      series: [
        {
          name: '收入',
          type: 'line',
          smooth: true,
          data: trendData.map((item) => item.income),
          symbolSize: 6,
          itemStyle: { color: isDark ? '#34d399' : '#16a34a' },
          lineStyle: { color: isDark ? '#34d399' : '#16a34a' },
          areaStyle: { color: isDark ? 'rgba(52, 211, 153, 0.18)' : 'rgba(22, 163, 74, 0.08)' }
        },
        {
          name: '支出',
          type: 'line',
          smooth: true,
          data: trendData.map((item) => item.expense),
          symbolSize: 6,
          itemStyle: { color: isDark ? '#f87171' : '#dc2626' },
          lineStyle: { color: isDark ? '#f87171' : '#dc2626' },
          areaStyle: { color: isDark ? 'rgba(248, 113, 113, 0.18)' : 'rgba(220, 38, 38, 0.08)' }
        }
      ]
    }
  }, [trendData, isDark])

  const categoryOption = useMemo(() => {
    const colors = topCategories.map((item) => categoryMap.get(item.categoryId)?.color ?? '#e2e8f0')
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: ¥{c} ({d}%)'
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: {
          color: isDark ? '#cbd5f5' : '#475569',
          fontSize: 10
        }
      },
      series: [
        {
          name: '支出分类',
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['50%', '45%'],
          data: topCategories.map((item) => ({
            value: item.amount,
            name: getCategoryById(item.categoryId)?.desc ?? '未分类'
          })),
          label: {
            fontSize: 10,
            color: isDark ? '#e2e8f0' : '#475569'
          },
          color: colors
        }
      ]
    }
  }, [topCategories, categoryMap, isDark])

  const initTrendChart = (canvas, width, height, dpr) => {
    const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
    canvas.setChart(chart)
    chart.setOption(trendOption)
    trendChartRef.current = chart
    return chart
  }

  const initCategoryChart = (canvas, width, height, dpr) => {
    const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
    canvas.setChart(chart)
    chart.setOption(categoryOption)
    categoryChartRef.current = chart
    return chart
  }

  useEffect(() => {
    if (trendChartRef.current) {
      trendChartRef.current.setOption(trendOption)
    }
  }, [trendOption])

  useEffect(() => {
    if (categoryChartRef.current) {
      categoryChartRef.current.setOption(categoryOption)
    }
  }, [categoryOption])

  const handleExport = async () => {
    const monthLabelText = monthLabel(currentDate)
    const baseFileName = `analytics_${monthKey(currentDate).replace('-', '')}`
    const summaryData = {
      month: monthLabelText,
      incomeTotal,
      expenseTotal,
      balanceTotal
    }
    const trendExport = trendData.map((item) => ({
      month: item.label,
      income: item.income,
      expense: item.expense
    }))
    const categoryExport = topCategories.map((item) => ({
      category: getCategoryById(item.categoryId)?.desc ?? '未分类',
      amount: item.amount
    }))

    try {
      const { tapIndex } = await Taro.showActionSheet({ itemList: ['导出 JSON', '导出 CSV'] })
      if (tapIndex === 0) {
        const filePath = exportJSON(`${baseFileName}.json`, {
          summary: summaryData,
          trend: trendExport,
          categories: categoryExport
        })
        await showExportResult(filePath)
      } else if (tapIndex === 1) {
        const csvRows = [
          ['概览'],
          ['月份', summaryData.month],
          ['收入', summaryData.incomeTotal],
          ['支出', summaryData.expenseTotal],
          ['结余', summaryData.balanceTotal],
          [''],
          ['趋势 (近 6 个月)'],
          ['月份', '收入', '支出'],
          ...trendExport.map((item) => [item.month, item.income, item.expense]),
          [''],
          ['支出分类 Top 6'],
          ['分类', '金额'],
          ...categoryExport.map((item) => [item.category, item.amount])
        ]
        const filePath = exportCSV(`${baseFileName}.csv`, csvRows)
        await showExportResult(filePath)
      }
    } catch (error) {
      // 用户取消导出时无需提示
    }
  }

  return (
    <View className={`page ${themeClass}`}>
      <View className="page__header">
        <Text className="page__title">账单分析</Text>
        <Text className="page__subtitle">统计趋势与分类占比</Text>
      </View>

      <View className="month-selector">
        <Text className="month-selector__action" onClick={() => shiftMonth(-1)}>上一月</Text>
        <Text className="month-selector__label">{monthLabel(currentDate)}</Text>
        <Text className="month-selector__action" onClick={() => shiftMonth(1)}>下一月</Text>
      </View>

      <View className="overview">
        <View className="overview__card overview__card--income">
          <Text className="overview__label">收入</Text>
          <Text className="overview__value">{formatAmount(incomeTotal, 'INCOME')}</Text>
        </View>
        <View className="overview__card overview__card--expense">
          <Text className="overview__label">支出</Text>
          <Text className="overview__value">{formatAmount(expenseTotal, 'EXPENSE')}</Text>
        </View>
        <View className="overview__card overview__card--balance">
          <Text className="overview__label">结余</Text>
          <Text className={`overview__value ${balanceTotal >= 0 ? 'overview__value--positive' : 'overview__value--negative'}`}>
            {formatAmount(Math.abs(balanceTotal), balanceTotal >= 0 ? 'INCOME' : 'EXPENSE')}
          </Text>
        </View>
      </View>

      <Card title="近 6 个月趋势" actionText="导出" onAction={handleExport}>
        <View className="chart-wrapper">
          <ec-canvas id="trendChart" canvas-id="trendChart" ec={{ onInit: initTrendChart }} />
        </View>
        <View className="trend-list">
          {trendData.map((item) => (
            <View className="trend-item" key={item.label}>
              <Text className="trend-item__label">{item.label}</Text>
              <View className="trend-item__values">
                <Text className="trend-item__income">{formatAmount(item.income, 'INCOME')}</Text>
                <Text className="trend-item__expense">{formatAmount(item.expense, 'EXPENSE')}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card title="本月支出 Top 6" subtitle="按分类汇总">
        {topCategories.length === 0 ? (
          <EmptyState text="暂无支出记录" />
        ) : (
          <>
            <View className="chart-wrapper chart-wrapper--compact">
              <ec-canvas id="categoryChart" canvas-id="categoryChart" ec={{ onInit: initCategoryChart }} />
            </View>
            <View className="category-list">
              {topCategories.map((item) => {
                const categoryInfo = getCategoryById(item.categoryId)
                const category = categoryMap.get(item.categoryId)
                return (
                  <View className="category-item" key={item.categoryId}>
                    <View className="category-item__left">
                      <Text className="category-item__icon">{categoryInfo?.icon ?? '🧾'}</Text>
                      <Text className="category-item__name">{categoryInfo?.desc ?? '未分类'}</Text>
                    </View>
                    <View className="category-item__right">
                      <Text className="category-item__amount">{formatAmount(item.amount, 'EXPENSE')}</Text>
                      <View className="category-item__dot" style={{ backgroundColor: category?.color ?? '#e2e8f0' }} />
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}
      </Card>
    </View>
  )
}
