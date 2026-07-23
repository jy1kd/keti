import { useState } from 'react'
import type { HotKeyConfig } from '../../services/types'
import { DEFAULT_HOT_KEYS } from '../../stores/userPrefs'
import './styles.css'

interface QuickKeysProps {
  hotKeys: HotKeyConfig
  onSave: (hotKeys: HotKeyConfig) => void
  onClose?: () => void
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'Tab', 'Escape'])

const LABELS: Record<string, string> = {
  buy: '买入',
  sell: '卖出',
  cancel: '撤单',
}

export function QuickKeys({ hotKeys, onSave, onClose }: QuickKeysProps) {
  const [localHotKeys, setLocalHotKeys] = useState<HotKeyConfig>({ ...hotKeys })
  const [editing, setEditing] = useState<string | null>(null)

  function handleFocus(action: string) {
    setEditing(action)
  }

  function handleBlur() {
    setEditing(null)
  }

  function handleKeyDown(action: string) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (MODIFIER_KEYS.has(e.key)) return

      e.preventDefault()
      setLocalHotKeys((prev) => ({ ...prev, [action]: e.key }))
      setEditing(null)
    }
  }

  function handleSave() {
    onSave(localHotKeys)
  }

  function handleReset() {
    setLocalHotKeys({ ...DEFAULT_HOT_KEYS })
    onSave({ ...DEFAULT_HOT_KEYS })
  }

  return (
    <div className="quick-keys">
      <div className="quick-keys-header">
        <h3>快捷键设置</h3>
        <div className="quick-keys-header-actions">
          <button type="button" className="qk-save-btn" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="qk-reset-btn" onClick={handleReset}>
            恢复默认
          </button>
          {onClose && (
            <button type="button" className="qk-close-btn" onClick={onClose}>
              关闭
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="quick-keys-hint">按下新快捷键...</div>
      )}

      <div className="quick-keys-list">
        {Object.entries(LABELS).map(([action, label]) => (
          <div key={action} className="qk-row">
            <label className="qk-label">{label}</label>
            <input
              type="text"
              className={`qk-input ${editing === action ? 'recording' : ''}`}
              value={localHotKeys[action] ?? ''}
              readOnly
              onFocus={() => handleFocus(action)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown(action)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
