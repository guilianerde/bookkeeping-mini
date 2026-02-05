# 房主踢出成员功能 - 开发执行文档

## 📋 执行概览

本文档记录了"房主踢出成员功能"的完整开发过程，包括代码实现、接口对接和联调准备。

---

## ✅ 已完成的开发任务

### Phase 1: 数据契约与基础定义

#### Step 1: 定义类型声明文件 ✅

**文件**: `src/models/group.ts`

**新增类型定义**:

```typescript
// 扩展 GroupMember 类型
export type GroupMember = {
  groupId: number
  userId: number
  nickName?: string
  avatarUrl?: string
  joinedAt: string
  role?: 'owner' | 'member'  // 新增：角色标识
  status?: 0 | 1  // 新增：0=在房，1=离开/被踢
  leaveTime?: string  // 新增：离开时间
  leaveReason?: 'leave' | 'kick'  // 新增：离开原因
}

// WebSocket 成员变更消息
export type MemberChangeMessage = {
  type: 'member_kick' | 'member_leave'
  groupId: string
  userId: string
  operatorId?: string
  timestamp: number
}

// WebSocket 结算更新消息
export type SettlementMessage = {
  type: 'settlement'
  groupId: string
  settlement: {
    transfers: Array<{
      from: string
      to: string
      amount: number
    }>
    netAmounts: Record<string, number>
  }
  timestamp: number
}
```

---

#### Step 2: 封装房间成员相关 API ✅

**文件**: `src/services/groupService.ts`

**新增 API 方法**:

```typescript
// 从后端获取成员列表
export const fetchGroupMembers = async (groupId: number) => {
  return request<Record<string, never>, GroupMember[]>({
    url: `/groups/${groupId}/members`,
    method: 'GET'
  })
}

// 踢出成员（已存在）
export const kickGroupMember = async (groupId: number, userId: number) => {
  await request<Record<string, never>, GroupApiResponse>({
    url: `/groups/kick/${groupId}/${userId}`,
    method: 'POST'
  })
}

// 离开房间（已存在）
export const leaveGroup = async (groupId: number) => {
  await request<Record<string, never>, GroupApiResponse>({
    url: `/groups/leave/${groupId}`,
    method: 'POST'
  })
  disconnectGroupSocket(groupId)
  removeJoinedGroup(groupId)
}
```

---

### Phase 2: 静态组件与 UI

#### Step 3: 创建成员列表项组件 ✅

**文件**:
- `src/components/ui/MemberItem.tsx`
- `src/components/ui/member-item.scss`

**组件功能**:
- 展示成员头像、昵称、房主标识
- 根据权限显示"踢出"按钮
- 昵称过长时自动截断（最多 10 字符）
- 支持 Loading 状态

**Props**:
```typescript
export type MemberItemProps = {
  member: GroupMember
  isOwner: boolean  // 当前用户是否为房主
  isSelf: boolean   // 是否为当前用户自己
  onKick?: (member: GroupMember) => void
  loading?: boolean
}
```

---

#### Step 4: 创建踢出确认弹窗组件 ✅

**文件**:
- `src/components/ui/KickConfirmDialog.tsx`
- `src/components/ui/kick-confirm-dialog.scss`

**组件功能**:
- 使用 Taroify Dialog 组件
- 显示被踢出成员的昵称
- 支持 Loading 状态
- 遮罩层点击可关闭

---

#### Step 5: 创建离开房间确认弹窗组件 ✅

**文件**:
- `src/components/ui/LeaveConfirmDialog.tsx`
- `src/components/ui/leave-confirm-dialog.scss`

**组件功能**:
- 使用 Taroify Dialog 组件
- 确认用户是否退出房间
- 支持 Loading 状态

---

### Phase 3: 状态管理与交互逻辑

#### Step 6: 扩展 WebSocket 消息处理 ✅

**文件**: `src/services/groupWs.ts`

**新增功能**:

