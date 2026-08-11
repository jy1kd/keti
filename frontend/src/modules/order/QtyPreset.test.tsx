import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QtyPreset } from './QtyPreset'

describe('QtyPreset（P3 快捷手数预设）', () => {
  it('渲染 1 / 20 / 50 / 100 分段按钮', () => {
    render(<QtyPreset step={1} onSelect={vi.fn()} />)
    for (const p of ['1', '20', '50', '100']) {
      expect(screen.getByText(p)).toBeInTheDocument()
    }
  })

  it('点击预设 → onSelect(该预设原始值)', () => {
    const onSelect = vi.fn()
    render(<QtyPreset step={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('20'))
    expect(onSelect).toHaveBeenCalledWith(20)
    fireEvent.click(screen.getByText('100'))
    expect(onSelect).toHaveBeenCalledWith(100)
  })

  it('步进基准对应的预设按钮高亮（active）', () => {
    render(<QtyPreset step={50} onSelect={vi.fn()} />)
    expect(screen.getByText('50').className).toContain('qty-preset__btn--active')
    expect(screen.getByText('1').className).not.toContain('qty-preset__btn--active')
  })

  it('切换步进基准后高亮跟随（点 20 → 手数 40 仍高亮 20；点 1 → 高亮切到 1）', () => {
    const { rerender } = render(<QtyPreset step={20} onSelect={vi.fn()} />)
    expect(screen.getByText('20').className).toContain('qty-preset__btn--active')
    // 手数被 + 到 40：步进基准仍 20 → 20 持续高亮
    rerender(<QtyPreset step={20} onSelect={vi.fn()} />)
    expect(screen.getByText('20').className).toContain('qty-preset__btn--active')
    // 点 1 → 步进基准切到 1
    rerender(<QtyPreset step={1} onSelect={vi.fn()} />)
    expect(screen.getByText('1').className).toContain('qty-preset__btn--active')
    expect(screen.getByText('20').className).not.toContain('qty-preset__btn--active')
  })
})
