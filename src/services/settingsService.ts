import { readStorage, storageKeys, writeStorage } from './storage'

export type Settings = {
  voiceRecognitionEnabled: boolean
  darkModeEnabled: boolean
}

const defaultSettings: Settings = {
  voiceRecognitionEnabled: true,
  darkModeEnabled: false
}

export const getSettings = (): Settings => {
  const stored = readStorage<Settings | null>(storageKeys.settings, null)
  if (!stored) {
    writeStorage(storageKeys.settings, defaultSettings)
    return defaultSettings
  }
  return {
    ...defaultSettings,
    ...stored
  }
}

export const updateSettings = (partial: Partial<Settings>) => {
  const current = getSettings()
  const next = {
    ...current,
    ...partial
  }
  writeStorage(storageKeys.settings, next)
  return next
}
