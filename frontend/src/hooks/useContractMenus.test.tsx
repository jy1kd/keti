import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useContractMenus } from './useContractMenus'

const ctx = { instrumentID: 'au2406', price: 100, x: 10, y: 20 }
const multi = { instrumentIDs: ['au2406', 'rb2406'], x: 10, y: 20 }

function Harness({ favoriteMode, favoritedIds, onOpenFavoritePicker, onRemoveFromAll, onToggleInFolder, onRemoveFromFolderBatch }: any) {
  const { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel } = useContractMenus({
    contextMenu: ctx,
    multiSelectMenu: multi,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup: vi.fn(),
    openQueryPopup: vi.fn(),
    openKlineTab: vi.fn(),
    openOrderTabs: vi.fn(),
    openKlineTabs: vi.fn(),
    closeMenus: vi.fn(),
  } as any)
  return (
    <>
      {singleMenu}
      {multiMenu}
      <button data-testid="batch" onClick={() => batchToggleFavorite('au2406', new Set())}>
        {favoriteButtonLabel('au2406', new Set())}
      </button>
    </>
  )
}

describe('useContractMenus 收藏双模式', () => {
  it('picker 模式：单选右键「收藏到收藏夹…」打开面板；批量菜单含「批量收藏到收藏夹…」与「批量取消收藏」', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set(['au2406'])} onOpenFavoritePicker={onOpen} onRemoveFromAll={vi.fn()} />)
    expect(screen.getByText('收藏到收藏夹…')).toBeDefined()
    fireEvent.click(screen.getByText('收藏到收藏夹…'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
    expect(screen.getByText(/批量收藏到收藏夹…/)).toBeDefined()
    expect(screen.getByText(/批量取消收藏/)).toBeDefined()
  })

  it('picker 模式：工具栏批量收藏 → onOpenFavoritePicker(选中集)；label=批量收藏', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set()} onOpenFavoritePicker={onOpen} />)
    expect(screen.getByTestId('batch').textContent).toBe('收藏') // 未收藏单选
    fireEvent.click(screen.getByTestId('batch'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
  })

  it('folder 模式：单选右键「从本夹移除」；批量「批量从本夹移除」，无「批量收藏到收藏夹…」', () => {
    const onToggle = vi.fn()
    render(<Harness favoriteMode="folder" favoritedIds={new Set(['au2406'])} onToggleInFolder={onToggle} />)
    expect(screen.getByText('从本夹移除')).toBeDefined()
    fireEvent.click(screen.getByText('从本夹移除'))
    expect(onToggle).toHaveBeenCalledWith('au2406')
    expect(screen.queryByText(/批量收藏到收藏夹…/)).toBeNull()
    expect(screen.getByText(/批量从本夹移除/)).toBeDefined()
  })
})
