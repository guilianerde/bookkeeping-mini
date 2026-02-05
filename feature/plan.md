## 📅 房主踢出成员功能 前端开发任务单

---

## 开发阶段概览

本计划将开发任务拆解为 4 个阶段，共 12 个 Step，遵循"数据契约 → UI 组件 → 业务逻辑 → 联调优化"的顺序。

---

## 第一阶段：数据契约与基础定义 (Data & Types)

### [Step 1]: 定义类型声明文件

**涉及文件**：
- `src/types/group.ts` [修改]

**任务描述**：
1. 在 `src/types/group.ts` 中新增以下 TypeScript 接口：
   - `GroupMember`：成员信息（包含 userId, nickname, avatar, role, joinTime, status, leaveTime, leaveReason）
   - `MemberChangeMessage`：WebSocket 成员变更消息（type, groupId, userId, operatorId, timestamp）
   - `SettlementMessage`：结算更新消息（type, groupId, settlement, timestamp）
2. 确保类型定义与后端接口契约一致
3. 导出所有新增类型供其他模块使用

**验收标准**：
- [ ] 类型定义无 TypeScript 编译错误
- [ ] 所有字段都有明确的类型注释
- [ ] 枚举类型使用字面量联合类型（如 `'owner' | 'member'`）

---

### [Step 2]: 封装房间成员相关 API

**涉及文件**：
- `src/services/groupService.ts` [修改]

**任务描述**：
1. 在 `groupService.ts` 中新增以下 API 方法：
   - `kickMember(groupId: string, userId: string): Promise<Result<void>>`
     - 调用 `POST /groups/kick/{groupId}/{userId}`
   - `leaveGroup(groupId: string): Promise<Result<void>>`
     - 调用 `POST /groups/leave/{groupId}`
   - `getGroupMembers(groupId: string): Promise<Result<GroupMember[]>>`
     - 调用 `GET /groups/{groupId}/members`
2. 使用 `src/services/request.ts` 的统一请求方法
3. 添加完整的类型注解（入参和返回值）

**验收标准**：
- [ ] API 函数编译通过，类型推导正确
- [ ] 使用统一的 `Result<T>` 返回类型
- [ ] 错误处理遵循现有规范（success codes: 0, 200）

---

## 第二阶段：静态组件与 Storyboard (UI Components)

### [Step 3]: 创建成员列表项组件

**涉及文件**：
- `src/components/ui/MemberItem.tsx` [新增]
- `src/components/ui/MemberItem.scss` [新增]

**任务描述**：
1. 创建 `MemberItem` 组件，接收 Props：
   - `member: GroupMember`
   - `isOwner: boolean`（当前用户是否为房主）
   - `isSelf: boolean`（是否为当前用户自己）
   - `onKick?: (member: GroupMember) => void`
2. UI 结构：
   - 左侧：头像（使用 Taroify `Image` 组件）
   - 中间：昵称 + 房主标识（Badge）
   - 右侧：踢出按钮（仅当 `isOwner && !isSelf` 时显示）
3. 样式要求：
   - 使用 SCSS，2 空格缩进
   - 响应式布局，适配不同屏幕尺寸
   - 昵称过长时截断显示（最多 10 字符 + "..."）

**验收标准**：
- [ ] 组件可独立渲染，无业务逻辑依赖
- [ ] UI 与设计稿一致（头像、昵称、按钮布局）
- [ ] 房主标识 Badge 正确显示
- [ ] 踢出按钮根据 Props 条件显示/隐藏

---

### [Step 4]: 创建踢出确认弹窗组件

**涉及文件**：
- `src/components/ui/KickConfirmDialog.tsx` [新增]
- `src/components/ui/KickConfirmDialog.scss` [新增]

**任务描述**：
1. 创建 `KickConfirmDialog` 组件，接收 Props：
   - `visible: boolean`
   - `member: GroupMember | null`
   - `loading: boolean`
   - `onConfirm: () => void`
   - `onCancel: () => void`
2. 使用 Taroify 的 `Dialog` 组件
3. 弹窗内容：
   - 标题："确认移除成员"
   - 内容：`确定要将 ${member.nickname} 移出房间吗？`
   - 按钮：[取消] [确定]
4. 确定按钮在 `loading` 时显示加载状态

