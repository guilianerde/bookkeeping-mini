import { Button } from '@tarojs/components'
import './primary-button.scss'

export type PrimaryButtonProps = {
  text: string
  onClick?: () => void
  className?: string
}

export default function PrimaryButton({ text, onClick, className }: PrimaryButtonProps) {
  return (
    <Button className={`ui-primary-button ${className ?? ''}`} onClick={onClick}>
      {text}
    </Button>
  )
}
