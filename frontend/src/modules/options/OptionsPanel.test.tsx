import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionsPanel } from './OptionsPanel'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import { useCollectionsStore } from '@/stores/collections'
import type { ContractInfo } from '@/services/types'

// 阻断 API 调用：getOptionChains / getSnapshots 在测试中不需要真实请求
// Mock 按 underlyingID 返回对应的链数据（测试用固定数据）
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  const mockChains: Record<string, any> = {
    FG609: {
      chains: [
        {
          underlying: 'FG609', expireDate: '20260930',
          calls: [{ instrumentID: 'FG609-C-1300', strikePrice: 1300, lastPrice: 10, bidPrice: 9, askPrice: 11, volume: 100, openInterest: 200, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'FG609-P-1300', strikePrice: 1300, lastPrice: 5, bidPrice: 4, askPrice: 6, volume: 50, openInterest: 80, impliedVolatility: 0 }],
          updateTime: '',
        },
      ],
    },
    MA609: {
      chains: [
        {
          underlying: 'MA609', expireDate: '20260930',
          calls: [{ instrumentID: 'MA609-C-1000', strikePrice: 1000, lastPrice: 8, bidPrice: 7, askPrice: 9, volume: 60, openInterest: 120, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'MA609-P-1000', strikePrice: 1000, lastPrice: 3, bidPrice: 2, askPrice: 4, volume: 30, openInterest: 50, impliedVolatility: 0 }],
          updateTime: '',
        },
      ],
    },
    cu2609: {
      chains: [
        {
          underlying: 'cu2609', expireDate: '20260930',
          calls: [{ instrumentID: 'cu2609-C-70000', strikePrice: 70000, lastPrice: 200, bidPrice: 190, askPrice: 210, volume: 40, openInterest: 80, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'cu2609-P-70000', strikePrice: 70000, lastPrice: 150, bidPrice: 140, askPrice: 160, volume: 20, openInterest: 40, impliedVolatility: 0 }],
          updateTime: '',
        },
      ],
    },
    MO2608: {
      chains: [
        {
          underlying: 'MO2608', expireDate: '20260830',
          calls: [{ instrumentID: 'MO2608-C-8900', strikePrice: 8900, lastPrice: 50, bidPrice: 45, askPrice: 55, volume: 30, openInterest: 60, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'MO2608-P-8900', strikePrice: 8900, lastPrice: 30, bidPrice: 25, askPrice: 35, volume: 20, openInterest: 40, impliedVolatility: 0 }],
          updateTime: '',
        },
      ],
    },
  }
  return {
    ...actual,
    getOptionChains: vi.fn().mockImplementation((id: string) => Promise.resolve(mockChains[id] ?? { chains: [] })),
    getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  }
})

// Mock InstrumentSearchModal
vi.mock('@/components/InstrumentSearchModal', () => ({
  InstrumentSearchModal: ({
    isOpen,
    onClose,
    onContractClick,
  }: {
    isOpen: boolean
    onClose: () => void
    onContractClick?: (instrumentID: string) => void
  }) =>
    isOpen ? (
      <div data-testid="instrument-search-modal">
        <button onClick={() => onContractClick?.('FG609-C-1300')}>选择FG609-C-1300</button>
        <button onClick={onClose}>关闭</button>
      </div>
    ) : null,
}))

// Mock echarts
vi.mock('echarts', () => ({
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
  default: { init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })) },
}))

