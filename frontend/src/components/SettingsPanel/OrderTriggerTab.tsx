import { useState } from 'react'
import type { OrderTriggerConfig } from '../../services/types'
import { DEFAULT_ORDER_TRIGGER } from '../../stores/userPrefs'

interface OrderTriggerTabProps {
  config: OrderTriggerConfig
  onSave: (config: OrderTriggerConfig) => void
}

export function OrderTriggerTab({ config, onSave }: OrderTriggerTabProps) {
  const [local, setLocal] = useState<OrderTriggerConfig>({ ...config })

  function handleSave() {
    onSave(local)
  }

  function handleReset() {
    setLocal({ ...DEFAULT_ORDER_TRIGGER })
  }

  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-group-header">
          <span className="settings-group-title">盘口下单触发</span>
          <button type="button" className="settings-reset-btn" onClick={handleReset}>
            恢复默认
          </button>
        </div>
        <p className="settings-desc">应用于五档下单与无限下单的盘口档位点击。快捷买卖栏不受此设置影响。</p>

        <div className="settings-row">
          <label className="settings-label">触发方式</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input
                type="radio"
                name="trigger-mode"
                value="single"
                checked={local.triggerMode === 'single'}
                onChange={() => setLocal((p) => ({ ...p, triggerMode: 'single' }))}
              />
              单次点击触发
            </label>
            <label className="settings-radio">
              <input
                type="radio"
                name="trigger-mode"
                value="double"
                checked={local.triggerMode === 'double'}
                onChange={() => setLocal((p) => ({ ...p, triggerMode: 'double' }))}
              />
              双击触发
            </label>
          </div>
        </div>

        {local.triggerMode === 'double' && (
          <div className="settings-hint">双击模式下，单击档位仅预览不报单，快速双击才触发下单。</div>
        )}

        <div className="settings-row">
          <label className="settings-label">二次确认</label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              aria-label="下单前确认"
              checked={local.confirmBeforeOrder}
              onChange={(e) => setLocal((p) => ({ ...p, confirmBeforeOrder: e.target.checked }))}
            />
            下单前弹窗确认
          </label>
        </div>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-save-btn" onClick={handleSave}>
          保存
        </button>
      </div>
    </div>
  )
}