```typescript
// 处理成员变更消息的辅助函数
const processedMessages = new Set<string>()

export const handleMemberChangeMessage = (
  message: MemberChangeMessage,
  currentUserId: number
) => {
  const { type, groupId, userId, timestamp } = message

  // 消息去重
  const messageId = `${type}_${groupId}_${userId}_${timestamp}`
  if (processedMessages.has(messageId)) {
    return { shouldHandle: false, isCurrentUser: false }
  }
  processedMessages.add(messageId)

  // 清理旧消息（保留最近 100 条）
  if (processedMessages.size > 100) {
    const arr = Array.from(processedMessages)
    arr.slice(0, 50).forEach(id => processedMessages.delete(id))
  }

  const isCurrentUser = String(userId) === String(currentUserId)

  return {
    shouldHandle: true,
    isCurrentUser,
    messageType: type,
    groupId,
    userId
  }
}
```

---

#### Step 7: 实现本地缓存管理 ✅

**文件**: `src/services/storage.ts`

**新增函数**:

```typescript
// 清除指定房间的所有缓存数据
export const clearGroupCache = (groupId: number) => {
  // 清除成员缓存
  const members = readStorage<any[]>(storageKeys.groupMembers, [])
  const filteredMembers = members.filter((m) => m.groupId !== groupId)
  writeStorage(storageKeys.groupMembers, filteredMembers)

  // 清除流水缓存
  const transactions = readStorage<any[]>(storageKeys.groupTransactions, [])
  const filteredTransactions = transactions.filter((t) => t.groupId !== groupId)
  writeStorage(storageKeys.groupTransactions, filteredTransactions)

  // 清除房间会话
  const sessions = readStorage<any[]>(storageKeys.groupSessions, [])
  const filteredSessions = sessions.filter((s) => s.id !== groupId)
  writeStorage(storageKeys.groupSessions, filteredSessions)
}

// 更新成员缓存（移除指定成员）
export const removeMemberFromCache = (groupId: number, userId: number) => {
  const members = readStorage<any[]>(storageKeys.groupMembers, [])
  const filteredMembers = members.filter(
    (m) => !(m.groupId === groupId && m.userId === userId)
  )
  writeStorage(storageKeys.groupMembers, filteredMembers)
}

// 更新成员缓存（标记成员状态）
export const updateMemberStatus = (
  groupId: number,
  userId: number,
  status: 0 | 1,
  reason?: 'leave' | 'kick'
) => {
  const members = readStorage<any[]>(storageKeys.groupMembers, [])
  const updatedMembers = members.map((m) => {
    if (m.groupId === groupId && m.userId === userId) {
      return {
        ...m,
        status,
        leaveTime: status === 1 ? new Date().toISOString() : undefined,
        leaveReason: status === 1 ? reason : undefined
      }
    }
    return m
  })
  writeStorage(storageKeys.groupMembers, updatedMembers)
}
```

---

#### Step 8-11: 在房间页面集成完整功能 ✅

**文件**:
- `src/pages/group/index.tsx`
- `src/pages/group/index.scss`

**新增状态**:
```typescript
const [kickDialogVisible, setKickDialogVisible] = useState(false)
const [leaveDialogVisible, setLeaveDialogVisible] = useState(false)
const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null)
const [kickLoading, setKickLoading] = useState(false)
const [leaveLoading, setLeaveLoading] = useState(false)
const [showMemberList, setShowMemberList] = useState(false)
```

**核心功能实现**:

1. **踢出成员逻辑**:
```typescript
const handleKickMember = (member: GroupMember) => {
  setSelectedMember(member)
  setKickDialogVisible(true)
}

const handleConfirmKick = async () => {
  if (!selectedMember || !session) return
  setKickLoading(true)
  try {
    await kickGroupMember(session.id, selectedMember.userId)
    Taro.showToast({
      title: `已将 ${selectedMember.nickName || '该成员'} 移出房间`,
      icon: 'success'
    })
    setKickDialogVisible(false)
    setSelectedMember(null)
  } catch (error: any) {
    const message = error?.message || '操作失败'
    Taro.showToast({ title: message, icon: 'none' })
  } finally {
    setKickLoading(false)
  }
}
```

