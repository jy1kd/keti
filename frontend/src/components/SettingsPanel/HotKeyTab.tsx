import { useState } from 'react'
import type { HotKeyConfig } from '../../services/types'
import { DEFAULT_HOT_KEYS } from '../../stores/userPrefs'

interface HotKeyTabProps {
  hotKeys: HotKeyConfig
  onSave: (hotKeys: HotKeyConfig) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'Tab', 'Escape'])

const LABELS: Record<string, string> = {
  // 导航快捷键
  openOrder: '打开报单',
  openKline: '打开K线',
  openSettings: '打开设置',
  // 操作快捷键
  batchCancel: '批量撤单',
}

export function HotKeyTab({ hotKeys, onSave }: HotKeyTabProps) {
  const [localHotKeys, setLocalHotKeys] = useState<HotKeyConfig>({ ...hotKeys })
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

  function handleFocus(action: string) {
    setEditing(action)
    setError('')
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

  function handleClear(action: string) {
    setLocalHotKeys((prev) => ({ ...prev, [action]: '' }))
    setError('')
  }

  function handleSave() {
    // Check for duplicate key bindings (ignore empty)
    const entries = Object.entries(localHotKeys).filter(([, key]) => key)
    const keys = entries.map(([, key]) => key)
    const uniqueKeys = new Set(keys)
    if (uniqueKeys.size !== keys.length) {
      const seen = new Map<string, string>()
      for (const [action, key] of entries) {
        if (seen.has(key)) {
          const conflict = seen.get(key)!
          setError(`快捷键冲突：${LABELS[conflict] ?? conflict} 和 ${LABELS[action] ?? action} 都使用了 "${key}"`)
          return
        }
        seen.set(key, action)
      }
    }
    setError('')
    onSave(localHotKeys)
  }

  function handleReset() {
    setLocalHotKeys({ ...DEFAULT_HOT_KEYS })
    setError('')
  }

  return (
    <div className="settings-section">
      {error && <div className="settings-error">{error}</div>}
      {editing && <div className="settings-hint">按下新快捷键...（按 Esc 清除）</div>}

      <div className="settings-list">
        {Object.entries(LABELS).map(([rawAction, label]) => {
          const action = rawAction as keyof HotKeyConfig
          return (
          <div key={action} className="settings-row">
            <label className="settings-label">{label}</label>
            <div className="settings-hotkey-input-group">
              <input
                type="text"
                className={`settings-input ${editing === action ? 'recording' : ''}`}
                value={localHotKeys[action] ? _displayKey(localHotKeys[action]) : '未设置'}
                readOnly
                onFocus={() => handleFocus(action)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown(action)}
              />
              {localHotKeys[action] && (
                <button
                  type="button"
                  className="settings-clear-btn"
                  onClick={() => handleClear(action)}
                  title="清除快捷键"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          )
        })}
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-save-btn" onClick={handleSave}>
          保存
        </button>
        <button type="button" className="settings-reset-btn" onClick={handleReset}>
          恢复默认
        </button>
      </div>
    </div>
  )
}

function _displayKey(key: string): string {
  if (key === 'Escape') return 'Esc'
  if (key === ' ') return 'Space'
  return key.toUpperCase()
}
