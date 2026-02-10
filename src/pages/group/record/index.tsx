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
import { addLocalExpense, ensureGroupSession, getJoinedGroupById, getGroupMembers } from '../../../services/groupService'
import { sendGroupExpense } from '../../../services/groupWs'
import { useThemeClass } from '../../../utils/theme'
import { getAuthUserId } from '../../../services/authService'

export default function GroupRecordPage() {
  const router = useRouter()
  const groupId = Number(router.params?.id)
  const [session, setSession] = useState<GroupSession | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payerId, setPayerId] = useState<number | null>(null)
  const themeClass = useThemeClass()
  const currentUserId = getAuthUserId()

  useDidShow(() => {
    const load = async () => {
      let current = getJoinedGroupById(groupId)
      if (groupId) {
        try {
          // 仅在 wsPath 缺失或连接断开时重新 join
          current = await ensureGroupSession(groupId)
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
    console.log("currentSession------")
    let currentSession = session
    if (!currentSession && groupId) {
      try {
        currentSession = await ensureGroupSession(groupId)
        console.log("currentSession", JSON.stringify(currentSession))
        setSession(currentSession)
      } catch (error) {
        Taro.showToast({ title: '请先加入活动', icon: 'none' })
        return
      }
    }
    if (!currentSession) {
      Taro.showToast({ title: '活动不存在', icon: 'none' })
      return
    }

    const remark = description.trim()
    const selfMember = getGroupMembers(currentSession.id).find((member) => member.userId === currentUserId)
    const selfName = selfMember?.nickName
    const selfAvatar = selfMember?.avatarUrl

    try {
      await sendGroupExpense(
        currentSession.id,
        {
          type: 'expense',
          amount: numericAmount,
          title: description.trim() || '多人记账',
          remark,
          userId: payerId ?? currentUserId ?? undefined,
          nickName: selfName,
          avatarUrl: selfAvatar
        },
        currentSession.wsPath
      )
    } catch (error) {
      console.log(error)
      Taro.showToast({ title: '连接未建立，请稍后重试', icon: 'none' })
      return
    }

    addLocalExpense(currentSession.id, {
      amount: numericAmount,
      title: description.trim() || '多人记账',
      remark,
      userId: payerId ?? currentUserId ?? undefined,
      userName: selfName,
      userAvatar: selfAvatar
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