2. **离开房间逻辑**:
```typescript
const handleLeaveRoom = () => {
  const currentMember = members.find(m => m.userId === currentUserId)
  if (currentMember?.role === 'owner') {
    Taro.showToast({ title: '请先转让房主后再退出', icon: 'none' })
    return
  }
  setLeaveDialogVisible(true)
}

const handleConfirmLeave = async () => {
  if (!session) return
  setLeaveLoading(true)
  try {
    await leaveGroup(session.id)
    Taro.showToast({ title: '已退出房间', icon: 'success' })
    clearGroupCache(session.id)
    setTimeout(() => {
      Taro.redirectTo({ url: '/pages/groupList/index' })
    }, 1500)
  } catch (error: any) {
    const message = error?.message || '操作失败'
    Taro.showToast({ title: message, icon: 'none' })
    setLeaveLoading(false)
  }
}
```

3. **WebSocket 消息监听**:
```typescript
useEffect(() => {
  if (!session || finalDetail) return
  const unsubscribe = onGroupMessage(session.id, (payload) => {
    if (!payload) return

    // 处理成员变更消息
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
          Taro.redirectTo({ url: '/pages/groupList/index' })
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

    // 其他消息处理...
  })

  return () => unsubscribe()
}, [session, currentUserId, members])
```

4. **UI 集成**:
- 在成员头像条添加"管理"按钮，可展开/收起成员列表
- 成员列表展示所有成员，房主可看到"踢出"按钮
- 普通成员可看到"退出房间"按钮
- 集成 KickConfirmDialog 和 LeaveConfirmDialog

---

## 📁 文件清单

### 新增文件 (6 个)
- ✅ `src/components/ui/MemberItem.tsx`
- ✅ `src/components/ui/member-item.scss`
- ✅ `src/components/ui/KickConfirmDialog.tsx`
- ✅ `src/components/ui/kick-confirm-dialog.scss`
- ✅ `src/components/ui/LeaveConfirmDialog.tsx`
- ✅ `src/components/ui/leave-confirm-dialog.scss`

### 修改文件 (6 个)
- ✅ `src/models/group.ts` - 新增类型定义
- ✅ `src/services/groupService.ts` - 新增 API 方法
- ✅ `src/services/groupWs.ts` - 新增消息处理
- ✅ `src/services/storage.ts` - 新增缓存管理函数
- ✅ `src/pages/group/index.tsx` - 集成成员列表和交互逻辑
- ✅ `src/pages/group/index.scss` - 新增样式

---

## 🔗 后端接口对接说明

### 1. 踢出成员接口

**请求**:
```
POST /groups/kick/{groupId}/{userId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "success": true
  },
  "message": "成员已移除"
}
```

**错误码**:
- `403`: 仅房主可操作
- `404`: 成员不存在
- `410`: 房间已解散

---

### 2. 离开房间接口

**请求**:
```
POST /groups/leave/{groupId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "success": true
  },
  "message": "已退出房间"
}
```

---

### 3. 获取成员列表接口

**请求**:
```
GET /groups/{groupId}/members
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 0,
  "data": [
    {
      "groupId": 123,
      "userId": 456,
      "nickName": "张三",
      "avatarUrl": "https://...",
      "joinedAt": "2026-02-05T10:00:00Z",
      "role": "owner"
    }
  ]
}
```

---

### 4. WebSocket 广播消息

#### 成员被踢出
```json
{
  "type": "member_kick",
  "groupId": "123",
  "userId": "456",
  "operatorId": "789",
  "timestamp": 1738742400000
}
```

#### 成员主动离开
```json
{
  "type": "member_leave",
  "groupId": "123",
  "userId": "456",
  "timestamp": 1738742400000
}
```

#### 结算更新
```json
{
  "type": "settlement",
  "groupId": "123",
  "settlement": {
    "transfers": [
      {"from": "user1", "to": "user2", "amount": 50}
    ],
    "netAmounts": {
      "user1": -50,
      "user2": 50
    }
  },
  "timestamp": 1738742400000
}
```

