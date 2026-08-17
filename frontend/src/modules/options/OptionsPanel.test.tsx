import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionsPanel } from './OptionsPanel'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore } from '@/stores/collections'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import type { ContractInfo } from '@/services/types'

// 阻断 TQuoteTable 内部拉链的 mock（与 OptionChainGroup.test.tsx 一致；
// 期权组展开时不会发起真实 API 请求）。
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    getOptionChains: vi.fn().mockResolvedValue({
      chains: [
        {
          underlying: 'FG609',
          expireDate: '20260930',
          calls: [{ instrumentID: 'FG609-C-1300', strikePrice: 1300, lastPrice: 10, bidPrice: 9, askPrice: 11, volume: 100, openInterest: 200, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'FG609-P-1250', strikePrice: 1300, lastPrice: 5, bidPrice: 4, askPrice: 6, volume: 50, openInterest: 80, impliedVolatility: 0 }],
          updateTime: '',
        },
      ],
    }),
    getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  }
})

// Mock CollectionPicker：捕获 props 用于验证系列模式
let lastPickerProps: any = null
vi.mock('@/components/CollectionPicker', () => ({
  CollectionPicker: (props: any) => {
    lastPickerProps = props
    if (!props.isOpen) return null
    return (
      <div data-testid="collection-picker">
        <span>{props.seriesIDs?.length ? '收藏系列到收藏夹' : '收藏到收藏夹'}</span>
        <button onClick={props.onClose}>关闭picker</button>
      </div>
    )
  },
}))

// Mock InstrumentSearchModal：放大镜高级搜索弹窗；测试时可触发 onContractClick 模拟选中合约。
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

