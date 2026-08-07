import './QtyPreset.css'

const PRESETS = [1, 20, 50, 100]

interface QtyPresetProps {
  /** 当前手数（命中预设值高亮） */
  value: number
  /** 数量上限（期货 500 / 市价 60 / 期权 100）：预设超限时钳制到上限 */
  limit?: number
  /** 选中手数（已按 limit 钳制） */
  onSelect: (volume: number) => void
}

/**
 * QtyPreset — 快捷手数预设（P3 ③ 参数区）
 *
 * `1 20 50 100` 分段按钮，点击即填入手数；当前手数命中预设值高亮。
 * 预设超过数量上限（如市价单 60 手）时钳制到上限，与手数步进行为一致。
 */
export function QtyPreset({ value, limit, onSelect }: QtyPresetProps) {
  const pick = (p: number) => onSelect(limit !== undefined && p > limit ? limit : p)

  return (
    <div className="qty-preset" data-testid="qty-preset">
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          className={`qty-preset__btn${value === p ? ' qty-preset__btn--active' : ''}`}
          data-testid={`qty-preset-${p}`}
          onClick={() => pick(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
