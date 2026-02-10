import { Button, Canvas, Image, ScrollView, View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { Cell, SafeArea } from '@taroify/core'
import '@taroify/core/index.scss'
import '@taroify/core/safe-area/style'
import './index.scss'
import Card from '../../components/ui/Card'
import PrimaryButton from '../../components/ui/PrimaryButton'
import MemberItem from '../../components/ui/MemberItem'
import type { GroupExpense, GroupFinal, GroupMember, GroupSession, GroupSettlement } from '../../models/group'
import {
  ensureGroupSession,
  fetchGroupFinal,
  fetchSettlement,
  getGroupExpenses,
  getGroupMembers,
  getJoinedGroups,
  saveGroupExpense,
  upsertGroupMember,
  kickGroupMember,
  leaveGroup,
  fetchGroupMembers
} from '../../services/groupService'
import { onGroupMessage, handleMemberChangeMessage } from '../../services/groupWs'
import { clearGroupCache, removeMemberFromCache } from '../../services/storage'
import { formatDate, formatTime } from '../../utils/format'
import { useThemeClass } from '../../utils/theme'
import { ensureLoginOrRedirect, getAuthUserId } from '../../services/authService'

export default function GroupPage() {
  const router = useRouter()
  const [session, setSession] = useState<GroupSession | null>(null)
  const [expenses, setExpenses] = useState<GroupExpense[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [settlement, setSettlement] = useState<GroupSettlement | null>(null)
  const [finalDetail, setFinalDetail] = useState<GroupFinal | null>(null)
  const [posterSize, setPosterSize] = useState({ width: 1, height: 1 })
  const [visibleCount, setVisibleCount] = useState(5)
  const [kickLoading, setKickLoading] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [showMemberList, setShowMemberList] = useState(false)
  const themeClass = useThemeClass()
  const currentUserId = getAuthUserId()

  useDidShow(() => {
    if (!ensureLoginOrRedirect()) return
    const load = async () => {
      const paramId = Number(router.params?.id)
      let current: GroupSession | undefined
      try {
        if (paramId) {
          try {
            const finalData = await fetchGroupFinal(paramId)
            if (finalData && finalData.status === 1) {
              setFinalDetail(finalData)
              setSettlement(finalData.settlement)
              const finalExpenses = finalData.members.flatMap((member) =>
                member.expenses.map((expense, index) => ({
                  id: `final_${paramId}_${member.userId}_${index}`,
                  groupId: paramId,
                  amount: Number(expense.amount ?? 0),
                  title: expense.title,
                  remark: expense.remark,
                  userId: member.userId,
                  userName: member.name,
                  userAvatar: member.avatar,
                  dateISO: expense.createTime || finalData.endTime || new Date().toISOString()
                }))
              )
              finalExpenses.sort(
                (a, b) => {
                 return  new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
                }).reverse()
              setExpenses(finalExpenses)
              setMembers(getGroupMembers(finalData.groupId))
              setSession({
                id: finalData.groupId,
                title: finalData.title,
                wsPath: '',
                joinedAt: finalData.endTime ?? new Date().toISOString()
              })
              return
            }
          } catch (error) {
            // ignore final fetch errors, fallback to realtime room join
          }

          current = await ensureGroupSession(paramId)
        } else {
          const first = getJoinedGroups()[0]
          current = first ? await ensureGroupSession(first.id) : undefined
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

      setFinalDetail(null)
      setSession(current)
      setMembers(getGroupMembers(current.id))

      // 从后端获取最新的成员列表（包含 role 信息）
      try {
        const membersData = await fetchGroupMembers(current.id)
        if (membersData && membersData.length > 0) {
          membersData.forEach(member => upsertGroupMember(member))
          setMembers(membersData)
        }
      } catch (error) {
        // 如果获取失败，使用缓存的成员列表
        console.log('Failed to fetch members, using cached data')
      }

      const cachedExpenses = getGroupExpenses(current.id)
      setExpenses(cachedExpenses)
      if (!cachedExpenses.length && paramId) {
        try {
          const finalData = await fetchGroupFinal(paramId)
          const finalExpenses = finalData.members.flatMap((member) =>
            member.expenses.map((expense, index) => ({
              id: `final_${paramId}_${member.userId}_${index}`,
              groupId: paramId,
              amount: Number(expense.amount ?? 0),
              title: expense.title,
              remark: expense.remark,
              userId: member.userId,
              userName: member.name,
              userAvatar: member.avatar,
              dateISO: expense.createTime || finalData.endTime || new Date().toISOString()
            }))
          )
          finalExpenses.sort((a, b) =>
            new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()).reverse()
          finalExpenses.forEach((expense) => saveGroupExpense(expense))
          setExpenses(getGroupExpenses(current.id))
          setMembers(getGroupMembers(current.id))
        } catch (error) {
          // ignore final fetch errors, fallback to cached list
        }
      }
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
    if (!session || finalDetail) return
    const unsubscribe = onGroupMessage(session.id, (payload) => {
      if (!payload) return
      if (payload.type === 'member_join' && payload.userId) {
        upsertGroupMember({
          groupId: session.id,
          userId: payload.userId,
          nickName: payload.nickName,
          avatarUrl: payload.avatarUrl,
          joinedAt: new Date().toISOString(),
          role: payload.role || (payload.userId === currentUserId ? 'owner' : 'member')
        })
        setMembers(getGroupMembers(session.id))
        return
      }
      if (payload.type === 'member_kick' || payload.type === 'member_leave') {
        const result = handleMemberChangeMessage(payload, currentUserId ?? 0)
        if (!result.shouldHandle) return

        if (result.isCurrentUser) {
          // 当前用户被踢出或离开
          Taro.showToast({
            title: payload.type === 'member_kick' ? '您已被移出房间' : '已退出房间',
            icon: 'none'
          })
          clearGroupCache(session.id)
          setTimeout(() => {
            Taro.switchTab({ url: '/pages/record/index' })
          }, 1500)
        } else {
          // 其他成员被踢出或离开
          const member = members.find(m => m.userId === payload.userId)
          const nickname = member?.nickName || '成员'
          Taro.showToast({
            title: `${nickname} ${payload.type === 'member_kick' ? '已被移出房间' : '已离开房间'}`,
            icon: 'none'
          })
          removeMemberFromCache(session.id, payload.userId)
          setMembers(getGroupMembers(session.id))
        }
        return
      }
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
          userName: payload.nickName,
          userAvatar: payload.avatarUrl,
          dateISO: payload.dateISO ?? new Date().toISOString()
        }
        saveGroupExpense(expense)
        setExpenses(getGroupExpenses(session.id))
      }
    })

    return () => unsubscribe()
  }, [session, currentUserId, members])

  useEffect(() => {
    setVisibleCount(5)
  }, [expenses])

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

  const memberMap = useMemo(() => {
    return new Map(members.map((member) => [member.userId, member]))
  }, [members])

  const finalMemberMap = useMemo(() => {
    return new Map(finalDetail?.members?.map((member) => [member.userId, member]) ?? [])
  }, [finalDetail])

  const memberList = useMemo(() => {
    if (finalDetail?.members?.length) {
      return finalDetail.members.map((member) => ({
        id: member.userId,
        name: member.userId === currentUserId ? '我' : member.name || `用户${member.userId}`,
        avatar: member.avatar
      }))
    }
    if (settlement?.balances?.length) {
      return settlement.balances.map((item) => {
        const member = memberMap.get(item.userId)
        const finalMember = finalMemberMap.get(item.userId)
        return {
          id: item.userId,
          name: item.userId === currentUserId ? '我' : finalMember?.name || member?.nickName || `用户${item.userId}`,
          avatar: finalMember?.avatar || member?.avatarUrl
        }
      })
    }
    if (members.length) {
      return members.map((member) => ({
        id: member.userId,
        name: member.userId === currentUserId ? '我' : member.nickName || `用户${member.userId}`,
        avatar: member.avatarUrl
      }))
    }
    if (currentUserId !== undefined) {
      return [{ id: currentUserId, name: '我' }]
    }
    return []
  }, [finalDetail, settlement, members, memberMap, finalMemberMap, currentUserId])

  const memberListMap = useMemo(() => {
    return new Map(memberList.map((member) => [member.id, member]))
  }, [memberList])

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

  const handleKickMember = (member: GroupMember) => {
    Taro.showModal({
      title: '确认移除成员',
      content: `确定要将 ${member.nickName || '该成员'} 移出房间吗？`,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          confirmKickMember(member)
        }
      }
    })
  }

  const confirmKickMember = async (member: GroupMember) => {
    if (!session) return
    setKickLoading(true)
    try {
      await kickGroupMember(session.id, member.userId)
      Taro.showToast({
        title: `已将 ${member.nickName || '该成员'} 移出房间`,
        icon: 'success'
      })
    } catch (error: any) {
      const message = error?.message || '操作失败'
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setKickLoading(false)
    }
  }

  const handleLeaveRoom = () => {
    const currentMember = members.find(m => m.userId === currentUserId)
    if (currentMember?.role === 'owner') {
      Taro.showToast({ title: '请先转让房主后再退出', icon: 'none' })
      return
    }
    Taro.showModal({
      title: '确认退出房间',
      content: '确定要退出房间吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          confirmLeaveRoom()
        }
      }
    })
  }

  const confirmLeaveRoom = async () => {
    if (!session) return
    setLeaveLoading(true)
    try {
      await leaveGroup(session.id)
      Taro.showToast({ title: '已退出房间', icon: 'success' })
      clearGroupCache(session.id)
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/record/index' })
      }, 1500)
    } catch (error: any) {
      const message = error?.message || '操作失败'
      Taro.showToast({ title: message, icon: 'none' })
      setLeaveLoading(false)
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

  const visibleExpenses = expenses.slice(0, visibleCount)

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
                  {member.avatar ? (
                    <Image className='member-avatar__image' src={member.avatar} mode='aspectFill' />
                  ) : (
                    <Text>{member.name.slice(0, 1)}</Text>
                  )}
                </View>
              ))}
            </View>
            <View
              className='member-strip__toggle'
              hoverClass='press-opacity'
              onClick={() => setShowMemberList(!showMemberList)}
            >
              <Text>{showMemberList ? '收起' : '管理'}</Text>
            </View>
          </View>
        </Card>

        {showMemberList && !finalDetail && (
          <Card title='成员管理' className='member-management'>
            {members.length === 0 ? (
              <View className='member-empty'>
                <Text className='member-empty__text'>暂无成员</Text>
              </View>
            ) : (
              <View className='member-list'>
                {members.map((member) => {
                  const isOwner = members.find(m => m.userId === currentUserId)?.role === 'owner'
                  const isSelf = member.userId === currentUserId
                  return (
                    <MemberItem
                      key={member.userId}
                      member={member}
                      isOwner={isOwner}
                      isSelf={isSelf}
                      onKick={handleKickMember}
                      loading={kickLoading}
                    />
                  )
                })}
              </View>
            )}
            {currentUserId && members.find(m => m.userId === currentUserId)?.role !== 'owner' && (
              <View className='member-actions'>
                <Button
                  className='leave-room-btn'
                  onClick={handleLeaveRoom}
                >
                  退出房间
                </Button>
              </View>
            )}
          </Card>
        )}

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
        {/*subtitle='不影响个人预算'*/}
        <Card title='多人流水'  className='group-list'>
          {expenses.length === 0 ? (
            <View className='group-empty'>
              <Text className='group-empty__text'>暂无记账，开始添加第一笔。</Text>
            </View>
          ) : (
            <ScrollView
              className='group-transactions-scroll'
              scrollY
              enhanced
              scrollWithAnimation
              scrollAnchoring
              // 避免滚动穿透导致页面整体跟随滚动
              catchMove
              lowerThreshold={40}
              onScrollToLower={() =>
                setVisibleCount((prev) => Math.min(prev + 5, expenses.length))
              }
            >
              <View className='group-transactions'>
                {visibleExpenses.map((item) => {
                  const cachedMember = item.userId ? memberMap.get(item.userId) : undefined
                  const displayName = item.userName || cachedMember?.nickName || (item.userId ? `用户${item.userId}` : '👥')
                  const displayAvatar = item.userAvatar || cachedMember?.avatarUrl

                  return (
                    <Cell key={item.id} className='group-transaction' clickable activeOpacity={0.7}>
                      <View className='group-transaction__row'>
                        <View className='group-transaction__left'>
                          <View className='group-transaction__icon'>
                            {displayAvatar ? (
                              <Image className='group-transaction__avatar' src={displayAvatar} mode='aspectFill' />
                            ) : (
                              <Text>{displayName.slice(0, 1)}</Text>
                            )}
                          </View>
                          <View className='group-transaction__meta'>
                            <Text className='group-transaction__name'>{item.title || item.remark || '多人记账'}</Text>
                            <Text className='group-transaction__sub'>
                              {formatDate(item.dateISO)} {formatTime(item.dateISO)}
                              {item.userId || item.userName ? ` · 付款人：${displayName}` : ''}
                            </Text>
                          </View>
                        </View>
                        <View className='group-transaction__amount'>
                          <Text className='group-transaction__currency'>¥</Text>
                          <Text className='group-transaction__int'>{item.amount.toFixed(0)}</Text>
                          <Text className='group-transaction__dec'>.{item.amount.toFixed(2).split('.')[1]}</Text>
                        </View>
                      </View>
                    </Cell>
                  )
                })}
              </View>
            </ScrollView>
          )}
        </Card>

        {transfers.length ? (
          <Card title='结算路径' subtitle='建议最少转账次数' className='settlement-card'>
            <View className='settlement-list'>
              {transfers.map((item, index) => {
                const fromMember = memberListMap.get(item.fromUserId)
                const toMember = memberListMap.get(item.toUserId)
                return (
                  <View className='settlement-item' key={`${item.fromUserId}-${item.toUserId}-${index}`}>
                    <View className='settlement-item__person'>
                      <View className='settlement-avatar'>
                        {fromMember?.avatar ? (
                          <Image className='settlement-avatar__image' src={fromMember.avatar} mode='aspectFill' />
                        ) : (
                          <Text>{(fromMember?.name ?? `用户${item.fromUserId}`).slice(0, 1)}</Text>
                        )}
                      </View>
                      <Text className='settlement-item__name'>{fromMember?.name ?? `用户${item.fromUserId}`}</Text>
                    </View>
                    <Text className='settlement-item__arrow'>→</Text>
                    <View className='settlement-item__person'>
                      <View className='settlement-avatar'>
                        {toMember?.avatar ? (
                          <Image className='settlement-avatar__image' src={toMember.avatar} mode='aspectFill' />
                        ) : (
                          <Text>{(toMember?.name ?? `用户${item.toUserId}`).slice(0, 1)}</Text>
                        )}
                      </View>
                      <Text className='settlement-item__name'>{toMember?.name ?? `用户${item.toUserId}`}</Text>
                    </View>
                    <View className='settlement-item__amount'>
                      <Text className='settlement-item__currency'>¥</Text>
                      <Text className='settlement-item__int'>{item.amount.toFixed(2)}</Text>
                    </View>
                  </View>
                )
              })}
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
