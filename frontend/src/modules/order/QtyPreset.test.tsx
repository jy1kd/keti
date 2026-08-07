import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QtyPreset } from './QtyPreset'

describe('QtyPreset（P3 快捷手数预设）', () => {
  it('渲染 1 / 20 / 50 / 100 分段按钮', () => {
    render(<QtyPreset value={1} onSelect={vi.fn()} />)
    for (const p of ['1', '20', '50', '100']) {
      expect(screen.getByText(p)).toBeInTheDocument()
    }
  })

  it('点击预设 → onSelect(该手数)', () => {
    const onSelect = vi.fn()
    render(<QtyPreset value={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('20'))
    expect(onSelect).toHaveBeenCalledWith(20)
    fireEvent.click(screen.getByText('100'))
    expect(onSelect).toHaveBeenCalledWith(100)
  })

  it('当前手数对应的预设按钮高亮（active）', () => {
    render(<QtyPreset value={50} onSelect={vi.fn()} />)
    const btn50 = screen.getByText('50')
    expect(btn50.className).toContain('qty-preset__btn--active')
    const btn1 = screen.getByText('1')
    expect(btn1.className).not.toContain('qty-preset__btn--active')
  })

  it('预设超过数量上限 → 点击钳制到上限（市价单 60 手）', () => {
    const onSelect = vi.fn()
    render(<QtyPreset value={1} limit={60} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('100'))
    expect(onSelect).toHaveBeenCalledWith(60)
  })

  it('预设未超限 → 不钳制', () => {
    const onSelect = vi.fn()
    render(<QtyPreset value={1} limit={60} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('50'))
    expect(onSelect).toHaveBeenCalledWith(50)
  })
})