// Mock vtable — 存储实例到模块级变量，通过 getLatestRecords 访问
const vtableInstances: any[] = []
vi.mock('@visactor/vtable', () => {
  const mockTable = () => {
    const instance: any = {
      on: vi.fn(),
      records: [] as any[],
      setRecords: vi.fn((recs: any[]) => { instance.records = recs }),
      // 模拟真实 updateRecords：按索引更新内部 records（快照增量路径需要）
      updateRecords: vi.fn((recs: any[], rowIndexes: number[]) => {
        for (let k = 0; k < recs.length; k++) {
          const idx = rowIndexes[k]
          if (idx >= 0 && idx < instance.records.length) instance.records[idx] = recs[k]
        }
      }),
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      getBodyVisibleCellRange: vi.fn(() => ({ rowStart: 1, rowEnd: 10 })),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn(),
      release: vi.fn(),
    }
    vtableInstances.push(instance)
    return instance
  }
  return { ListTable: vi.fn(mockTable) }
})

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optC: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }
const optP: ContractInfo = { instrumentID: 'FG609-P-1300', instrumentName: 'FG609-P-1300', exchangeID: 'CZCE', productID: 'FGP', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '2', strikePrice: 1300 }
const futMA: ContractInfo = { instrumentID: 'MA609', instrumentName: 'MA609', exchangeID: 'CZCE', productID: 'MA', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optMA: ContractInfo = { instrumentID: 'MA609-C-1000', instrumentName: 'MA609-C-1000', exchangeID: 'CZCE', productID: 'MAC', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'MA609', optionsType: '1', strikePrice: 1000 }
const futCu: ContractInfo = { instrumentID: 'cu2609', instrumentName: 'cu2609', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optCu: ContractInfo = { instrumentID: 'cu2609-C-70000', instrumentName: 'cu2609-C-70000', exchangeID: 'SHFE', productID: 'cu_c', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'cu2609', optionsType: '1', strikePrice: 70000 }
const moOpt: ContractInfo = { instrumentID: 'MO2608-P-8900', instrumentName: 'MO2608-P-8900', exchangeID: 'CFFEX', productID: 'MO', volumeMultiple: 100, priceTick: 0.2, expireDate: '20260830', isTrading: 1, productClass: '6', underlyingInstrID: 'MO2608', optionsType: '2', strikePrice: 8900 }

function setupFGContracts() {
  useContractsStore.setState({ contracts: [fut, optC, optP], isLoaded: true })
}

function setupMultiUnderlyingContracts() {
  useContractsStore.setState({ contracts: [fut, optC, optP, futMA, optMA, futCu, optCu, moOpt], isLoaded: true })
}

function setupMOOnly() {
  useContractsStore.setState({ contracts: [moOpt], isLoaded: true })
}

/** 获取最新 vtable 实例的 records */
function getLatestRecords(): any[] {
  if (vtableInstances.length === 0) return []
  return vtableInstances[vtableInstances.length - 1]?.records ?? []
}

/** 获取最新 vtable 实例 */
function getLatestTable(): any {
  return vtableInstances.length > 0 ? vtableInstances[vtableInstances.length - 1] : null
}

describe('OptionsPanel 平铺 T 型', () => {
  beforeEach(() => {
    vtableInstances.length = 0 // 清空 vtable 实例记录
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
      selectedContracts: new Set(),
      visibleInstrumentIDs: [],
      scrollEndSeq: 0,
      lockedContracts: new Map(),
    })
    useMarketFilterStore.setState({
      futures: { exchanges: [], products: [] },
      options: { exchanges: [], products: [] },
    })
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
        { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
      ],
      activeTabId: 'tab-options',
    })
    setupFGContracts()
    vi.clearAllMocks()
  })

  it('默认全部展开：vtable 收到含标底层 + 期权行的 records', async () => {
    render(<OptionsPanel />)
    // 链结构从 contracts 直接构出，无 HTTP；同步渲染（act 内 setRecords 已完成）
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    // 应包含标底层 + 2 条期权行（C + P 各一行，合并后按 strike 分行）
    expect(records.length).toBeGreaterThanOrEqual(2)
    expect(records[0].kind).toBe('underlying')
    expect(records[0].underlyingID).toBe('FG609')
    // 标底行第0列（callOpenInterest）必须承载标底名：vtable mergeCells 整行合并后
    // 显示 startCol 的值，若该列无值则标底行整行空白（「空行」+「不显示标底合约」的根因）
    expect(records[0].callOpenInterest).toBe('FG609')
  })

  it('underlyingInstrID 缺失的异常期权不产生空标底行', async () => {
    // 构造一个没有 underlyingInstrID 的孤儿期权（数据异常）→ 不应归到 '' 组渲染空标底行
    const orphanOpt: ContractInfo = {
      instrumentID: 'X-ORPHAN',
      instrumentName: 'X-ORPHAN',
      exchangeID: 'CZCE',
      productID: 'X',
      volumeMultiple: 20,
      priceTick: 1,
      expireDate: '20260930',
      isTrading: 1,
      productClass: '2',
      optionsType: '1',
      strikePrice: 1000,
      // 故意缺失 underlyingInstrID
    }
    useContractsStore.setState({ contracts: [fut, optC, optP, orphanOpt], isLoaded: true })
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const underlyingRows = records.filter((r: any) => r.kind === 'underlying')
    expect(underlyingRows.length).toBeGreaterThan(0)
    // 所有标底行都必须有真实 underlyingID（无 '' 空标底行）
    expect(underlyingRows.every((r: any) => r.underlyingID)).toBe(true)
  })

  it('underlyingInstrID 不完整（只有品种/缺失）的期权规范化后归正确标底组', async () => {
    // CZCE 真实数据形态：部分期权 underlyingInstrID 只有品种（'FG'）或缺失（''），
    // 需从 instrumentID 推断完整标底（FG610）。两个合约同标底 FG610、同行权价 → 合并成一行 T 型
    const fut610: ContractInfo = { instrumentID: 'FG610', instrumentName: 'FG610', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20261030', isTrading: 1, productClass: '1' }
    // 无分隔符 CZCE 格式 + underlyingInstrID 只有品种
    const optCall: ContractInfo = { instrumentID: 'FG610C2225', instrumentName: 'FG610C2225', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20261030', isTrading: 1, productClass: '2', underlyingInstrID: 'FG', optionsType: '1', strikePrice: 2225 }
    // 无分隔符 + underlyingInstrID 缺失
    const optPut: ContractInfo = { instrumentID: 'FG610P2225', instrumentName: 'FG610P2225', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20261030', isTrading: 1, productClass: '2', optionsType: '2', strikePrice: 2225 }
    useContractsStore.setState({ contracts: [fut, fut610, optCall, optPut], isLoaded: true })
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    // 两个期权规范化后都应归 FG610 组（不产生 FG / 空 组）
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toEqual(['FG610'])
    // 期权行合并了 C/P：call 来自 optCall（underlyingInstrID='FG'），put 来自 optPut（缺失）
    const optionRow = records.find((r: any) => r.kind === 'option')
    expect(optionRow.callInstrumentID).toBe('FG610C2225')
    expect(optionRow.putInstrumentID).toBe('FG610P2225')
  })

  it('指数期权（MO2608）也渲染标底层', async () => {
    setupMOOnly()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const underlying = records.find((r: any) => r.kind === 'underlying')
    expect(underlying).toBeDefined()
    expect(underlying.underlyingID).toBe('MO2608')
  })

  it('搜索框过滤组：输入 MO 仅显示 MO 组（FG 组隐藏）', async () => {
    setupMultiUnderlyingContracts()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    // 搜索前：所有组都在 records 中
    const allRecords = getLatestRecords()
    const groupIDs = [...new Set(allRecords.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
    expect(groupIDs).toContain('MO2608')

    // 搜索 MO
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'MO' } })
    // 等待 records 更新（useEffect → setRecords）
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    // records 应只剩 MO 组
    const filtered = getLatestRecords()
    const filteredIDs = [...new Set(filtered.map((r: any) => r.underlyingID))]
    expect(filteredIDs).toContain('MO2608')
    expect(filteredIDs).not.toContain('FG609')
    expect(filteredIDs).not.toContain('cu2609')
    expect(filteredIDs).not.toContain('MA609')
  })

  it('搜索按品种中文名匹配：输入「玻璃」命中 FG 组', async () => {
    setupMultiUnderlyingContracts()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: '玻璃' } })
    const filtered = getLatestRecords()
    const filteredIDs = [...new Set(filtered.map((r: any) => r.underlyingID))]
    expect(filteredIDs).toContain('FG609')
    expect(filteredIDs).not.toContain('MO2608')
    expect(filteredIDs).not.toContain('cu2609')
  })

  it('工具行只剩筛选 + 搜索 + 🔍；⭐ 收藏按钮已被移除', () => {
    render(<OptionsPanel />)
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
    expect(screen.getByTitle('搜索合约')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '收藏' })).toBeNull()
    expect(screen.queryByRole('button', { name: '收藏夹' })).toBeNull()
  })

  it('T 行单击回填合约与价格：点击 C 侧（有快照）→ 报单表收到合约 + 最新价', async () => {
    const setOrderForm = vi.fn()
    useOrderStore.setState({
      setOrderInstrument: vi.fn(),
      setOrderForm,
    } as any)

    // mock 快照：FG609-C-1300 有真实最新价 → 点击时 price>0，应回填限价
    useMarketStore.setState({
      snapshots: new Map([
        ['FG609-C-1300', {
          instrumentID: 'FG609-C-1300',
          lastPrice: 10,
          bidPrice1: 9,
          askPrice1: 11,
          volume: 100,
          openInterest: 200,
        } as never as import('@/services/types').MarketSnapshot],
      ]),
    })

    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })

    const table = getLatestTable()
    expect(table).toBeDefined()
    // 找到 click_cell handler
    const clickCalls = (table.on as any).mock.calls
    const clickHandler = [...clickCalls].reverse().find((c: any[]) => c[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()

    // 模拟点击第一行（期权行），col 4 = call 最新价
    const records = getLatestRecords()
    const optionRowIndex = records.findIndex((r: any) => r.kind === 'option')
    await act(async () => {
      clickHandler({ row: optionRowIndex + 1, col: 4, event: {} }) // vtable row = record index + 1
    })

    expect(setOrderForm).toHaveBeenCalledWith({ limitPrice: expect.any(Number) })
  })

  it('T 行单击（无快照，价格显示 --）：只选合约，不回填 0 限价', async () => {
    const setOrderForm = vi.fn()
    useOrderStore.setState({
      setOrderInstrument: vi.fn(),
      setOrderForm,
    } as any)
    // 无快照（contracts 构链价格全 0 → 显示 '--'）→ 点击回传 price=0，应跳过回填限价

    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })

    const table = getLatestTable()
    const clickCalls = (table.on as any).mock.calls
    const clickHandler = [...clickCalls].reverse().find((c: any[]) => c[0] === 'click_cell')?.[1]
    const records = getLatestRecords()
    const optionRowIndex = records.findIndex((r: any) => r.kind === 'option')
    await act(async () => {
      clickHandler({ row: optionRowIndex + 1, col: 4, event: {} })
    })

    // 价格不可用时不应把 0 塞进订单表单（点击 bug 根因）
    expect(setOrderForm).not.toHaveBeenCalled()
  })

  it('点击标底层切换折叠/展开', async () => {
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })

    // 初始 records 包含标底层 + 期权行
    const initial = getLatestRecords()
    const initialOptions = initial.filter((r: any) => r.kind === 'option')
    expect(initialOptions.length).toBeGreaterThan(0)

    // 点击标底层（row 0 = underlying）
    const table = getLatestTable()
    const clickCalls = (table.on as any).mock.calls
    const clickHandler = [...clickCalls].reverse().find((c: any[]) => c[0] === 'click_cell')?.[1]

    await act(async () => {
      clickHandler({ row: 1, col: 0, event: {} }) // row 1 = first record (underlying)
    })

    // 折叠后：只剩标底层，无期权行
    const collapsed = getLatestRecords()
    const collapsedOptions = collapsed.filter((r: any) => r.kind === 'option')
    expect(collapsedOptions.length).toBe(0)
    expect(collapsed[0].kind).toBe('underlying')

    // 再次点击标底层 → 展开
    await act(async () => {
      clickHandler({ row: 1, col: 0, event: {} })
    })
    const expanded = getLatestRecords()
    const expandedOptions = expanded.filter((r: any) => r.kind === 'option')
    expect(expandedOptions.length).toBeGreaterThan(0)
  })

  it('搜索选中合约 → 定位到标底组并展开', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })

    const input = screen.getByPlaceholderText('搜索合约...')
    await user.type(input, 'FG609-C')
    await user.click(screen.getByText('FG609-C-1300'))
    // 选中后 searchQuery 被设为标底 ID，records 应包含该组
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
  })

  it('高级搜索选中合约 → 关闭弹窗并展开对应组', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const user = userEvent.setup()
    render(<OptionsPanel />)

    await user.click(screen.getByTitle('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()

    await user.click(screen.getByText('选择FG609-C-1300'))
    expect(screen.queryByTestId('instrument-search-modal')).toBeNull()
    // records 应包含 FG609 组
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
  })

  it('期权标签挂载时不应发起 getOptionChains HTTP 请求（直接用 contracts 构链）', async () => {
    // 现行实现：链结构直接从合约列表构出，零 HTTP。
    // 如果有人误回退到 getOptionChains 调用，这里会失败。
    const { getOptionChains } = await import('@/services/api')
    expect(getOptionChains).not.toHaveBeenCalled()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(getOptionChains).not.toHaveBeenCalled()
  })
})

