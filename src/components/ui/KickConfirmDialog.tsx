import { Dialog } from '@taroify/core'
import type { GroupMember } from '../../models/group'
import './kick-confirm-dialog.scss'

export type KickConfirmDialogProps = {
  visible: boolean
  member: GroupMember | null
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function KickConfirmDialog({ visible, member, loading, onConfirm, onCancel }: KickConfirmDialogProps) {
  return (
    <Dialog open={visible} onClose={onCancel} className="kick-confirm-dialog">
      <Dialog.Header>确认移除成员</Dialog.Header>
      <Dialog.Content>
        {member ? `确定要将 ${member.nickName || '该成员'} 移出房间吗？` : '确定要移除该成员吗？'}
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Button onClick={onCancel} disabled={loading}>取消</Dialog.Button>
        <Dialog.Button onClick={onConfirm} disabled={loading}>确定</Dialog.Button>
      </Dialog.Actions>
    </Dialog>
  )
}
