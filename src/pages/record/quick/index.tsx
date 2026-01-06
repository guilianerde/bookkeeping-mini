import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { SafeArea } from '@taroify/core'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import type { TransactionType } from '../../../models/types'
import { getExpenseCategories, getIncomeCategories } from '../../../models/types'
import { addTransaction } from '../../../services/transactionService'
import { useThemeClass } from '../../../utils/theme'
import Card from '../../../components/ui/Card'
import PrimaryButton from '../../../components/ui/PrimaryButton'

const typeLabelMap: Record<TransactionType, string> = {
  INCOME: '收入',
  EXPENSE: '支出'
}

export default function QuickRecordPage() {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const themeClass = useThemeClass()

  useDidShow(() => {
    const nextType = router.params?.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
    setType(nextType)
    setCategoryId(null)
  })

  const categories = useMemo(() => {
    return type === 'INCOME' ? getIncomeCategories() : getExpenseCategories()
  }, [type])

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

  const categoryColorMap: Record<string, string> = {
    food: 'category-chip__icon--food',
    shop: 'category-chip__icon--shop',
    traffic: 'category-chip__icon--traffic',
    fun: 'category-chip__icon--fun',
    health: 'category-chip__icon--health',
    study: 'category-chip__icon--study',
    travel: 'category-chip__icon--travel',
    income: 'category-chip__icon--income'
  }

  const getCategoryTone = (categoryId?: number) => categoryToneMap[categoryId ?? -1] ?? 'default'

  const handleSubmit = () => {
    const numericAmount = Number.parseFloat(amount)
    if (!numericAmount || numericAmount <= 0) {
      Taro.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    if (!categoryId) {
      Taro.showToast({ title: '请选择分类', icon: 'none' })
      return
    }

    addTransaction({
      type,
      amount: numericAmount,
      categoryId,
      description: description.trim() || undefined
    })

    Taro.showToast({ title: '已保存', icon: 'success' })
    setAmount('')
    setDescription('')
    setCategoryId(null)

    setTimeout(() => {
      Taro.navigateBack()
    }, 400)
  }

  return (
    <View className={`page quick-record-page ${themeClass}`}>
      <View className="page__content">
        <View className="page__header">
          <Text className="page__title">新增{typeLabelMap[type]}</Text>
          <Text className="page__subtitle">选择分类并输入金额</Text>
        </View>

        <Card>
          <Text className="field__label">金额</Text>
          <Input
            className="field__input"
            type="digit"
            value={amount}
            onInput={(event) => setAmount(event.detail.value)}
            placeholder="例如 88.50"
            placeholderClass="field__placeholder"
          />

          <Text className="field__label">备注</Text>
          <Input
            className="field__input"
            value={description}
            onInput={(event) => setDescription(event.detail.value)}
            placeholder="可选，例如 午餐"
            placeholderClass="field__placeholder"
          />
        </Card>

        <Card title="选择分类" subtitle={`${typeLabelMap[type]}分类`}>
          <View className="category-grid">
            {categories.map((item) => {
              const toneClass = categoryColorMap[getCategoryTone(item.id)] ?? ''
              return (
                <View
                  key={item.id}
                  className={`category-chip ${categoryId === item.id ? 'category-chip--active' : ''}`}
                  hoverClass="press-opacity"
                  onClick={() => setCategoryId(item.id)}
                >
                  <View className={`category-chip__icon ${toneClass}`}>{item.icon}</View>
                  <Text className="category-chip__text">{item.desc}</Text>
                </View>
              )
            })}
          </View>
        </Card>

        <PrimaryButton text="保存" onClick={handleSubmit} />
      </View>
      <SafeArea position="bottom" />
    </View>
  )
}