// ── 交易所+品种多选筛选 ──────────────────────────────────────────────────────

describe('OptionsPanel 筛选（标底合约粒度）', () => {
  beforeEach(() => {
    vtableInstances.length = 0 // 清空 vtable 实例记录
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
      selectedContracts: new Set(),
      visibleInstrumentIDs: [],
      scrollEndSeq: 0,
      lockedContracts: new Map(),
    })
    useMarketFilterStore.setState({
      futures: { exchanges: [], products: [] },
      options: { exchanges: [], products: [] },
    })
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
        { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
      ],
      activeTabId: 'tab-options',
    })
    setupMultiUnderlyingContracts()
    vi.clearAllMocks()
  })

  it('渲染「筛选」按钮，空筛选无徽标', () => {
    render(<OptionsPanel />)
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    expect(screen.queryByTestId('contract-filter-badge')).toBeNull()
  })

  it('按标底品种过滤：勾选 玻璃 后只保留 FG 组', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
    expect(groupIDs).not.toContain('MA609')
    expect(groupIDs).not.toContain('cu2609')
    expect(groupIDs).not.toContain('MO2608')
  })

  it('按标底合约筛选：品种 FG + 标底 FG609 → records 只含 FG609 组', async () => {
    // 三级筛选：交易所+品种已选，进一步选具体标底 FG609 → 只显示 FG609 的 C/P
    useMarketFilterStore.setState({
      options: { exchanges: [], products: ['FG'], underlyings: ['FG609'] },
    })
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
    expect(groupIDs).not.toContain('MA609')
    expect(groupIDs).not.toContain('cu2609')
    expect(groupIDs).not.toContain('MO2608')
    // 且 records 里应包含 FG609 的期权行（C/P）
    expect(records.some((r: any) => r.kind === 'option')).toBe(true)
  })

  it('按标底合约筛选可多选：FG609 + MA609 同时选中 → 两个标底组都在', async () => {
    useMarketFilterStore.setState({
      options: { exchanges: [], products: ['FG', 'MA'], underlyings: ['FG609', 'MA609'] },
    })
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
    expect(groupIDs).toContain('MA609')
    expect(groupIDs).not.toContain('cu2609')
    expect(groupIDs).not.toContain('MO2608')
  })

  it('UI 交互：选品种 FG → 合约 section 列双标底 → 勾选 FG609 → 表格只 FG609', async () => {
    // 构造 FG 品种下两个标底（FG609 / FG610），模拟真实场景「选品种后列出多个标底」
    const fut2: ContractInfo = { instrumentID: 'FG610', instrumentName: 'FG610', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20261030', isTrading: 1, productClass: '1' }
    const opt2: ContractInfo = { instrumentID: 'FG610-C-1300', instrumentName: 'FG610-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20261030', isTrading: 1, productClass: '2', underlyingInstrID: 'FG610', optionsType: '1', strikePrice: 1300 }
    useContractsStore.setState({ contracts: [fut, optC, optP, fut2, opt2], isLoaded: true })

    const user = userEvent.setup()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    // 打开筛选 → 选品种「玻璃」
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    // 合约 section 出现，列出 FG 品种的两个标底
    expect(screen.getByText('合约')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'FG609' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'FG610' })).toBeInTheDocument()
    // 勾选 FG609 标底
    fireEvent.click(screen.getByRole('checkbox', { name: 'FG609' }))
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    // 表格只显示 FG609 组，FG610 被过滤掉
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('FG609')
    expect(groupIDs).not.toContain('FG610')
  })

  it('按交易所过滤：勾选 SHFE 后只保留 cu 组', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'SHFE' }))
    // 等待 filter → groups → records → useEffect → setRecords 全链路
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toContain('cu2609')
    expect(groupIDs).not.toContain('FG609')
    expect(groupIDs).not.toContain('MA609')
    expect(groupIDs).not.toContain('MO2608')
  })

  it('清空筛选后恢复全量分组', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    // 清空
    await user.click(screen.getByRole('button', { name: '清空' }))
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs.length).toBeGreaterThanOrEqual(4)
  })
})

