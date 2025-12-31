import { Text } from '@tarojs/components'
import './empty-state.scss'

export type EmptyStateProps = {
  text: string
  className?: string
}

export default function EmptyState({ text, className }: EmptyStateProps) {
  return <Text className={`ui-empty-state ${className ?? ''}`}>{text}</Text>
}