**验收标准**：
- [ ] 弹窗可正常打开/关闭
- [ ] 遮罩层点击可关闭弹窗
- [ ] 确定按钮 Loading 状态正确显示
- [ ] 样式符合 Taroify 规范

---

### [Step 5]: 创建离开房间确认弹窗组件

**涉及文件**：
- `src/components/ui/LeaveConfirmDialog.tsx` [新增]
- `src/components/ui/LeaveConfirmDialog.scss` [新增]

**任务描述**：
1. 创建 `LeaveConfirmDialog` 组件，接收 Props：
   - `visible: boolean`
   - `loading: boolean`
   - `onConfirm: () => void`
   - `onCancel: () => void`
2. 使用 Taroify 的 `Dialog` 组件
3. 弹窗内容：
   - 标题："确认退出房间"
   - 内容："确定要退出房间吗？"
   - 按钮：[取消] [确定]

**验收标准**：
- [ ] 弹窗可正常打开/关闭
- [ ] 确定按钮 Loading 状态正确显示
- [ ] 样式与 `KickConfirmDialog` 保持一致

---

## 第三阶段：状态管理与交互逻辑 (Business Logic)

### [Step 6]: 扩展 WebSocket 消息处理

**涉及文件**：
- `src/services/groupWs.ts` [修改]

**任务描述**：
1. 在 `groupWs.ts` 中新增消息类型处理：
   - `member_kick`：成员被踢出
   - `member_leave`：成员主动离开
2. 实现 `handleMemberChange` 函数：
   - 判断是否为当前用户被踢出/离开
   - 如果是当前用户：断开 WebSocket、清理缓存、跳转到列表页
   - 如果是其他成员：更新成员缓存、显示 Toast 提示
3. 消息去重逻辑（使用 `timestamp` 或 `messageId`）

**验收标准**：
- [ ] WebSocket 可正确接收 `member_kick` 和 `member_leave` 消息
- [ ] 消息处理逻辑符合需求文档描述
- [ ] 消息去重机制有效（避免重复处理）
- [ ] 错误处理完善（WebSocket 断线重连）

---

### [Step 7]: 实现本地缓存管理

**涉及文件**：
- `src/services/storage.ts` [修改]

**任务描述**：
1. 在 `storage.ts` 中新增 `clearGroupCache` 函数：
   - 清除 `group_members` 缓存中的指定房间数据
   - 清除 `group_transactions` 缓存中的指定房间数据
   - 从 `group_sessions` 中移除该房间记录
2. 新增 `updateMemberCache` 函数：
   - 从 `group_members` 缓存中移除指定成员
   - 或标记成员 `status=1`（保留历史记录）

**验收标准**：
- [ ] 缓存清理函数可正常执行
- [ ] 清理后不影响其他房间的缓存数据
- [ ] 成员缓存更新逻辑正确（移除或标记）

---

### [Step 8]: 在房间页面集成成员列表 UI

**涉及文件**：
- `src/pages/group/index.tsx` [修改]
- `src/pages/group/index.scss` [修改]

**任务描述**：
1. 在 `GroupPage` 中新增成员列表区域：
   - 使用 `MemberItem` 组件渲染每个成员
   - 传递正确的 Props（`isOwner`, `isSelf`, `onKick`）
2. 添加"退出房间"按钮（仅普通成员可见）
3. 集成 `KickConfirmDialog` 和 `LeaveConfirmDialog`
4. 成员列表为空时显示空状态："暂无成员"

**验收标准**：
- [ ] 成员列表正确渲染
- [ ] 房主标识正确显示
- [ ] 踢出按钮仅在房主身份且非自己时显示
- [ ] 退出房间按钮仅在普通成员身份时显示
- [ ] 空状态正确显示

---

### [Step 9]: 实现踢出成员交互逻辑

**涉及文件**：
- `src/pages/group/index.tsx` [修改]

**任务描述**：
1. 实现 `handleKick` 函数：
   - 打开 `KickConfirmDialog`
   - 点击确定后调用 `kickMember` API
   - 显示 Loading 状态（防止重复点击）
   - 成功后显示 Toast："已将 [昵称] 移出房间"
   - 失败后显示错误提示（如"仅房主可操作"）
2. 权限校验：
   - 前端检查当前用户是否为房主
   - 不允许踢出自己
3. 错误处理：
   - 403 → "仅房主可操作"
   - 404 → "成员不存在"
   - 410 → "房间已解散"，跳转到列表页
   - 超时 → "网络异常，请重试"

