import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { SafeArea } from '@taroify/core'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import Card from '../../../components/ui/Card'
import PrimaryButton from '../../../components/ui/PrimaryButton'
import type { GroupSession } from '../../../models/group'
import { addLocalExpense, getJoinedGroupById, joinGroup } from '../../../services/groupService'
import { sendGroupExpense } from '../../../services/groupWs'
import { useThemeClass } from '../../../utils/theme'
import { getAuthUserId } from '../../../services/authService'

export default function GroupRecordPage() {
  const router = useRouter()
  const [session, setSession] = useState<GroupSession | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payerId, setPayerId] = useState<number | null>(null)
  const themeClass = useThemeClass()
  const currentUserId = getAuthUserId()

  useDidShow(() => {
    const load = async () => {
      const groupId = Number(router.params?.id)
      let current = getJoinedGroupById(groupId)
      if (!current && groupId) {
        try {
          current = await joinGroup(groupId)
        } catch (error) {
          Taro.showToast({ title: '请先登录', icon: 'none' })
          return
        }
      }
      if (!current) {
        setSession(null)
        return
      }
      setSession(current)
      const selfId = currentUserId ?? 0
      setPayerId(selfId)
    }
    void load()
  })

  const memberOptions = useMemo(() => {
    if (currentUserId !== undefined) {
      return [{ id: currentUserId, name: '我' }]
    }
    return []
  }, [currentUserId])

  const payerIndex = Math.max(memberOptions.findIndex((member) => member.id === payerId), 0)
  const payerRange = memberOptions.length ? memberOptions.map((member) => member.name) : ['我']

  const handleSubmit = async () => {
    const numericAmount = Number.parseFloat(amount)
    if (!numericAmount || numericAmount <= 0) {
      Taro.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    if (!session) {
      Taro.showToast({ title: '活动不存在', icon: 'none' })
      return
    }

    const remark = description.trim()

    try {
      await sendGroupExpense(session.id, {
        type: 'expense',
        amount: numericAmount,
        title: description.trim() || '多人记账',
        remark
      })
    } catch (error) {
      console.log(error)
      Taro.showToast({ title: '连接未建立，请稍后重试', icon: 'none' })
      return
    }

    addLocalExpense(session.id, {
      amount: numericAmount,
      title: description.trim() || '多人记账',
      remark,
      userId: payerId ?? undefined
    })

    Taro.showToast({ title: '已记录', icon: 'success' })

    setAmount('')
    setDescription('')
    Taro.navigateBack()
  }

  return (
    <View className={`page group-record-page ${themeClass}`}>
      <View className='page__content'>
        <View className='page__header'>
          <Text className='page__title'>多人记一笔</Text>
          <Text className='page__subtitle'>{session?.title ?? '临时活动'}</Text>
        </View>

        <Card>
          <Text className='field__label'>金额</Text>
          <Input
            className='amount-input'
            type='digit'
            value={amount}
            onInput={(event) => setAmount(event.detail.value)}
            placeholder='0.00'
            placeholderClass='amount-input__placeholder'
          />

          <Text className='field__label'>备注</Text>
          <Input
            className='field__input'
            value={description}
            onInput={(event) => setDescription(event.detail.value)}
            placeholder='例如：餐饮 / 车费'
            placeholderClass='field__placeholder'
          />
        </Card>

        <Card title='付款人' subtitle='默认自己'>
          <Picker
            mode='selector'
            range={payerRange}
            value={payerIndex}
            onChange={(event) => setPayerId(memberOptions[event.detail.value]?.id ?? currentUserId ?? null)}
          >
            <View className='picker-field' hoverClass='press-opacity'>
              <Text className='picker-field__text'>{memberOptions[payerIndex]?.name ?? '选择付款人'}</Text>
              <Text className='picker-field__icon'>▾</Text>
            </View>
          </Picker>
        </Card>

        <PrimaryButton text='保存' onClick={handleSubmit} />
      </View>
      <SafeArea position='bottom' />
    </View>
  )
}
