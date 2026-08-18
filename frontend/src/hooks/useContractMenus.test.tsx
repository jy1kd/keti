import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useContractMenus } from './useContractMenus'

const ctx = { instrumentID: 'au2406', price: 100, x: 10, y: 20 }
const multi = { instrumentIDs: ['au2406', 'rb2406'], x: 10, y: 20 }

function Harness({
  favoriteMode,
  favoritedIds,
  onOpenFavoritePicker,
  onRemoveFromAll,
  onToggleInFolder,
  onRemoveFromFolderBatch,
  openOrderPopup = vi.fn(),
  openInfinitePopup = vi.fn(),
  openKlineTab = vi.fn(),
  openOrderTabs = vi.fn(),
  openInfiniteTabs = vi.fn(),
  openKlineTabs = vi.fn(),
}: any) {
  const { singleMenu, multiMenu } = useContractMenus({
    contextMenu: ctx,
    multiSelectMenu: multi,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup,
    openInfinitePopup,
    openKlineTab,
    openOrderTabs,
    openInfiniteTabs,
    openKlineTabs,
    closeMenus: vi.fn(),
  } as any)
  return (
    <>
      {singleMenu}
      {multiMenu}
    </>
  )
}

describe('useContractMenus 收藏双模式', () => {
  it('单选右键「打开报单」拆为 五档下单 / 无限下单，分别打开对应浮窗', () => {
    const openOrder = vi.fn()
    const openInfinite = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set()} openOrderPopup={openOrder} openInfinitePopup={openInfinite} />)
    // 不再有「打开报单」单项
    expect(screen.queryByText('打开报单')).toBeNull()
    expect(screen.getByText('五档下单')).toBeDefined()
    expect(screen.getByText('无限下单')).toBeDefined()

    fireEvent.click(screen.getByText('五档下单'))
    expect(openOrder).toHaveBeenCalledWith('au2406')

    fireEvent.click(screen.getByText('无限下单'))
    expect(openInfinite).toHaveBeenCalledWith('au2406')
  })

  it('多选右键「批量打开报单」拆为 批量五档下单 / 批量无限下单，分别打开对应停靠标签', () => {
    const openOrderTabs = vi.fn()
    const openInfiniteTabs = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set()} openOrderTabs={openOrderTabs} openInfiniteTabs={openInfiniteTabs} />)
    expect(screen.queryByText(/批量打开报单/)).toBeNull()
    expect(screen.getByText(/批量五档下单/)).toBeDefined()
    expect(screen.getByText(/批量无限下单/)).toBeDefined()

    fireEvent.click(screen.getByText(/批量五档下单/))
    expect(openOrderTabs).toHaveBeenCalledWith(['au2406', 'rb2406'])

    fireEvent.click(screen.getByText(/批量无限下单/))
    expect(openInfiniteTabs).toHaveBeenCalledWith(['au2406', 'rb2406'])
  })

  it('picker 模式：单选右键「收藏到收藏夹…」打开面板；批量菜单含「批量收藏到收藏夹…」与「批量取消收藏」', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set(['au2406'])} onOpenFavoritePicker={onOpen} onRemoveFromAll={vi.fn()} />)
    expect(screen.getByText('收藏到收藏夹…')).toBeDefined()
    fireEvent.click(screen.getByText('收藏到收藏夹…'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
    expect(screen.getByText(/批量收藏到收藏夹…/)).toBeDefined()
    expect(screen.getByText(/批量取消收藏/)).toBeDefined()
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

describe('useContractMenus showCollections=false（期权页：无收藏项、不渲染多选菜单）', () => {
  function HarnessNoCollections({ single }: { single: boolean }) {
    const { singleMenu, multiMenu } = useContractMenus({
      contextMenu: single ? ctx : null,
      multiSelectMenu: single ? null : multi,
      favoritedIds: new Set(['au2406']),
      favoriteMode: 'picker',
      onOpenFavoritePicker: vi.fn(),
      onRemoveFromAll: vi.fn(),
      openOrderPopup: vi.fn(),
      openInfinitePopup: vi.fn(),
      openKlineTab: vi.fn(),
      openOrderTabs: vi.fn(),
      openInfiniteTabs: vi.fn(),
      openKlineTabs: vi.fn(),
      closeMenus: vi.fn(),
      showCollections: false,
    } as any)
    return (
      <>
        {singleMenu}
        {multiMenu}
      </>
    )
  }

  it('单选菜单仅 五档下单/无限下单/打开K线/复制合约代码，不含任何收藏项', () => {
    render(<HarnessNoCollections single />)
    expect(screen.getByText('五档下单')).toBeDefined()
    expect(screen.getByText('无限下单')).toBeDefined()
    expect(screen.getByText('打开K线')).toBeDefined()
    expect(screen.getByText('复制合约代码')).toBeDefined()
    expect(screen.queryByText(/收藏/)).toBeNull()
    expect(screen.queryByText('从本夹移除')).toBeNull()
    expect(screen.queryByText('收藏到收藏夹…')).toBeNull()
  })

  it('showCollections=false 时不渲染多选菜单（期权页不启用多选）', () => {
    render(<HarnessNoCollections single={false} />)
    expect(screen.queryByText(/批量/)).toBeNull()
  })
})
