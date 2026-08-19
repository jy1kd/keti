import { useState } from 'react'
import { HotKeyTab } from '../components/SettingsPanel/HotKeyTab'
import { OrderTriggerTab } from '../components/SettingsPanel/OrderTriggerTab'
import { useUserPrefsStore } from '../stores/userPrefs'
import { toast } from '../components/Toast'
import type { HotKeyConfig, OrderTriggerConfig } from '../services/types'
import '../components/SettingsPanel/styles.css'

type SettingsTab = 'hotkey' | 'ordertrigger'

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('hotkey')
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)
  const orderTrigger = useUserPrefsStore((s) => s.orderTrigger)

  function handleSaveHotKeys(newHotKeys: HotKeyConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setHotKeys(newHotKeys)
    prefs.saveToLocalStorage()
    toast.success('快捷键已保存')
  }

  function handleSaveOrderTrigger(config: OrderTriggerConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setOrderTrigger(config)
    prefs.saveToLocalStorage()
    toast.success('下单触发设置已保存')
  }

  return (
    <div className="settings-panel">
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
          className={`settings-tab-btn ${tab === 'ordertrigger' ? 'active' : ''}`}
          onClick={() => setTab('ordertrigger')}
        >
          下单触发
        </button>
      </div>

      <div className="settings-panel-content">
        {tab === 'hotkey' ? (
          <HotKeyTab hotKeys={hotKeys} onSave={handleSaveHotKeys} />
        ) : (
          <OrderTriggerTab config={orderTrigger} onSave={handleSaveOrderTrigger} />
        )}
      </div>
    </div>
  )
}
