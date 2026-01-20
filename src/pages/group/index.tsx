import { Button, Canvas, View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { Cell, SafeArea } from '@taroify/core'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import Card from '../../components/ui/Card'
import PrimaryButton from '../../components/ui/PrimaryButton'
import type { GroupExpense, GroupSession, GroupSettlement } from '../../models/group'
import {
  fetchSettlement,
  getGroupExpenses,
  getJoinedGroups,
  joinGroup,
  saveGroupExpense
} from '../../services/groupService'
import { onGroupMessage } from '../../services/groupWs'
import { formatDate, formatTime } from '../../utils/format'
import { useThemeClass } from '../../utils/theme'
import { ensureLoginOrRedirect, getAuthUserId } from '../../services/authService'

export default function GroupPage() {
  const router = useRouter()
  const [session, setSession] = useState<GroupSession | null>(null)
  const [expenses, setExpenses] = useState<GroupExpense[]>([])
  const [settlement, setSettlement] = useState<GroupSettlement | null>(null)
  const [posterSize, setPosterSize] = useState({ width: 1, height: 1 })
  const themeClass = useThemeClass()

  useDidShow(() => {
    if (!ensureLoginOrRedirect()) return
    const load = async () => {
      const paramId = Number(router.params?.id)
      let current: GroupSession | undefined
      try {
        if (paramId) {
          current = await joinGroup(paramId)
        } else {
          const first = getJoinedGroups()[0]
          current = first ? await joinGroup(first.id) : undefined
        }
      } catch (error) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      if (!current) {
        setSession(null)
        setExpenses([])
        setSettlement(null)
        return
      }

      setSession(current)
      setExpenses(getGroupExpenses(current.id))
      try {
        const data = await fetchSettlement(current.id)
        setSettlement(data)
      } catch (error) {
        // ignore settlement fetch errors on initial load
      }
    }

    void load()
  })

  useEffect(() => {
    if (!session) return
    const unsubscribe = onGroupMessage(session.id, (payload) => {
      if (!payload) return
      if (payload.type === 'settlement' && payload.settlement) {
        setSettlement(payload.settlement)
        return
      }
      if (payload.type === 'expense') {
        const expense: GroupExpense = {
          id: payload.id || `ws_${Date.now()}`,
          groupId: session.id,
          amount: Number(payload.amount ?? 0),
          title: payload.title,
          remark: payload.remark,
          userId: payload.userId,
          dateISO: payload.dateISO ?? new Date().toISOString()
        }
        saveGroupExpense(expense)
        setExpenses((prev) => [expense, ...prev.filter((item) => item.id !== expense.id)])
      }
    })

    return () => unsubscribe()
  }, [session])

  const currentUserId = getAuthUserId()

  const totalExpense = useMemo(() => {
    if (settlement) {
      return settlement.balances.reduce((sum, item) => sum + (item.totalPaid ?? 0), 0)
    }
    return expenses.reduce((sum, item) => sum + item.amount, 0)
  }, [settlement, expenses])

  const currentNet = useMemo(() => {
    if (!settlement || currentUserId === undefined) return 0
    return settlement.balances.find((item) => item.userId === currentUserId)?.netAmount ?? 0
  }, [settlement, currentUserId])

  const netLabel = currentNet >= 0 ? '待收' : '待付'

  const memberList = useMemo(() => {
    if (settlement?.balances?.length) {
      return settlement.balances.map((item) => ({
        id: item.userId,
        name: item.userId === currentUserId ? '我' : `用户${item.userId}`
      }))
    }
    if (currentUserId !== undefined) {
      return [{ id: currentUserId, name: '我' }]
    }
    return []
  }, [settlement, currentUserId])

  const transfers = settlement?.transfers ?? []

  const settlementHint = transfers.length
    ? `已自动计算，最少 ${transfers.length} 笔转账即可结清`
    : '当前无需结算'

  useShareAppMessage(() => {
    const roomId = session?.id ?? ''
    const title = session?.title ?? '多人记账'
    return {
      title: `${title}｜多人记账`,
      path: `/pages/group/index?id=${roomId}`
    }
  })

  const handleNewRecord = () => {
    if (!session) return
    Taro.navigateTo({ url: `/pages/group/record/index?id=${session.id}` })
  }

  const buildSettlementText = () => {
    const title = session?.title ?? '多人记账'
    const lines = transfers.map(
      (item) => `${item.fromUserId} → ${item.toUserId} ¥${item.amount.toFixed(2)}`
    )
    return [
      `【${title}】结算清单`,
      `总支出 ¥${totalExpense.toFixed(2)}`,
      ...lines,
      '请在群内完成转账后确认'
    ].join('\n')
  }

  const handleCopySettlement = async () => {
    if (!transfers.length) {
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
    if (!transfers.length) {
      Taro.showToast({ title: '暂无结算信息', icon: 'none' })
      return
    }

    const systemInfo = Taro.getSystemInfoSync()
    const width = Math.floor(systemInfo.windowWidth * 0.86)
    const padding = 24
    const lineHeight = 36
    const headerHeight = 86
    const lines = transfers.map(
      (item) => `${item.fromUserId} → ${item.toUserId} ¥${item.amount.toFixed(2)}`
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
              {memberList.map((member) => (
                <View className={`member-avatar ${member.name === '我' ? 'member-avatar--self' : ''}`} key={member.id}>
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
              <View className='settle-card__action' hoverClass='press-opacity' onClick={handleGeneratePoster}>
                <Text>生成长图</Text>
              </View>
            </View>
          </View>
        </Card>

        <Card title='多人流水' subtitle='不影响个人预算' className='group-list'>
          {expenses.length === 0 ? (
            <View className='group-empty'>
              <Text className='group-empty__text'>暂无记账，开始添加第一笔。</Text>
            </View>
          ) : (
            <View className='group-transactions'>
              {expenses.map((item) => (
                <Cell key={item.id} className='group-transaction' clickable activeOpacity={0.7}>
                  <View className='group-transaction__left'>
                    <View className='group-transaction__icon'>👥</View>
                    <View className='group-transaction__meta'>
                      <Text className='group-transaction__name'>{item.title || item.remark || '多人记账'}</Text>
                      <Text className='group-transaction__time'>
                        {formatDate(item.dateISO)} {formatTime(item.dateISO)}
                      </Text>
                      {item.userId ? (
                        <Text className='group-transaction__payer'>付款人：用户{item.userId}</Text>
                      ) : null}
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

        {transfers.length ? (
          <Card title='结算路径' subtitle='建议最少转账次数' className='settlement-card'>
            <View className='settlement-list'>
              {transfers.map((item, index) => (
                <View className='settlement-item' key={`${item.fromUserId}-${item.toUserId}-${index}`}>
                  <Text className='settlement-item__from'>用户{item.fromUserId}</Text>
                  <Text className='settlement-item__arrow'>→</Text>
                  <Text className='settlement-item__to'>用户{item.toUserId}</Text>
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
