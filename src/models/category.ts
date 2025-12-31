import { categoryTypes } from './types'

export type Category = {
  id: number
  desc: string
  icon: string
  color: string
  emoji: string
}

const categoryColors = [
  '#f1c0b9',
  '#f7d6a0',
  '#c7e4c2',
  '#b7d7f0',
  '#d4c5f5',
  '#f0c6e3',
  '#c6d8f0',
  '#f5c2b5',
  '#c3e7e0',
  '#f4d1a6',
  '#e9c5a1',
  '#cde0f0'
]

export const defaultCategories: Category[] = categoryTypes.map((item, index) => ({
  id: item.id,
  desc: item.desc,
  icon: item.icon,
  emoji: item.icon,
  color: categoryColors[index % categoryColors.length]
}))
