import type { TransactionType } from '../models/types'
import { getExpenseCategories, getIncomeCategories } from '../models/types'

export type ParsedTransaction = {
  amount: number
  type: TransactionType
  categoryId: number
  description: string
}

const incomeKeywords = [
  '收入', '赚', '到账', '收到了', '收到', '进账', '入账', '入賬', '转入', '打进',
  '工资', '薪水', '薪资', '发薪', '奖金', '提成', '红包', '报销', '退税', '退款'
]

const expenseKeywords = [
  '支出', '花', '花了', '花费', '花掉', '消费', '买', '购', '购买', '付', '支付', '支', '转出',
  '扣款', '充值', '花去', '花上', '交', '缴费', '还款', '请客', '订', '订了'
]

const expenseCategoryKeywords: Array<[number, string[]]> = [
  [1, ['餐', '饭', '早餐', '午餐', '晚餐', '夜宵', '吃', '外卖', '奶茶', '饮料', '咖啡']],
  [2, ['购物', '买东西', '买了', '下单', '拼多多', '淘宝', '京东', '衣服', '鞋子', '美妆']],
  [3, ['交通', '打车', '乘车', '地铁', '公交', '滴滴', '出租车', '高铁', '机票', '火车']],
  [4, ['娱乐', '电影', '游戏', 'KTV', '唱歌', '剧本杀', '游乐', '演唱会', '音乐会']],
  [5, ['医疗', '医院', '挂号', '看病', '药', '体检', '医保', '感冒']],
  [6, ['教育', '学费', '培训', '课程', '报名费', '教材', '考试']],
  [7, ['旅游', '出差', '机票', '酒店', '门票', '旅行']],
  [8, ['其他', '杂项', '生活费', '随礼', '礼金', '缴费']]
]

const incomeCategoryKeywords: Array<[number, string[]]> = [
  [101, ['工资', '薪水', '薪资', '月薪', '发工资', '发薪']],
  [102, ['奖金', '年终奖', '提成', '红包', '奖励', '补贴']],
  [103, ['投资', '收益', '理财', '基金', '分红', '股票', '回款', '利息']],
  [104, ['收入', '进账', '收款', '退款', '退回', '报销']]
]

export const parseRecognitionResult = (text: string): ParsedTransaction | null => {
  const normalized = text
    .replace(/人民币/gi, '元')
    .replace(/块钱/gi, '元')
    .replace(/块兒/gi, '元')
    .replace(/块/gi, '元')
    .replace(/[：。，]/g, ' ')
    .trim()

  const amountRegex = /(-?\d+(?:[.,]\d{1,2})?)\s*(?:元|rmb|人民币)?/i
  const match = normalized.match(amountRegex)
  const amount = match?.[1]
    ?.replace(',', '.')
    ?.toString()
    .trim()

  const numberAmount = amount ? Math.abs(Number.parseFloat(amount)) : null
  const chineseAmount = parseChineseAmount(normalized)
  const finalAmount = numberAmount || chineseAmount

  if (!finalAmount) {
    return null
  }

  const type = resolveTransactionType(normalized)
  const categoryId = resolveCategory(normalized, type)
  const description = buildDescription(normalized, match?.[0], type, categoryId)

  return {
    amount: finalAmount,
    type,
    categoryId,
    description
  }
}

const parseChineseAmount = (text: string): number | null => {
  const match = text.match(/([零一二三四五六七八九十百千万点〇两]+)\s*(?:元|块)?/)
  const token = match?.[1]
  if (!token) return null
  const number = chineseToNumber(token)
  return number ? Math.abs(number) : null
}

const chineseToNumber = (raw: string): number | null => {
  if (!raw) return null
  const digits: Record<string, number> = {
    零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9
  }
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }

  const [integerPart, fractionalPart] = raw.split('点')
  let total = 0
  let section = 0
  let number = 0

  for (const ch of integerPart) {
    if (digits[ch] !== undefined) {
      number = digits[ch]
    } else if (units[ch]) {
      const unit = units[ch]
      if (number === 0) number = 1
      section += number * unit
      number = 0
    } else if (ch === '万') {
      section = (section + number) * 10000
      total += section
      section = 0
      number = 0
    }
  }

  total += section + number

  if (fractionalPart) {
    let scale = 0.1
    let decimal = 0
    for (const ch of fractionalPart) {
      if (digits[ch] === undefined) break
      decimal += digits[ch] * scale
      scale *= 0.1
    }
    return total + decimal
  }

  return total > 0 ? total : null
}

const resolveTransactionType = (text: string): TransactionType => {
  const lower = text.toLowerCase()
  const incomePositions = incomeKeywords
    .map((keyword) => lower.indexOf(keyword.toLowerCase()))
    .filter((index) => index >= 0)
  const expensePositions = expenseKeywords
    .map((keyword) => lower.indexOf(keyword.toLowerCase()))
    .filter((index) => index >= 0)

  const hasIncome = incomePositions.length > 0
  const hasExpense = expensePositions.length > 0

  if (hasIncome && !hasExpense) return 'INCOME'
  if (!hasIncome && hasExpense) return 'EXPENSE'
  if (hasIncome && hasExpense) {
    const firstIncome = Math.min(...incomePositions)
    const firstExpense = Math.min(...expensePositions)
    return firstIncome <= firstExpense ? 'INCOME' : 'EXPENSE'
  }
  return 'EXPENSE'
}

const resolveCategory = (text: string, type: TransactionType): number => {
  const lower = text.toLowerCase()
  const categoryKeywords = type === 'INCOME' ? incomeCategoryKeywords : expenseCategoryKeywords
  for (const [categoryId, patterns] of categoryKeywords) {
    if (patterns.some((pattern) => lower.includes(pattern.toLowerCase()))) {
      return categoryId
    }
  }
  const fallback = type === 'INCOME' ? getIncomeCategories()[getIncomeCategories().length - 1] : getExpenseCategories()[getExpenseCategories().length - 1]
  return fallback?.id ?? (type === 'INCOME' ? 104 : 8)
}

const buildDescription = (
  original: string,
  amountFragment: string | undefined,
  type: TransactionType,
  categoryId: number
) => {
  let description = original
  if (amountFragment) {
    description = description.replace(amountFragment, '')
  }
  const keywords = [...incomeKeywords, ...expenseKeywords, '元', 'rmb', '人民币', '块']
  keywords.forEach((keyword) => {
    description = description.replace(new RegExp(keyword, 'gi'), '')
  })
  description = description.replace(/\s+/g, ' ').replace(/[：。，]/g, ' ').trim()

  if (description.length > 20) {
    description = `${description.slice(0, 20)}...`
  }

  if (!description) {
    const categoryList = type === 'INCOME' ? getIncomeCategories() : getExpenseCategories()
    const category = categoryList.find((item) => item.id === categoryId)
    return `${category?.desc ?? '语音'}语音记账`
  }

  return description
}
