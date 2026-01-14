import { Button, Canvas, View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { Cell, SafeArea } from '@taroify/core'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import Card from '../../components/ui/Card'
import PrimaryButton from '../../components/ui/PrimaryButton'
import type { GroupSession, GroupTransaction, GroupMember } from '../../models/group'
import { getGroupSessions, getGroupTransactionsBySession } from '../../services/groupService'
import { formatDate, formatTime } from '../../utils/format'
import { useThemeClass } from '../../utils/theme'
import { ensureLoginOrRedirect } from '../../services/authService'

const currentUserId = 'self'

type SettlementItem = {
  from: GroupMember
  to: GroupMember
  amount: number
}

const buildMemberMap = (members: GroupMember[]) => new Map(members.map((member) => [member.id, member]))

const calculateNetBalances = (members: GroupMember[], transactions: GroupTransaction[]) => {
  const balances = new Map<string, number>()
  members.forEach((member) => balances.set(member.id, 0))

  transactions.forEach((item) => {
    const share = item.amount / Math.max(item.participantIds.length, 1)
    balances.set(item.payerId, (balances.get(item.payerId) ?? 0) + item.amount)
    item.participantIds.forEach((participantId) => {
      balances.set(participantId, (balances.get(participantId) ?? 0) - share)
    })
  })

  return balances
}

const settleBalances = (members: GroupMember[], transactions: GroupTransaction[]) => {
  const balances = calculateNetBalances(members, transactions)
  const creditors: Array<{ id: string; amount: number }> = []
  const debtors: Array<{ id: string; amount: number }> = []

  balances.forEach((amount, id) => {
    if (amount > 0.01) {
      creditors.push({ id, amount })
    } else if (amount < -0.01) {
      debtors.push({ id, amount: Math.abs(amount) })
    }
  })

  const settlements: Array<{ from: string; to: string; amount: number }> = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amount, creditor.amount)
    settlements.push({ from: debtor.id, to: creditor.id, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount <= 0.01) i += 1
    if (creditor.amount <= 0.01) j += 1
  }

  return settlements
}