**验收标准**：
- [ ] 踢出流程完整可用
- [ ] Loading 状态正确显示
- [ ] Toast 提示信息准确
- [ ] 错误处理覆盖所有异常场景
- [ ] 防止重复点击（按钮禁用或 Loading）

---

### [Step 10]: 实现离开房间交互逻辑

**涉及文件**：
- `src/pages/group/index.tsx` [修改]

**任务描述**：
1. 实现 `handleLeave` 函数：
   - 检查当前用户是否为房主
   - 如果是房主，Toast 提示："请先转让房主后再退出"，阻止操作
   - 如果是普通成员，打开 `LeaveConfirmDialog`
   - 点击确定后调用 `leaveGroup` API
   - 成功后：断开 WebSocket、清理缓存、跳转到列表页
2. 错误处理：
   - 超时 → "网络异常，请重试"
   - 其他错误 → 显示后端返回的错误信息

**验收标准**：
- [ ] 离开流程完整可用
- [ ] 房主无法直接离开（前端拦截）
- [ ] 普通成员可正常离开
- [ ] 离开后自动跳转到列表页
- [ ] 本地缓存正确清理

---

### [Step 11]: 集成 WebSocket 实时更新

**涉及文件**：
- `src/pages/group/index.tsx` [修改]

**任务描述**：
1. 在 `GroupPage` 的 `useEffect` 中监听 WebSocket 消息：
   - 监听 `member_kick` 和 `member_leave` 事件
   - 收到消息后调用 `handleMemberChange` 处理
2. 实现成员列表实时更新：
   - 收到成员变更消息后，重新获取成员列表
   - 或直接从本地缓存中移除该成员
3. 实现结算视图实时更新：
   - 收到 `settlement` 消息后，更新结算数据
4. 被踢出/离开的用户处理：
   - 如果是当前用户，立即断开 WebSocket
   - 清理本地缓存
   - 跳转到列表页
   - 显示 Toast 提示

**验收标准**：
- [ ] WebSocket 消息监听正常
- [ ] 成员列表实时更新（其他成员离开时）
- [ ] 结算视图实时更新
- [ ] 被踢出用户自动跳转
- [ ] Toast 提示信息准确

---

## 第四阶段：联调与优化 (Integration & Polish)

### [Step 12]: 联调测试与边界优化

**涉及文件**：
- `src/pages/group/index.tsx` [修改]
- `src/services/groupWs.ts` [修改]
- `src/components/ui/MemberItem.tsx` [修改]

**任务描述**：
1. **接口联调**：
   - 替换 Mock 数据，使用真实后端接口
   - 测试踢出成员、离开房间、获取成员列表接口
   - 验证 WebSocket 广播是否正常
2. **边界情况测试**：
   - 成员昵称过长时截断显示
   - 成员头像加载失败时显示默认头像
   - 成员列表为空时显示空状态
   - 网络超时处理
   - WebSocket 断线重连
3. **性能优化**：
   - 成员列表渲染优化（虚拟列表，如果成员数 > 100）
   - 防抖/节流（踢出按钮点击）
   - 缓存读写优化
4. **兼容性测试**：
   - 微信小程序环境测试
   - H5 环境测试
   - 支付宝小程序环境测试
5. **细节打磨**：
   - 添加动画过渡（弹窗、列表项移除）
   - 优化 Loading 状态显示
   - 完善错误提示文案

**验收标准**：
- [ ] 所有接口联调通过
- [ ] 边界情况处理完善
- [ ] 性能满足要求（列表渲染流畅）
- [ ] 兼容性测试通过（微信小程序、H5、支付宝小程序）
- [ ] UI 细节打磨完成（动画、Loading、错误提示）

---

## 附录：文件清单快照

### 新增文件
- `src/components/ui/MemberItem.tsx` [新增]
- `src/components/ui/MemberItem.scss` [新增]
- `src/components/ui/KickConfirmDialog.tsx` [新增]
- `src/components/ui/KickConfirmDialog.scss` [新增]
- `src/components/ui/LeaveConfirmDialog.tsx` [新增]
- `src/components/ui/LeaveConfirmDialog.scss` [新增]

