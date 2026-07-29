import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickKeys } from './index'
import type { HotKeyConfig } from '../../services/types'

const defaultHotKeys: HotKeyConfig = {
  buy: 'b',
  sell: 's',
  cancel: 'c',
  reverse: '',
  lock: '',
  batchCancel: 'Escape',
}

describe('QuickKeys', () => {
  let onSave: ReturnType<typeof vi.fn>
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onSave = vi.fn()
    onClose = vi.fn()
  })

  it('renders current hotkey bindings', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    expect(screen.getByText(/买入/)).toBeDefined()
    expect(screen.getByText(/卖出/)).toBeDefined()
    expect(screen.getByText(/撤单/)).toBeDefined()
    // Should show current key values
    expect(screen.getByDisplayValue('b')).toBeDefined()
    expect(screen.getByDisplayValue('s')).toBeDefined()
    expect(screen.getByDisplayValue('c')).toBeDefined()
  })

  it('shows "recording" state when input focused', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    const inputs = screen.getAllByRole('textbox')
    const firstInput = inputs[0]!

    fireEvent.focus(firstInput)

    // Should show recording hint
    expect(screen.getByText(/按下新快捷键/)).toBeDefined()
  })

  it('captures key press and updates input value', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    const inputs = screen.getAllByRole('textbox')
    const buyInput = inputs[0]!

    fireEvent.focus(buyInput)
    fireEvent.keyDown(buyInput, { key: 'x' })

    // Input should now show 'x'
    expect((buyInput as HTMLInputElement).value).toBe('x')
  })

  it('ignores modifier-only key presses', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    const inputs = screen.getAllByRole('textbox')
    const buyInput = inputs[0]!

    fireEvent.focus(buyInput)
    fireEvent.keyDown(buyInput, { key: 'Control' })
    fireEvent.keyDown(buyInput, { key: 'Shift' })
    fireEvent.keyDown(buyInput, { key: 'Alt' })
    fireEvent.keyDown(buyInput, { key: 'Meta' })

    // Value should not change for modifier keys
    expect((buyInput as HTMLInputElement).value).toBe('b')
  })

  it('calls onSave with updated hotkeys', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    // Change buy key
    const inputs = screen.getAllByRole('textbox')
    fireEvent.focus(inputs[0]!)
    fireEvent.keyDown(inputs[0]!, { key: 'x' })

    // Click save
    const saveBtn = screen.getByText('保存')
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith({
      buy: 'x',
      sell: 's',
      cancel: 'c',
      reverse: '',
      lock: '',
      batchCancel: 'Escape',
    })
  })

  it('calls onClose when close button clicked', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    const closeBtn = screen.getByText('关闭')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets UI to defaults but does not auto-save', () => {
    render(
      <QuickKeys
        hotKeys={defaultHotKeys}
        onSave={onSave}
        onClose={onClose}
      />
    )

    // First change a key
    const inputs = screen.getAllByRole('textbox')
    fireEvent.focus(inputs[0]!)
    fireEvent.keyDown(inputs[0]!, { key: 'x' })

    expect((inputs[0]! as HTMLInputElement).value).toBe('x')

    // Then reset
    const resetBtn = screen.getByText('恢复默认')
    fireEvent.click(resetBtn)

    // UI should revert to defaults
    expect((inputs[0]! as HTMLInputElement).value).toBe('b')
    // onSave should NOT be called (user must manually save)
    expect(onSave).not.toHaveBeenCalled()
  })
})
