import { Dialog } from '@taroify/core'
import './leave-confirm-dialog.scss'

export type LeaveConfirmDialogProps = {
  visible: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function LeaveConfirmDialog({ visible, loading, onConfirm, onCancel }: LeaveConfirmDialogProps) {
  return (
    <Dialog open={visible} onClose={onCancel} className="leave-confirm-dialog">
      <Dialog.Header>确认退出房间</Dialog.Header>
      <Dialog.Content>
        确定要退出房间吗？
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Button onClick={onCancel} disabled={loading}>取消</Dialog.Button>
        <Dialog.Button onClick={onConfirm} disabled={loading}>确定</Dialog.Button>
      </Dialog.Actions>
    </Dialog>
  )
}