### 修改文件
- `src/types/group.ts` [修改] - 新增类型定义
- `src/services/groupService.ts` [修改] - 新增 API 方法
- `src/services/groupWs.ts` [修改] - 新增消息处理
- `src/services/storage.ts` [修改] - 新增缓存管理函数
- `src/pages/group/index.tsx` [修改] - 集成成员列表和交互逻辑
- `src/pages/group/index.scss` [修改] - 新增样式

---

## ⚠️ 编码约束 (后续执行准则)

### 代码规范
1. **TypeScript 严格模式**：
   - 禁止使用 `any` 类型
   - 所有函数必须有明确的类型注解
   - 使用字面量联合类型代替枚举

2. **组件规范**：
   - 必须使用函数式组件（React Hooks）
   - 组件文件使用 PascalCase 命名（如 `MemberItem.tsx`）
   - Props 接口命名为 `[ComponentName]Props`

3. **样式规范**：
   - 使用 SCSS，2 空格缩进
   - 单引号，无分号
   - 类名使用 kebab-case（如 `member-item`）

4. **代码量控制**：
   - 每个 Step 的代码量控制在 100 行左右
   - 复杂逻辑拆分为独立函数
   - 避免过度嵌套（最多 3 层）

### 技术约束
1. **UI 组件库**：
   - 优先使用 Taroify 组件（`@taroify/core`）
   - 按需引入样式，避免全量引入

2. **网络请求**：
   - 统一使用 `src/services/request.ts`
   - 返回类型必须为 `Result<T>`
   - 错误处理遵循现有规范（success codes: 0, 200）

3. **WebSocket**：
   - 复用 `src/services/groupWs.ts` 的连接管理
   - 消息处理必须实现去重逻辑
   - 断线重连机制已存在，无需重复实现

4. **本地存储**：
   - 使用 Taro 的 `getStorageSync` / `setStorageSync`
   - 缓存 key 遵循现有命名规范（如 `group_members`）

### 测试要求
1. **功能测试**：
   - 每个 Step 完成后进行自测
   - 验收标准全部通过后才进入下一 Step

2. **边界测试**：
   - 网络异常（超时、断网、500/403/404/410 错误）
   - 数据边界（空列表、长文本、大数值）
   - 并发场景（同时踢出、同时离开）

3. **兼容性测试**：
   - 微信小程序（主要目标）
   - H5（次要目标）
   - 支付宝小程序（次要目标）

---

## 📊 开发进度追踪

| Step | 任务名称 | 预计工作量 | 状态 | 备注 |
|------|---------|-----------|------|------|
| 1 | 定义类型声明文件 | 0.5h | ⏳ 待开始 | - |
| 2 | 封装房间成员相关 API | 1h | ⏳ 待开始 | - |
| 3 | 创建成员列表项组件 | 1.5h | ⏳ 待开始 | - |
| 4 | 创建踢出确认弹窗组件 | 0.5h | ⏳ 待开始 | - |
| 5 | 创建离开房间确认弹窗组件 | 0.5h | ⏳ 待开始 | - |
| 6 | 扩展 WebSocket 消息处理 | 2h | ⏳ 待开始 | - |
| 7 | 实现本地缓存管理 | 1h | ⏳ 待开始 | - |
| 8 | 在房间页面集成成员列表 UI | 1.5h | ⏳ 待开始 | - |
| 9 | 实现踢出成员交互逻辑 | 2h | ⏳ 待开始 | - |
| 10 | 实现离开房间交互逻辑 | 1.5h | ⏳ 待开始 | - |
| 11 | 集成 WebSocket 实时更新 | 2h | ⏳ 待开始 | - |
| 12 | 联调测试与边界优化 | 3h | ⏳ 待开始 | - |

**总计预估工作量**：约 17 小时

---

## 🔗 相关文档

- **需求详述**：`./feature/detail.md`
- **项目背景**：`/AGENTS.md`
- **原始需求**：`./feature/01-detail-init.md`

---

## 📝 注意事项

1. **严格按顺序执行**：每个 Step 必须在前一个 Step 完成后才能开始
2. **验收标准必须全部通过**：不允许跳过任何验收项
3. **代码审查**：每个阶段完成后进行代码审查，确保符合编码约束
4. **文档同步更新**：如果实现过程中发现需求变更，及时更新 `detail.md`
5. **Git 提交规范**：遵循 Conventional Commits（`feat:`, `fix:`, `chore:`）
6. **保持代码风格一致**：参考现有代码，保持 2 空格、单引号、无分号的风格
