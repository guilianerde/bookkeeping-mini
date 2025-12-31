import { View, Text } from '@tarojs/components'
import './card.scss'

export type CardProps = {
  title?: string
  subtitle?: string
  actionText?: string
  onAction?: () => void
  className?: string
  children?: React.ReactNode
}

export default function Card({ title, subtitle, actionText, onAction, className, children }: CardProps) {
  const hasHeader = title || subtitle || actionText
  return (
    <View className={`ui-card ${className ?? ''}`}>
      {hasHeader ? (
        <View className="ui-card__header">
          <View className="ui-card__titles">
            {title ? <Text className="ui-card__title">{title}</Text> : null}
            {subtitle ? <Text className="ui-card__subtitle">{subtitle}</Text> : null}
          </View>
          {actionText ? (
            <Text className="ui-card__action" onClick={onAction}>{actionText}</Text>
          ) : null}
        </View>
      ) : null}
      <View className="ui-card__body">{children}</View>
    </View>
  )
}
