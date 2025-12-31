export type TransactionType = 'INCOME' | 'EXPENSE'

export type CategoryType = {
  id: number
  desc: string
  icon: string
  type: TransactionType
}

export const categoryTypes: CategoryType[] = [
  { id: 1, desc: '餐饮', icon: '🍽️', type: 'EXPENSE' },
  { id: 2, desc: '购物', icon: '🛍️', type: 'EXPENSE' },
  { id: 3, desc: '交通', icon: '🚗', type: 'EXPENSE' },
  { id: 4, desc: '娱乐', icon: '🎮', type: 'EXPENSE' },
  { id: 5, desc: '医疗', icon: '🏥', type: 'EXPENSE' },
  { id: 6, desc: '教育', icon: '📚', type: 'EXPENSE' },
  { id: 7, desc: '旅游', icon: '✈️', type: 'EXPENSE' },
  { id: 8, desc: '其他支出', icon: '💰', type: 'EXPENSE' },
  { id: 101, desc: '工资', icon: '💼', type: 'INCOME' },
  { id: 102, desc: '奖金', icon: '🎁', type: 'INCOME' },
  { id: 103, desc: '投资收益', icon: '📈', type: 'INCOME' },
  { id: 104, desc: '其他收入', icon: '💳', type: 'INCOME' }
]

export const getCategoryById = (id: number) =>
  categoryTypes.find((item) => item.id === id)

export const getExpenseCategories = () =>
  categoryTypes.filter((item) => item.type === 'EXPENSE')

export const getIncomeCategories = () =>
  categoryTypes.filter((item) => item.type === 'INCOME')
