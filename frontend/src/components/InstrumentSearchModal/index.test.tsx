import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstrumentSearchModal } from './index'
import { toast } from '@/components/Toast'
import type { ContractInfo } from '@/services/types'

vi.mock('@/services/api', () => ({
  getExchanges: vi.fn().mockResolvedValue({ exchanges: ['SHFE'] }),
  getProducts: vi.fn().mockResolvedValue({ products: [] }),
  getInstruments: vi.fn().mockResolvedValue({ instruments: [] }),
  searchInstruments: vi.fn().mockResolvedValue({ instruments: [] }),
  refreshInstruments: vi.fn().mockResolvedValue({}),
}))

const mockContract: ContractInfo = {
  instrumentID: 'IF2608',
  instrumentName: '沪深300',
  exchangeID: 'CFFEX',
  productID: 'IF',
  volumeMultiple: 300,
  priceTick: 0.2,
  expireDate: '99991231',
  isTrading: 1,
  productClass: '1',
}

/** 在弹窗内搜索并返回目标合约所在行 */
async function searchAndGetRow(getInstruments: ReturnType<typeof vi.fn>, keyword: string) {
  getInstruments.mockResolvedValue({ instruments: [mockContract] })
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('搜索关键词...'), keyword)
  await user.click(screen.getByRole('button', { name: '搜索' }))
  const cell = await screen.findByText(keyword)
  return cell.closest('tr') as HTMLTableRowElement
}

describe('InstrumentSearchModal 收藏/移除反馈', () => {
  beforeEach(() => {
    toast._clearAll()
    vi.clearAllMocks()
  })

  it('点击收藏弹出 toast 提示「已收藏」', async () => {
    const { getInstruments } = await import('@/services/api')
    const successSpy = vi.spyOn(toast, 'success')
    const onAdd = vi.fn()
    render(
      <InstrumentSearchModal
        isOpen
        onClose={vi.fn()}
        onAddToFavorite={onAdd}
        onRemoveFromFavorite={vi.fn()}
        allContractIds={new Set(['IF2608'])}
        favoritedIds={new Set()}
      />,
    )

    const row = await searchAndGetRow(getInstruments as ReturnType<typeof vi.fn>, 'IF2608')
    // allContractIds 含 IF2608 → 按钮显示「收藏」
    const favBtn = row.querySelector('button')
    expect(favBtn?.textContent).toBe('收藏')

    await userEvent.setup().click(favBtn as HTMLButtonElement)

    expect(onAdd).toHaveBeenCalledWith(mockContract)
    expect(successSpy).toHaveBeenCalledWith('已收藏 IF2608')
  })

  it('点击移除弹出 toast 提示「已移除」', async () => {
    const { getInstruments } = await import('@/services/api')
    const successSpy = vi.spyOn(toast, 'success')
    const onRemove = vi.fn()
    render(
      <InstrumentSearchModal
        isOpen
        onClose={vi.fn()}
        onAddToFavorite={vi.fn()}
        onRemoveFromFavorite={onRemove}
        allContractIds={new Set(['IF2608'])}
        favoritedIds={new Set(['IF2608'])}
      />,
    )

    const row = await searchAndGetRow(getInstruments as ReturnType<typeof vi.fn>, 'IF2608')
    const removeBtn = row.querySelector('button')
    expect(removeBtn?.textContent).toBe('移除')

    await userEvent.setup().click(removeBtn as HTMLButtonElement)

    expect(onRemove).toHaveBeenCalledWith('IF2608')
    expect(successSpy).toHaveBeenCalledWith('已移除 IF2608')
  })
})
