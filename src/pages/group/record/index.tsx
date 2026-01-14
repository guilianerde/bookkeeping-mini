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
import { addGroupTransaction, getGroupSessions } from '../../../services/groupService'
import { useThemeClass } from '../../../utils/theme'

const currentUserId = 'self'

export default function GroupRecordPage() {
  const router = useRouter()
  const [session, setSession] = useState<GroupSession | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payerId, setPayerId] = useState(currentUserId)
  const themeClass = useThemeClass()

  useDidShow(() => {
    const sessions = getGroupSessions()
    const current = sessions.find((item) => item.id === router.params?.id) ?? sessions[0]
    if (!current) {
      setSession(null)
      return
    }
    setSession(current)
    setPayerId(currentUserId)
  })

  const memberOptions = useMemo(() => session?.members ?? [], [session])
  const payerIndex = Math.max(memberOptions.findIndex((member) => member.id === payerId), 0)

  const handleSubmit = () => {
    const numericAmount = Number.parseFloat(amount)
    if (!numericAmount || numericAmount <= 0) {
      Taro.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    if (!session) {
      Taro.showToast({ title: '活动不存在', icon: 'none' })
      return
    }
    const participantIds = session.members.map((member) => member.id)

    addGroupTransaction({
      sessionId: session.id,
      amount: numericAmount,
      description: description.trim(),
      payerId,
      participantIds
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
            range={memberOptions.map((member) => member.name)}
            value={payerIndex}
            onChange={(event) => setPayerId(memberOptions[event.detail.value]?.id ?? currentUserId)}
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