// ── 工具行布局与基础交互 ──────────────────────────────────────────────────────

describe('OptionsPanel 工具行布局', () => {
  beforeEach(() => {
    vtableInstances.length = 0 // 清空 vtable 实例记录
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
      selectedContracts: new Set(),
      visibleInstrumentIDs: [],
      scrollEndSeq: 0,
      lockedContracts: new Map(),
    })
    useMarketFilterStore.setState({
      futures: { exchanges: [], products: [] },
      options: { exchanges: [], products: [] },
      futuresCollectionId: '',
      optionsCollectionId: '',
    })
    useCollectionsStore.setState({ collections: [], loaded: false })
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
        { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
      ],
      activeTabId: 'tab-options',
    })
    setupFGContracts()
    vi.clearAllMocks()
  })

  it('工具行只剩筛选 + 搜索框 + 🔍 按钮（无 ⭐）', () => {
    const { container } = render(<OptionsPanel />)
    const toolbar = container.querySelector('.market-toolbar') as HTMLElement
    expect(toolbar).toBeTruthy()
    expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    expect(toolbar.querySelector('.btn-favorite')).toBeNull()
  })

  it('点击 🔍 打开高级搜索弹窗', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    expect(screen.queryByTestId('instrument-search-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()
  })

  it('有收藏夹时渲染收藏夹过滤下拉；选夹后表格只保留夹内合约', async () => {
    // 注入收藏夹 FG 组合（含期权 FG609-C-1300）
    useCollectionsStore.setState({
      collections: [{ id: 'fg', name: 'FG 组合', instrumentIDs: ['FG609-C-1300'] }],
      loaded: true,
    })
    setupMultiUnderlyingContracts()
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    // 切到 FG 组合 → 表格只保留夹内期权（FG609-C-1300）所在标底组
    await user.selectOptions(select, 'fg')
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const records = getLatestRecords()
    const groupIDs = [...new Set(records.map((r: any) => r.underlyingID))]
    expect(groupIDs).toEqual(['FG609'])
    expect(groupIDs).not.toContain('MA609')
    expect(groupIDs).not.toContain('cu2609')
    // 且期权行是收藏夹里的 FG609-C-1300
    const optionRows = records.filter((r: any) => r.kind === 'option')
    expect(optionRows.some((r: any) => r.callInstrumentID === 'FG609-C-1300')).toBe(true)
    // 切回全部 → 恢复多组
    await user.selectOptions(select, '')
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const recordsAll = getLatestRecords()
    const groupIDsAll = [...new Set(recordsAll.map((r: any) => r.underlyingID))]
    expect(groupIDsAll.length).toBeGreaterThanOrEqual(4)
  })
})
