import { useState } from 'react'
import { HotKeyTab } from './HotKeyTab'
import { QuickTradeTab } from './QuickTradeTab'
import { useUserPrefsStore } from '../../stores/userPrefs'
import { toast } from '../Toast'
import type { HotKeyConfig, QuickTradeConfig } from '../../services/types'
import './styles.css'

type SettingsTab = 'hotkey' | 'quicktrade'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('quicktrade')
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)
  const quickTradeConfig = useUserPrefsStore((s) => s.quickTradeConfig)

  function handleSaveHotKeys(newHotKeys: HotKeyConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setHotKeys(newHotKeys)
    prefs.saveToLocalStorage()
    toast.success('快捷键已保存')
  }

  function handleSaveQuickTrade(config: QuickTradeConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setQuickTradeConfig(config)
    prefs.saveToLocalStorage()
    toast.success('快捷交易设置已保存')
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <div className="settings-panel-tabs">
          <button
            type="button"
            className={`settings-tab-btn ${tab === 'hotkey' ? 'active' : ''}`}
            onClick={() => setTab('hotkey')}
          >
            快捷键
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${tab === 'quicktrade' ? 'active' : ''}`}
            onClick={() => setTab('quicktrade')}
          >
            快捷交易
          </button>
        </div>
        <button type="button" className="settings-close-btn" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="settings-panel-content">
        {tab === 'hotkey' ? (
          <HotKeyTab hotKeys={hotKeys} onSave={handleSaveHotKeys} />
        ) : (
          <QuickTradeTab config={quickTradeConfig} onSave={handleSaveQuickTrade} />
        )}
      </div>
    </div>
  )
}
