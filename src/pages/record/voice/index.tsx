import { View, Text, Button, Textarea, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import './index.scss'
import { voiceAsrConfig } from '../../../config/voice'
import { parseRecognitionResult } from '../../../utils/voiceParser'
import { addTransaction } from '../../../services/transactionService'
import { formatAmount } from '../../../utils/format'
import { getCategoryById, getExpenseCategories, getIncomeCategories } from '../../../models/types'
import { getSettings } from '../../../services/settingsService'
import { useThemeClass } from '../../../utils/theme'
import Card from '../../../components/ui/Card'
import PrimaryButton from '../../../components/ui/PrimaryButton'

type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'parsed' | 'error'

export default function VoiceRecordPage() {
  const themeClass = useThemeClass()
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [recognizedText, setRecognizedText] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryIndex, setEditCategoryIndex] = useState(0)
  const [editDescription, setEditDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<number | null>(null)
  const recorderManager = useRef(Taro.getRecorderManager())

  useDidShow(() => {
    const settings = getSettings()
    if (!settings.voiceRecognitionEnabled) {
      Taro.showToast({ title: '语音记账已关闭', icon: 'none' })
    }
  })

  const parsed = useMemo(() => {
    if (!recognizedText.trim()) return null
    return parseRecognitionResult(recognizedText)
  }, [recognizedText])

  const categoryOptions = useMemo(() => {
    if (!parsed) return []
    return parsed.type === 'INCOME' ? getIncomeCategories() : getExpenseCategories()
  }, [parsed])

  useEffect(() => {
    if (!parsed) return
    setEditAmount(parsed.amount.toFixed(2))
    const list = parsed.type === 'INCOME' ? getIncomeCategories() : getExpenseCategories()
    const idx = list.findIndex((item) => item.id === parsed.categoryId)
    setEditCategoryIndex(idx >= 0 ? idx : 0)
    setEditDescription(parsed.description)
  }, [parsed])

  const startTimer = () => {
    setDuration(0)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1)
    }, 1000) as unknown as number
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleStart = () => {
    if (!getSettings().voiceRecognitionEnabled) {
      Taro.showToast({ title: '语音记账已关闭', icon: 'none' })
      return
    }
    if (!voiceAsrConfig.endpoint) {
      Taro.showModal({
        title: '未配置语音识别接口',
        content: '请在 src/config/voice.ts 中填写 endpoint 后再使用语音记账。',
        showCancel: false
      })
      return
    }

    setRecognizedText('')
    setErrorMessage('')
    const startRecording = () => {
      setStatus('recording')
      startTimer()
      recorderManager.current.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        format: 'wav'
      })
    }

    Taro.getSetting()
      .then((setting) => {
        if (!setting.authSetting['scope.record']) {
          return Taro.authorize({ scope: 'scope.record' })
        }
        return Promise.resolve()
      })
      .then(startRecording)
      .catch(() => {
        setStatus('error')
        setErrorMessage('录音权限未授权')
      })
  }

  const handleStop = () => {
    recorderManager.current.stop()
  }

  const handleUpload = async (filePath: string) => {
    setStatus('uploading')
    try {
      const result = await Taro.uploadFile({
        url: voiceAsrConfig.endpoint,
        filePath,
        name: voiceAsrConfig.fileField,
        header: voiceAsrConfig.headers
      })
      let data: any = result.data
      if (typeof result.data === 'string') {
        try {
          data = JSON.parse(result.data)
        } catch {
          data = { text: result.data }
        }
      }
      const text = data?.[voiceAsrConfig.responseTextKey] ?? data?.text ?? data?.result
      if (!text) {
        throw new Error('识别结果为空')
      }
      setRecognizedText(text)
      setStatus('parsed')
    } catch (error) {
      setErrorMessage('识别失败，请重试或手动输入文本。')
      setStatus('error')
    }
  }

  const handleSave = () => {
    if (!parsed) {
      Taro.showToast({ title: '无法解析内容', icon: 'none' })
      return
    }
    const amountValue = Number.parseFloat(editAmount)
    if (!amountValue || amountValue <= 0) {
      Taro.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    const categories = parsed.type === 'INCOME' ? getIncomeCategories() : getExpenseCategories()
    const selectedCategory = categories[editCategoryIndex]
    addTransaction({
      type: parsed.type,
      amount: amountValue,
      categoryId: selectedCategory?.id ?? parsed.categoryId,
      description: editDescription.trim() || parsed.description || recognizedText.slice(0, 20)
    })
    Taro.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 400)
  }

  const handleParseText = () => {
    if (!recognizedText.trim()) {
      Taro.showToast({ title: '请输入要解析的文本', icon: 'none' })
      return
    }
    if (parsed) {
      setStatus('parsed')
      setErrorMessage('')
      return
    }
    setStatus('error')
    setErrorMessage('无法解析文本，请检查描述格式')
  }

  useEffect(() => {
    const manager = recorderManager.current
    const handleStopInternal = (res) => {
      stopTimer()
      if (res.tempFilePath) {
        handleUpload(res.tempFilePath)
      } else {
        setStatus('error')
        setErrorMessage('录音失败，请重试')
      }
    }
    const handleErrorInternal = () => {
      stopTimer()
      setStatus('error')
      setErrorMessage('录音失败，请检查权限')
    }

    manager.onStop(handleStopInternal)
    manager.onError(handleErrorInternal)

    return () => {
      stopTimer()
      manager.offStop(handleStopInternal)
      manager.offError(handleErrorInternal)
    }
  }, [])

  return (
    <View className={`page ${themeClass}`}>
      <View className="page__header">
        <Text className="page__title">语音记账</Text>
        <Text className="page__subtitle">说出你的记账内容</Text>
      </View>

      <View className={`status-banner status-banner--${status}`}>
        <View className="status-banner__left">
          <View className={`status-dot status-dot--${status}`} />
          <Text className="status-text">
            {status === 'idle' && '准备就绪，点击开始录音'}
            {status === 'recording' && '录音中，建议控制在 60 秒内'}
            {status === 'uploading' && '识别中，请稍候'}
            {status === 'parsed' && '识别完成，可编辑后保存'}
            {status === 'error' && (errorMessage || '识别失败，请重试')}
          </Text>
        </View>
        <Text className="status-timer">{status === 'recording' ? `${duration}s` : ''}</Text>
      </View>

      <Card title="录音控制" subtitle={`录音时长 ${duration}s`}>
        <View className="voice-actions">
          <Button className="voice-button voice-button--start" onClick={handleStart} disabled={status === 'recording'}>
            开始录音
          </Button>
          <Button className="voice-button voice-button--stop" onClick={handleStop} disabled={status !== 'recording'}>
            停止录音
          </Button>
        </View>
        <View className={`waveform waveform--${status}`}>
          <View className="waveform__bar" />
          <View className="waveform__bar" />
          <View className="waveform__bar" />
          <View className="waveform__bar" />
          <View className="waveform__bar" />
        </View>
      </Card>

      <Card title="识别文本" subtitle="可手动修改后解析">
        <Textarea
          className="voice-text"
          value={recognizedText}
          onInput={(event) => setRecognizedText(event.detail.value)}
          placeholder="识别文本将显示在这里"
          placeholderClass="voice-text__placeholder"
        />
        <View className="voice-parse-button">
          <PrimaryButton text="解析文本" onClick={handleParseText} />
        </View>
      </Card>

      <Card title="解析结果" subtitle={parsed ? '可直接保存' : '请输入可解析内容'}>
        {parsed ? (
          <View className="parsed-summary">
            <View className="parsed-row">
              <Text className="parsed-label">类型</Text>
              <Text className="parsed-value">{parsed.type === 'INCOME' ? '收入' : '支出'}</Text>
            </View>
            <View className="parsed-row">
              <Text className="parsed-label">金额</Text>
              <Input
                className="parsed-input"
                type="digit"
                value={editAmount}
                onInput={(event) => setEditAmount(event.detail.value)}
              />
            </View>
            <View className="parsed-row">
              <Text className="parsed-label">分类</Text>
              <Picker mode="selector" range={categoryOptions.map((item) => item.desc)} value={editCategoryIndex} onChange={(event) => setEditCategoryIndex(event.detail.value)}>
                <View className="picker-field">
                  <Text className="picker-field__text">{categoryOptions[editCategoryIndex]?.desc ?? '未分类'}</Text>
                  <Text className="picker-field__icon">▾</Text>
                </View>
              </Picker>
            </View>
            <View className="parsed-row">
              <Text className="parsed-label">备注</Text>
              <Input
                className="parsed-input"
                value={editDescription}
                onInput={(event) => setEditDescription(event.detail.value)}
              />
            </View>
          </View>
        ) : (
          <Text className="parsed-empty">请输入如“午餐花了25元”</Text>
        )}
      </Card>

      <PrimaryButton text="保存" onClick={handleSave} />
    </View>
  )
}
