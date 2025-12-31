import type { Category } from '../models/category'
import { defaultCategories } from '../models/category'
import { readStorage, storageKeys, writeStorage } from './storage'

export const getCategories = (): Category[] => {
  const categories = readStorage<Category[]>(storageKeys.categories, [])
  if (categories.length === 0) {
    writeStorage(storageKeys.categories, defaultCategories)
    return defaultCategories
  }
  return categories
}

export const setCategories = (categories: Category[]) => {
  writeStorage(storageKeys.categories, categories)
}
