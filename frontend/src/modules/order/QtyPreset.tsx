import './QtyPreset.css'

const PRESETS = [1, 20, 50, 100]

interface QtyPresetProps {
  /** 当前步进基准（命中预设值高亮） */
  step: number
  /** 选中原始预设值（钳制由 TradeParams 统一处理，step 用原始值） */
  onSelect: (volume: number) => void
}

/**
 * QtyPreset — 快捷手数预设（P3 ③ 参数区）
 *
 * `1 20 50 100` 分段按钮，点击选为手数步进基准；当前步进基准命中预设值高亮。
 * 手数钳制（数量上限）由 TradeParams 统一处理。
 */
export function QtyPreset({ step, onSelect }: QtyPresetProps) {
  return (
    <div className="qty-preset" data-testid="qty-preset">
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          className={`qty-preset__btn${step === p ? ' qty-preset__btn--active' : ''}`}
          data-testid={`qty-preset-${p}`}
          onClick={() => onSelect(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
