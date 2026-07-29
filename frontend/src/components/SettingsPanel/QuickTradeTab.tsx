import { useState } from 'react'
import type { QuickTradeConfig } from '../../services/types'
import { DEFAULT_QUICK_TRADE_CONFIG } from '../../stores/userPrefs'

interface QuickTradeTabProps {
  config: QuickTradeConfig
  onSave: (config: QuickTradeConfig) => void
}

export function QuickTradeTab({ config, onSave }: QuickTradeTabProps) {
  const [local, setLocal] = useState<QuickTradeConfig>(JSON.parse(JSON.stringify(config)))

  function handleSave() {
    onSave(local)
  }

  function handleResetLock() {
    setLocal((prev) => ({
      ...prev,
      lock: { ...DEFAULT_QUICK_TRADE_CONFIG.lock },
    }))
  }

  function handleResetReverse() {
    setLocal((prev) => ({
      ...prev,
      reverse: { ...DEFAULT_QUICK_TRADE_CONFIG.reverse },
    }))
  }

  function handleResetAll() {
    setLocal(JSON.parse(JSON.stringify(DEFAULT_QUICK_TRADE_CONFIG)))
  }

  return (
    <div className="settings-section">
      {/* ── 一键锁仓 ── */}
      <div className="settings-group">
        <div className="settings-group-header">
          <span className="settings-group-title">一键锁仓</span>
          <button type="button" className="settings-reset-btn" onClick={handleResetLock}>
            恢复默认
          </button>
        </div>

        <div className="settings-row">
          <label className="settings-label">成交模式</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input
                type="radio"
                name="lock-priceMode"
                checked={local.lock.priceMode === 'counterparty'}
                onChange={() => setLocal((p) => ({ ...p, lock: { ...p.lock, priceMode: 'counterparty' } }))}
              />
              对价限价
            </label>
            <label className="settings-radio">
              <input
                type="radio"
                name="lock-priceMode"
                checked={local.lock.priceMode === 'market'}
                onChange={() => setLocal((p) => ({ ...p, lock: { ...p.lock, priceMode: 'market' } }))}
              />
              市价
            </label>
          </div>
        </div>

        {local.lock.priceMode === 'counterparty' && (
          <div className="settings-row">
            <label className="settings-label">限价偏移</label>
            <div className="settings-stepper">
              <button
                type="button"
                className="stepper-btn"
                onClick={() => setLocal((p) => ({ ...p, lock: { ...p.lock, offsetTicks: p.lock.offsetTicks - 1 } }))}
              >
                −
              </button>
              <span className="stepper-value">{local.lock.offsetTicks}</span>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => setLocal((p) => ({ ...p, lock: { ...p.lock, offsetTicks: p.lock.offsetTicks + 1 } }))}
              >
                +
              </button>
              <span className="stepper-unit">跳</span>
            </div>
          </div>
        )}

        <div className="settings-row">
          <label className="settings-label">时间条件</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input
                type="radio"
                name="lock-tc"
                checked={local.lock.timeCondition === 'gfd'}
                onChange={() => setLocal((p) => ({ ...p, lock: { ...p.lock, timeCondition: 'gfd' } }))}
              />
              GFD（当日有效）
            </label>
            <label className="settings-radio">
              <input
                type="radio"
                name="lock-tc"
                checked={local.lock.timeCondition === 'fak'}
                onChange={() => setLocal((p) => ({ ...p, lock: { ...p.lock, timeCondition: 'fak' } }))}
              />
              FAK（立即成交剩余撤）
            </label>
          </div>
        </div>
      </div>

      {/* ── 一键反向 ── */}
      <div className="settings-group">
        <div className="settings-group-header">
          <span className="settings-group-title">一键反向</span>
          <button type="button" className="settings-reset-btn" onClick={handleResetReverse}>
            恢复默认
          </button>
        </div>

        {/* 平仓单 */}
        <div className="settings-subgroup">
          <div className="settings-subgroup-title">平仓单</div>
          <div className="settings-row">
            <label className="settings-label">成交模式</label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-close-priceMode"
                  checked={local.reverse.close.priceMode === 'counterparty'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, close: { ...p.reverse.close, priceMode: 'counterparty' } } }))}
                />
                对价限价
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-close-priceMode"
                  checked={local.reverse.close.priceMode === 'market'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, close: { ...p.reverse.close, priceMode: 'market' } } }))}
                />
                市价
              </label>
            </div>
          </div>
          {local.reverse.close.priceMode === 'counterparty' && (
            <div className="settings-row">
              <label className="settings-label">限价偏移</label>
              <div className="settings-stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, close: { ...p.reverse.close, offsetTicks: p.reverse.close.offsetTicks - 1 } } }))}
                >
                  −
                </button>
                <span className="stepper-value">{local.reverse.close.offsetTicks}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, close: { ...p.reverse.close, offsetTicks: p.reverse.close.offsetTicks + 1 } } }))}
                >
                  +
                </button>
                <span className="stepper-unit">跳</span>
              </div>
            </div>
          )}
          <div className="settings-row">
            <label className="settings-label">时间条件</label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-close-tc"
                  checked={local.reverse.close.timeCondition === 'gfd'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, close: { ...p.reverse.close, timeCondition: 'gfd' } } }))}
                />
                GFD
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-close-tc"
                  checked={local.reverse.close.timeCondition === 'fak'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, close: { ...p.reverse.close, timeCondition: 'fak' } } }))}
                />
                FAK
              </label>
            </div>
          </div>
        </div>

        {/* 开仓单 */}
        <div className="settings-subgroup">
          <div className="settings-subgroup-title">开仓单</div>
          <div className="settings-row">
            <label className="settings-label">成交模式</label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-open-priceMode"
                  checked={local.reverse.open.priceMode === 'counterparty'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, open: { ...p.reverse.open, priceMode: 'counterparty' } } }))}
                />
                对价限价
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-open-priceMode"
                  checked={local.reverse.open.priceMode === 'market'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, open: { ...p.reverse.open, priceMode: 'market' } } }))}
                />
                市价
              </label>
            </div>
          </div>
          {local.reverse.open.priceMode === 'counterparty' && (
            <div className="settings-row">
              <label className="settings-label">限价偏移</label>
              <div className="settings-stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, open: { ...p.reverse.open, offsetTicks: p.reverse.open.offsetTicks - 1 } } }))}
                >
                  −
                </button>
                <span className="stepper-value">{local.reverse.open.offsetTicks}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, open: { ...p.reverse.open, offsetTicks: p.reverse.open.offsetTicks + 1 } } }))}
                >
                  +
                </button>
                <span className="stepper-unit">跳</span>
              </div>
            </div>
          )}
          <div className="settings-row">
            <label className="settings-label">时间条件</label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-open-tc"
                  checked={local.reverse.open.timeCondition === 'gfd'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, open: { ...p.reverse.open, timeCondition: 'gfd' } } }))}
                />
                GFD
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rev-open-tc"
                  checked={local.reverse.open.timeCondition === 'fak'}
                  onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, open: { ...p.reverse.open, timeCondition: 'fak' } } }))}
                />
                FAK
              </label>
            </div>
          </div>
        </div>

        {/* 执行模式 */}
        <div className="settings-row">
          <label className="settings-label">执行模式</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input
                type="radio"
                name="rev-exec"
                checked={local.reverse.executionMode === 'serial'}
                onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, executionMode: 'serial' } }))}
              />
              串行（推荐）
            </label>
            <label className="settings-radio">
              <input
                type="radio"
                name="rev-exec"
                checked={local.reverse.executionMode === 'parallel'}
                onChange={() => setLocal((p) => ({ ...p, reverse: { ...p.reverse, executionMode: 'parallel' } }))}
              />
              并行
            </label>
          </div>
        </div>

        {local.reverse.executionMode === 'parallel' && (
          <div className="settings-warning">
            ⚠ 并行模式同时发送平仓和开仓，若平仓失败开仓成功，可能造成意外锁仓。不建议普通用户开启。
          </div>
        )}
      </div>

      {/* ── 通用设置 ── */}
      <div className="settings-group">
        <div className="settings-group-header">
          <span className="settings-group-title">通用设置</span>
          <button type="button" className="settings-reset-btn" onClick={handleResetAll}>
            全部恢复默认
          </button>
        </div>
        <div className="settings-row">
          <label className="settings-label">二次确认</label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={local.confirmBeforeExecute}
              onChange={(e) => setLocal((p) => ({ ...p, confirmBeforeExecute: e.target.checked }))}
            />
            执行前弹窗确认
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