// Mock echarts（与旧测试保持一致；ContextMenu / 部分共享模块可能引用）
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  default: {
    init: vi.fn(() => ({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}))

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optC: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }
const optP: ContractInfo = { instrumentID: 'FG609-P-1300', instrumentName: 'FG609-P-1300', exchangeID: 'CZCE', productID: 'FGP', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '2', strikePrice: 1300 }
const futMA: ContractInfo = { instrumentID: 'MA609', instrumentName: 'MA609', exchangeID: 'CZCE', productID: 'MA', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optMA: ContractInfo = { instrumentID: 'MA609-C-1000', instrumentName: 'MA609-C-1000', exchangeID: 'CZCE', productID: 'MAC', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'MA609', optionsType: '1', strikePrice: 1000 }
const futCu: ContractInfo = { instrumentID: 'cu2609', instrumentName: 'cu2609', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optCu: ContractInfo = { instrumentID: 'cu2609-C-70000', instrumentName: 'cu2609-C-70000', exchangeID: 'SHFE', productID: 'cu_c', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'cu2609', optionsType: '1', strikePrice: 70000 }
const moOpt: ContractInfo = { instrumentID: 'MO2608-P-8900', instrumentName: 'MO2608-P-8900', exchangeID: 'CFFEX', productID: 'MO', volumeMultiple: 100, priceTick: 0.2, expireDate: '20260830', isTrading: 1, productClass: '6', underlyingInstrID: 'MO2608', optionsType: '2', strikePrice: 8900 }

function setupFGContracts() {
  useContractsStore.setState({
    contracts: [fut, optC, optP],
    isLoaded: true,
  })
}

function setupMultiUnderlyingContracts() {
  useContractsStore.setState({
    contracts: [fut, optC, optP, futMA, optMA, futCu, optCu, moOpt],
    isLoaded: true,
  })
}

function setupMOOnly() {
  useContractsStore.setState({
    contracts: [moOpt],
    isLoaded: true,
  })
}

describe('OptionsPanel 堆叠 T 型', () => {
  beforeEach(() => {
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

  it('默认全部折叠：可见标底组头但不挂载 T 表（无「到期」切换条）', async () => {
    const { container } = render(<OptionsPanel />)
    // 标底组头可见
    expect(screen.getByText('FG609')).toBeDefined()
    // T 型表未展开，无到期切换条
    expect(screen.queryByText(/20260930/)).toBeNull()
    // 无 QuoteTable / vtable 容器（期权页不再用平铺表）
    expect(container.querySelector('.market-table-container')).toBeNull()
  })

  it('指数期权（MO2608）也渲染组头：合成标底、productClass=1 走红粗显示', () => {
    setupMOOnly()
    render(<OptionsPanel />)
    expect(screen.getByText('MO2608')).toBeDefined()
  })

  it('搜索框过滤组：输入 MO 仅显示 MO 组（FG 组隐藏）', () => {
    setupMultiUnderlyingContracts()
    render(<OptionsPanel />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'MO' } })
    expect(screen.getByText('MO2608')).toBeDefined()
    // FG/Cu/MA 组被过滤掉
    expect(screen.queryByText('FG609')).toBeNull()
    expect(screen.queryByText('cu2609')).toBeNull()
    expect(screen.queryByText('MA609')).toBeNull()
  })

  it('搜索按品种中文名匹配：输入「玻璃」命中 FG 组（中证1000 / 沪铜 / 甲醇组隐藏）', () => {
    setupMultiUnderlyingContracts()
    render(<OptionsPanel />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: '玻璃' } })
    expect(screen.getByText('FG609')).toBeDefined()
    expect(screen.queryByText('MO2608')).toBeNull()
    expect(screen.queryByText('cu2609')).toBeNull()
  })

  it('工具行只剩筛选 + 搜索 + 🔍；⭐ 收藏按钮已被移除（P1 不做合约收藏）', () => {
    render(<OptionsPanel />)
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
    expect(screen.getByTitle('搜索合约')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '收藏' })).toBeNull()
    expect(screen.queryByRole('button', { name: '收藏夹' })).toBeNull()
    expect(screen.queryByRole('button', { name: '批量收藏' })).toBeNull()
  })

  it('T 行单击回填合约与价格：展开 FG609 → 点击 C 侧 → 报单表收到合约 + 最新价', async () => {
    const setOrderForm = vi.fn()
    // 替换 useOrderStore.setOrderForm 为可监控实例
    useOrderStore.setState({
      setOrderInstrument: vi.fn(),
      setOrderForm,
    } as any)

    render(<OptionsPanel />)
    // 展开 FG609 组头 → 触发链加载 + 锁订阅 → 渲染 TQuoteTable
    fireEvent.click(screen.getByText('FG609'))
    // 等链数据到达（OptionChainGroup 渲染到期切换条 = 链加载完成的标志）
    await screen.findByText('20260930')

    // 触发 ListTable click_cell handler（row 0 = FG609-C-1300，col 4 = call 最新价）
    const { ListTable } = await import('@visactor/vtable')
    const calls = (ListTable as any).mock.results
    const table = calls[calls.length - 1]?.value
    const clickCalls = (table.on as any).mock.calls
    const clickHandler = [...clickCalls].reverse().find((c: any[]) => c[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()
    // wrap in act — clickHandler 同步触发 onSelectContract → setOrderForm（捕获延迟状态更新）
    await act(async () => {
      clickHandler({ row: 0, col: 4, event: {} })
    })

    // setOrderForm({ limitPrice: 10 })（最新价由链数据提供）
    expect(setOrderForm).toHaveBeenCalledWith({ limitPrice: 10 })
  })

  it('搜索选中合约 → 定位到标底组并自动展开（spec §4.3）', async () => {
    // jsdom 无 scrollIntoView，stub 一下
    Element.prototype.scrollIntoView = vi.fn()

    const user = userEvent.setup()
    render(<OptionsPanel />)
    const input = screen.getByPlaceholderText('搜索合约...')
    await user.type(input, 'FG609-C')
    // ContractSearch 内部 onSelect 触发 handleSelectContract → 展开 FG609 组
    await user.click(screen.getByText('FG609-C-1300'))
    // 组展开后渲染到期切换条
    expect(await screen.findByText('20260930')).toBeDefined()
  })

  it('高级搜索选中合约 → 关闭弹窗并展开对应组', async () => {
    Element.prototype.scrollIntoView = vi.fn()

    const user = userEvent.setup()
    render(<OptionsPanel />)
    // 默认折叠 → 无到期切换条
    expect(screen.queryByText('20260930')).toBeNull()

    // 打开高级搜索
    await user.click(screen.getByTitle('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()

    // mock 的弹窗内按钮触发 onContractClick('FG609-C-1300') → 关闭 + 展开 FG609
    await user.click(screen.getByText('选择FG609-C-1300'))
    expect(screen.queryByTestId('instrument-search-modal')).toBeNull()
    expect(await screen.findByText('20260930')).toBeDefined()
  })
})

// ── 交易所+品种多选筛选（粒度 = 标底合约）───────────────────────────────────

describe('OptionsPanel 筛选（标底合约粒度）', () => {
  beforeEach(() => {
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

  it('按标底品种过滤：勾选 玻璃 后只保留 FG 组（标底+期权），其余组消失', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    expect(screen.getByText('FG609')).toBeDefined()
    expect(screen.queryByText('MA609')).toBeNull()
    expect(screen.queryByText('cu2609')).toBeNull()
    expect(screen.queryByText('MO2608')).toBeNull()
  })

  it('按交易所过滤：勾选 SHFE 后只保留 cu 组', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: 'SHFE' }))
    expect(screen.getByText('cu2609')).toBeDefined()
    expect(screen.queryByText('FG609')).toBeNull()
    expect(screen.queryByText('MA609')).toBeNull()
    expect(screen.queryByText('MO2608')).toBeNull()
  })

  it('清空筛选后恢复全量分组', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    await user.click(screen.getByRole('button', { name: '清空' }))
    // 全量：cu < FG < MA < MO（按标底 natural order）
    const headers = screen.getAllByText(/^(FG609|MA609|cu2609|MO2608)$/)
    expect(headers.map((el) => el.textContent)).toEqual(['cu2609', 'FG609', 'MA609', 'MO2608'])
  })
})