---

## ⚠️ 注意事项

### 1. 权限控制
- **前端**: 根据 `role` 字段隐藏/显示踢出按钮
- **后端**: 必须验证操作者是否为房主

### 2. WebSocket 消息去重
- 使用 `timestamp` 和 `userId` 组合生成唯一 ID
- 保留最近 100 条消息记录，防止内存泄漏

### 3. 缓存清理
- 被踢出/离开时，必须清理以下缓存：
  - `group_members`
  - `group_transactions`
  - `group_sessions`

### 4. 用户体验
- 操作成功后显示 Toast 提示
- 被踢出后自动跳转到房间列表页
- Loading 状态防止重复点击

### 5. 边界情况
- 房主无法直接离开，需先转让房主权限
- 成员离开后，历史流水记录保留
- 房间仅剩 1 人时，结算清空

---

## 🧪 测试清单

### 功能测试
- [ ] 房主可以踢出其他成员
- [ ] 房主无法踢出自己
- [ ] 普通成员无法看到踢出按钮
- [ ] 普通成员可以主动离开房间
- [ ] 房主无法直接离开（提示需转让房主）
- [ ] 被踢出的成员自动跳转到列表页
- [ ] 其他成员收到实时通知

### WebSocket 测试
- [ ] 成员变更消息正确接收
- [ ] 消息去重机制有效
- [ ] 断线重连后数据同步正常

### 缓存测试
- [ ] 被踢出后本地缓存正确清理
- [ ] 离开房间后本地缓存正确清理
- [ ] 其他房间的缓存不受影响

### 边界测试
- [ ] 网络超时处理
- [ ] 接口返回 403/404/410 错误处理
- [ ] 昵称过长时截断显示
- [ ] 成员列表为空时显示空状态

### 兼容性测试
- [ ] 微信小程序环境
- [ ] H5 环境
- [ ] 支付宝小程序环境

---

## 📝 后续优化建议

1. **房主转让功能**: 允许房主将权限转让给其他成员
2. **批量操作**: 支持批量踢出成员
3. **黑名单功能**: 被踢出的成员无法再次加入
4. **操作日志**: 记录所有成员变动操作
5. **权限分级**: 支持管理员、普通成员等多级权限

---

## 🎯 开发进度

| Step | 任务名称 | 状态 |
|------|---------|------|
| 1 | 定义类型声明文件 | ✅ 已完成 |
| 2 | 封装房间成员相关 API | ✅ 已完成 |
| 3 | 创建成员列表项组件 | ✅ 已完成 |
| 4 | 创建踢出确认弹窗组件 | ✅ 已完成 |
| 5 | 创建离开房间确认弹窗组件 | ✅ 已完成 |
| 6 | 扩展 WebSocket 消息处理 | ✅ 已完成 |
| 7 | 实现本地缓存管理 | ✅ 已完成 |
| 8 | 在房间页面集成成员列表 UI | ✅ 已完成 |
| 9 | 实现踢出成员交互逻辑 | ✅ 已完成 |
| 10 | 实现离开房间交互逻辑 | ✅ 已完成 |
| 11 | 集成 WebSocket 实时更新 | ✅ 已完成 |
| 12 | 联调测试与边界优化 | ⏳ 待进行 |

**当前状态**: 开发阶段已完成，等待后端接口联调和测试。

---

## 📞 联调准备

### 前端已就绪
- ✅ 所有 UI 组件已开发完成
- ✅ API 调用已封装
- ✅ WebSocket 消息处理已实现
- ✅ 本地缓存管理已完善

### 需要后端配合
1. 确认接口路径和参数格式
2. 确认 WebSocket 消息格式
3. 确认错误码和错误信息
4. 提供测试环境和测试账号

### 环境配置
- API Base URL: 在 `src/config/api.ts` 中配置
- WebSocket URL: 自动从 HTTP URL 转换为 WS URL
- 跨域配置: 开发环境需配置代理

---

**文档生成时间**: 2026-02-05
**开发者**: Claude Code
**版本**: v1.0
