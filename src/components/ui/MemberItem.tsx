import { View, Text, Image } from '@tarojs/components'
import { Button } from '@taroify/core'
import type { GroupMember } from '../../models/group'
import './member-item.scss'

export type MemberItemProps = {
  member: GroupMember
  isOwner: boolean
  isSelf: boolean
  onKick?: (member: GroupMember) => void
  loading?: boolean
}

export default function MemberItem({ member, isOwner, isSelf, onKick, loading }: MemberItemProps) {
  const showKickButton = isOwner && !isSelf

  const handleKick = () => {
    if (onKick && !loading) {
      onKick(member)
    }
  }

  const truncateNickname = (name: string) => {
    if (name.length > 10) {
      return name.substring(0, 10) + '...'
    }
    return name
  }

  return (
    <View className="member-item">
      <Image
        src={member.avatarUrl || '/assets/default-avatar.png'}
        className="member-item__avatar"
        mode="aspectFill"
      />
      <View className="member-item__info">
        <Text className="member-item__nickname">
          {truncateNickname(member.nickName || '未命名')}
        </Text>
        {member.role === 'owner' && (
          <View className="member-item__badge">房主</View>
        )}
      </View>
      {showKickButton && (
        <Button
          size="small"
          color="danger"
          variant="outlined"
          loading={loading}
          disabled={loading}
          onClick={handleKick}
          className="member-item__kick-btn"
        >
          踢出
        </Button>
      )}
    </View>
  )
}