export default function GroupPage() {
  const router = useRouter()
  const [session, setSession] = useState<GroupSession | null>(null)
  const [transactions, setTransactions] = useState<GroupTransaction[]>([])
  const [settlements, setSettlements] = useState<SettlementItem[]>([])
  const [posterSize, setPosterSize] = useState({ width: 1, height: 1 })
  const themeClass = useThemeClass()

  useDidShow(() => {
    if (!ensureLoginOrRedirect()) return
    Taro.showShareMenu({ withShareTicket: true })
    const sessions = getGroupSessions()
    const current = sessions.find((item) => item.id === router.params?.id) ?? sessions[0]
    if (!current) {
      setSession(null)
      setTransactions([])
      setSettlements([])
      return
    }
    setSession(current)
    setTransactions(getGroupTransactionsBySession(current.id))
    setSettlements([])
  })

  const memberMap = useMemo(() => buildMemberMap(session?.members ?? []), [session])

  const totalExpense = useMemo(
    () => transactions.reduce((sum, item) => sum + item.amount, 0),
    [transactions]
  )

  const netBalances = useMemo(() => {
    if (!session) return new Map()
    return calculateNetBalances(session.members, transactions)
  }, [session, transactions])

  const currentNet = netBalances.get(currentUserId) ?? 0
  const netLabel = currentNet >= 0 ? '待收' : '待付'

  const handleNewRecord = () => {
    if (!session) return
    Taro.navigateTo({ url: `/pages/group/record/index?id=${session.id}` })
  }

  const handleSettle = () => {
    if (!session) return
    const result = settleBalances(session.members, transactions)
    const items = result.map((item) => ({
      from: memberMap.get(item.from) ?? { id: item.from, name: item.from },
      to: memberMap.get(item.to) ?? { id: item.to, name: item.to },
      amount: item.amount
    }))
    setSettlements(items)
  }

  const settlementHint = settlements.length ? `最少 ${settlements.length} 笔转账即可结清` : '点击完成计算最少转账次数'

  useShareAppMessage(() => {
    const roomId = session?.id ?? ''
    const title = session?.title ?? '多人记账'
    return {
      title: `${title}｜多人记账`,
      path: `/pages/group/index?id=${roomId}`
    }
  })

  const buildSettlementText = () => {
    const title = session?.title ?? '多人记账'
    const lines = settlements.map(
      (item) => `${item.from.name} → ${item.to.name} ¥${item.amount.toFixed(2)}`
    )
    return [
      `【${title}】结算清单`,
      `总支出 ¥${totalExpense.toFixed(2)}`,
      ...lines,
      '请在群内完成转账后确认'
    ].join('\n')
  }

  const handleCopySettlement = async () => {
    if (!settlements.length) {
      Taro.showToast({ title: '暂无结算信息', icon: 'none' })
      return
    }
    try {
      await Taro.setClipboardData({ data: buildSettlementText() })
      Taro.showToast({ title: '已复制收款信息', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  const handleReturnToGroup = async () => {
    try {
      if (typeof Taro.exitMiniProgram === 'function') {
        await Taro.exitMiniProgram()
        return
      }
    } catch (error) {
      // fallback below
    }
    try {
      await Taro.navigateBack({ delta: 1 })
    } catch (error) {
      Taro.showToast({ title: '请手动返回群聊', icon: 'none' })
    }
  }

  const handleGeneratePoster = async () => {
    if (!settlements.length) {
      Taro.showToast({ title: '暂无结算信息', icon: 'none' })
      return
    }

    const systemInfo = Taro.getSystemInfoSync()
    const width = Math.floor(systemInfo.windowWidth * 0.86)
    const padding = 24
    const lineHeight = 36
    const headerHeight = 86
    const lines = settlements.map(
      (item) => `${item.from.name} → ${item.to.name} ¥${item.amount.toFixed(2)}`
    )
    const height = padding * 2 + headerHeight + lines.length * lineHeight + 48

    setPosterSize({ width, height })
    await Taro.nextTick()

    const ctx = Taro.createCanvasContext('settlementPoster')
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, width, height)
    ctx.setFillStyle('#1c1c1e')
    ctx.setFontSize(18)
    ctx.fillText('结算单', padding, padding + 18)
    ctx.setFillStyle('#63666a')
    ctx.setFontSize(14)
    ctx.fillText(session?.title ?? '多人记账', padding, padding + 44)
    ctx.setFillStyle('#1c1c1e')
    ctx.setFontSize(14)
    ctx.fillText(`总支出 ¥${totalExpense.toFixed(2)}`, padding, padding + 68)

    let y = padding + headerHeight
    ctx.setFillStyle('#323233')
    ctx.setFontSize(14)
    lines.forEach((line) => {
      ctx.fillText(line, padding, y)
      y += lineHeight
    })

    ctx.setFillStyle('#969799')
    ctx.setFontSize(12)
    ctx.fillText('请在群内完成转账后确认', padding, height - padding)

    ctx.draw(false, () => {
      Taro.canvasToTempFilePath({
        canvasId: 'settlementPoster',
        width,
        height,
        destWidth: width,
        destHeight: height,
        success: (res) => {
          Taro.previewImage({ urls: [res.tempFilePath] })
        },
        fail: () => {
          Taro.showToast({ title: '生成失败', icon: 'none' })
        }
      })
    })
  }

  return (
    <View className={`page group-page ${themeClass}`}>
      <View className='page__content'>
        <View className='page__header'>
          <Text className='page__title'>{session?.title ?? '多人记账'}</Text>
          <Text className='page__subtitle'>临时活动 | 成员协作记账</Text>
        </View>

        <Card className='group-overview'>
          <View className='group-overview__row'>
            <View className='overview-item'>
              <Text className='overview-item__label'>活动总支出</Text>
              <View className='overview-amount overview-amount--primary'>
                <Text className='overview-amount__currency'>¥</Text>
                <Text className='overview-amount__int'>{totalExpense.toFixed(0)}</Text>
                <Text className='overview-amount__dec'>.{totalExpense.toFixed(2).split('.')[1]}</Text>
              </View>
            </View>
            <View className='overview-divider' />
            <View className='overview-item'>
              <Text className='overview-item__label'>我的净额</Text>
              <View className={`overview-amount ${currentNet >= 0 ? 'overview-amount--receive' : 'overview-amount--pay'}`}>
                <Text className='overview-amount__tag'>{netLabel}</Text>
                <Text className='overview-amount__currency'>¥</Text>
                <Text className='overview-amount__int'>{Math.abs(currentNet).toFixed(0)}</Text>
                <Text className='overview-amount__dec'>.{Math.abs(currentNet).toFixed(2).split('.')[1]}</Text>
              </View>
            </View>
          </View>
          <View className='member-strip'>
            <Text className='member-strip__label'>成员</Text>
            <View className='member-strip__avatars'>
              {(session?.members ?? []).map((member) => (
                <View className={`member-avatar ${member.isSelf ? 'member-avatar--self' : ''}`} key={member.id}>
                  <Text>{member.name.slice(0, 1)}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        <Card className='group-actions'>
          <View className='group-actions__row'>
            <Button className='group-share' openType='share'>
              分享至群聊
            </Button>
          </View>
          <View className='group-actions__row'>
            <PrimaryButton text='记一笔' onClick={handleNewRecord} />
          </View>
          <View className='group-actions__row'>
            <View className='settle-card'>
              <View className='settle-card__text'>
                <Text className='settle-card__title'>一键结算</Text>
                <Text className='settle-card__hint'>{settlementHint}</Text>
              </View>
              <View className='settle-card__action' hoverClass='press-opacity' onClick={handleSettle}>
                <Text>点击完成</Text>
              </View>
            </View>
          </View>
        </Card>

        <Card title='多人流水' subtitle='不影响个人预算' className='group-list'>
          {transactions.length === 0 ? (
            <View className='group-empty'>
              <Text className='group-empty__text'>暂无记账，开始添加第一笔。</Text>
            </View>
          ) : (
            <View className='group-transactions'>
              {transactions.map((item) => (
                <Cell key={item.id} className='group-transaction' clickable activeOpacity={0.7}>
                  <View className='group-transaction__left'>
                    <View className='group-transaction__icon'>👥</View>
                    <View className='group-transaction__meta'>
                      <Text className='group-transaction__name'>{item.description || '多人记账'}</Text>
                      <Text className='group-transaction__time'>
                        {formatDate(item.dateISO)} {formatTime(item.dateISO)}
                      </Text>
                      <Text className='group-transaction__payer'>付款人：{memberMap.get(item.payerId)?.name ?? '成员'}</Text>
                    </View>
                  </View>
                  <View className='group-transaction__amount'>
                    <Text className='group-transaction__currency'>¥</Text>
                    <Text className='group-transaction__int'>{item.amount.toFixed(0)}</Text>
                    <Text className='group-transaction__dec'>.{item.amount.toFixed(2).split('.')[1]}</Text>
                  </View>
                </Cell>
              ))}
            </View>
          )}
        </Card>

        {settlements.length ? (
          <Card title='结算路径' subtitle='建议最少转账次数' className='settlement-card'>
            <View className='settlement-list'>
              {settlements.map((item, index) => (
                <View className='settlement-item' key={`${item.from.id}-${item.to.id}-${index}`}>
                  <Text className='settlement-item__from'>{item.from.name}</Text>
                  <Text className='settlement-item__arrow'>→</Text>
                  <Text className='settlement-item__to'>{item.to.name}</Text>
                  <View className='settlement-item__amount'>
                    <Text className='settlement-item__currency'>¥</Text>
                    <Text className='settlement-item__int'>{item.amount.toFixed(2)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View className='settlement-footer'>
              <Text className='settlement-footer__hint'>复制收款信息后可直接在群聊粘贴</Text>
              <View className='settlement-footer__actions'>
                <View className='settlement-footer__action' hoverClass='press-opacity' onClick={handleCopySettlement}>
                  <Text>复制收款信息</Text>
                </View>
                <View
                  className='settlement-footer__action settlement-footer__action--ghost'
                  hoverClass='press-opacity'
                  onClick={handleReturnToGroup}
                >
                  <Text>返回群聊</Text>
                </View>
                <View
                  className='settlement-footer__action settlement-footer__action--ghost'
                  hoverClass='press-opacity'
                  onClick={handleGeneratePoster}
                >
                  <Text>生成长图</Text>
                </View>
              </View>
            </View>
          </Card>
        ) : null}
      </View>
      <SafeArea position='bottom' />
      <Canvas
        canvasId='settlementPoster'
        id='settlementPoster'
        className='settlement-poster'
        style={{ width: `${posterSize.width}px`, height: `${posterSize.height}px` }}
      />
    </View>
  )
}