// ── 工具行布局与基础交互 ──────────────────────────────────────────────────────

describe('OptionsPanel 工具行布局', () => {
  beforeEach(() => {
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

  it('工具行只剩筛选 + 搜索框 + 🔍 按钮（无 [列表|T型] 切换 / 无 ⭐）', () => {
    const { container } = render(<OptionsPanel />)
    const toolbar = container.querySelector('.market-toolbar') as HTMLElement
    expect(toolbar).toBeTruthy()
    expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    // ⭐ 收藏按钮已移除
    expect(toolbar.querySelector('.btn-favorite')).toBeNull()
  })

  it('点击 🔍 打开高级搜索弹窗', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    expect(screen.queryByTestId('instrument-search-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()
  })
})

// ── 组头 ⭐ 系列收藏（P2）─────────────────────────────────────────────────

describe('OptionsPanel 组头 ⭐ 系列收藏', () => {
  beforeEach(() => {
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
    useCollectionsStore.setState({ collections: [], loaded: true })
    setupFGContracts()
    lastPickerProps = null
    vi.clearAllMocks()
  })

  it('组头 ⭐ 打开系列收藏选夹面板（series 模式）', async () => {
    render(<OptionsPanel />)
    // 展开 FG609
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    const star = screen.getByTitle('收藏整条链') // 组头 ⭐
    fireEvent.click(star)
    // picker 打开（series 文案）
    expect(await screen.findByTestId('collection-picker')).toBeDefined()
    expect(screen.getByText('收藏系列到收藏夹')).toBeDefined()
  })

  it('收藏夹有 FG609 系列时，组头 ⭐ 显示为 ★（实心）', () => {
    useCollectionsStore.setState({
      collections: [
        { id: 'coll-1', name: '默认', instrumentIDs: [], seriesIDs: ['FG609'] },
      ],
      loaded: true,
    })
    render(<OptionsPanel />)
    const star = screen.getByTitle('收藏整条链')
    expect(star.textContent).toBe('★')
  })

  it('收藏夹无 FG609 系列时，组头 ⭐ 显示为 ☆（空心）', () => {
    useCollectionsStore.setState({
      collections: [
        { id: 'coll-1', name: '默认', instrumentIDs: [], seriesIDs: ['MA609'] },
      ],
      loaded: true,
    })
    render(<OptionsPanel />)
    const star = screen.getByTitle('收藏整条链')
    expect(star.textContent).toBe('☆')
  })
})