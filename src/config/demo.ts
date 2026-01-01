import Taro from '@tarojs/taro'

const getEnvVersion = () => {
  try {
    const info = Taro.getAccountInfoSync?.()
    return info?.miniProgram?.envVersion
  } catch (error) {
    return undefined
  }
}

const readLocalToggle = () => {
  try {
    const value = Taro.getStorageSync('demo_data_enabled')
    if (value === '' || value === undefined) {
      return undefined
    }
    return Boolean(value)
  } catch (error) {
    return undefined
  }
}

const envVersion = getEnvVersion()
const isRelease = envVersion === 'release'
const localToggle = readLocalToggle()

export const demoDataEnabled = localToggle ?? !isRelease
