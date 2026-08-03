import { useState } from 'react'
import { HotKeyTab } from '@/components/SettingsPanel/HotKeyTab'
import { QuickTradeTab } from '@/components/SettingsPanel/QuickTradeTab'
import { useUserPrefsStore } from '@/stores/userPrefs'
import { toast } from '@/components/Toast'
import type { HotKeyConfig, QuickTradeConfig } from '@/services/types'
import '@/components/SettingsPanel/styles.css'

type SettingsTab = 'hotkey' | 'quicktrade'

/**
 * SettingsPage — 设置标签页
 *
 * 集成现有的 HotKeyTab 和 QuickTradeTab 组件，
 * 支持快捷键和快捷交易设置。
 */
export function SettingsPage() {
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
    <div className="settings-page">
      <div className="settings-page__header">
        <h2>⚙ 设置</h2>
        <div className="settings-page__tabs">
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
      </div>

      <div className="settings-page__content">
        {tab === 'hotkey' ? (
          <HotKeyTab hotKeys={hotKeys} onSave={handleSaveHotKeys} />
        ) : (
          <QuickTradeTab config={quickTradeConfig} onSave={handleSaveQuickTrade} />
        )}
      </div>
    </div>
  )
}
