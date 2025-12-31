import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getSettings } from '../services/settingsService'

type ThemeMode = 'light' | 'dark'

const themeToNavColors = (theme: ThemeMode) => ({
  frontColor: theme === 'dark' ? '#ffffff' : '#000000',
  backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff'
})

export const applyTheme = (theme: ThemeMode) => {
  const colors = themeToNavColors(theme)
  Taro.setNavigationBarColor(colors)
}

export const useThemeClass = () => {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    getSettings().darkModeEnabled ? 'dark' : 'light'
  )

  useDidShow(() => {
    const next = getSettings().darkModeEnabled ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
  })

  return theme === 'dark' ? 'theme-dark' : 'theme-light'
}
