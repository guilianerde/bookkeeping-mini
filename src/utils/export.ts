import Taro from '@tarojs/taro'

const ensureUserDataPath = () => {
  const userDataPath = Taro.env.USER_DATA_PATH
  if (!userDataPath) {
    throw new Error('无法获取本地文件路径')
  }
  return userDataPath
}

const writeTextFile = (fileName: string, content: string) => {
  const fs = Taro.getFileSystemManager()
  const filePath = `${ensureUserDataPath()}/${fileName}`
  fs.writeFileSync(filePath, content, 'utf8')
  return filePath
}

const escapeCsv = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export const exportJSON = (fileName: string, data: unknown) => {
  const content = JSON.stringify(data, null, 2)
  return writeTextFile(fileName, content)
}

export const exportCSV = (fileName: string, rows: Array<Array<string | number | null | undefined>>) => {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
  const withBom = `\uFEFF${csv}`
  return writeTextFile(fileName, withBom)
}

export const showExportResult = async (filePath: string) => {
  const result = await Taro.showModal({
    title: '导出完成',
    content: `已导出到：${filePath}\\n可在开发者工具的本地文件中查看。`,
    confirmText: '打开',
    cancelText: '关闭'
  })

  if (result.confirm) {
    try {
      await Taro.openDocument({
        filePath,
        showMenu: true
      })
    } catch (error) {
      Taro.showToast({ title: '无法打开该文件', icon: 'none' })
    }
  }
}
