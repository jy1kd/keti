import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore, TAB_TYPES, PINNED_TAB_TYPE } from './tabs'

// 模块加载时捕获 store 真实默认态：vitest 默认按文件隔离，此时 store 尚未被任何测试污染
const defaultTabStoreState = useTabStore.getState()

describe('useTabStore', () => {
  beforeEach(() => {
    // 重置 store 为默认值
    useTabStore.setState({
      tabs: [
        {
          id: 'tab-market',
          type: 'market',
          title: '📊 行情',
          props: {},
          closable: false,
        },
      ],
      activeTabId: 'tab-market',
    })
  })

  // --- 初始状态 ---

  describe('初始状态', () => {
    it('应包含默认的行情标签页', () => {
      const { tabs } = useTabStore.getState()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].type).toBe('market')
      expect(tabs[0].id).toBe('tab-market')
      expect(tabs[0].closable).toBe(false)
    })

    it('activeTabId 应默认为行情标签页', () => {
      const { activeTabId } = useTabStore.getState()
      expect(activeTabId).toBe('tab-market')
    })
  })

  // --- TabType 定义 ---

  describe('TabType', () => {
    it('应定义所有标签页类型', () => {
      expect(TAB_TYPES).toEqual([
        'market',
        'collections',
        'collection',
        'order',
        'kline',
        'options',
        'tquote',
        'ipc-monitor',
        'settings',
        'query',
        'infinite',
        'query-orders',
        'query-positions',
      ])
    })

    it('PINNED_TAB_TYPE 应为 market', () => {
      expect(PINNED_TAB_TYPE).toBe('market')
    })
  })

  // --- generateTabId ---

  describe('generateTabId', () => {
    it('generateTabId 支持 collectionId 后缀', async () => {
      const { generateTabId } = await import('./tabs')
      expect(generateTabId('collection', { collectionId: 'coll-x' })).toBe('tab-collection-coll-x')
    })
  })

  // --- openTab ---

  describe('openTab', () => {
    it('应打开新标签页并设为活跃，返回 true', () => {
      const { openTab } = useTabStore.getState()
      const result = openTab({ type: 'order', title: '📝 报单-au2406', props: { instrumentID: 'au2406' } })

      expect(result).toBe(true)
      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(2)
      expect(state.activeTabId).toBe('tab-order-au2406')
      expect(state.tabs[1].type).toBe('order')
      expect(state.tabs[1].props).toEqual({ instrumentID: 'au2406' })
      expect(state.tabs[1].closable).toBe(true)
    })

    it('不应重复打开相同 type+instrumentID 的标签页（应激活已有，返回 true）', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'order', title: '📝 报单-au2406', props: { instrumentID: 'au2406' } })
      const result = openTab({ type: 'order', title: '📝 报单-au2406', props: { instrumentID: 'au2406' } })

      expect(result).toBe(true)
      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(2)
      expect(state.activeTabId).toBe('tab-order-au2406')
    })

    it('应支持打开不同 instrumentID 的同类型标签页', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'order', title: '📝 报单-au2406', props: { instrumentID: 'au2406' } })
      openTab({ type: 'order', title: '📝 报单-rb2406', props: { instrumentID: 'rb2406' } })

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(3) // market + au2406 + rb2406
      expect(state.activeTabId).toBe('tab-order-rb2406')
    })

    it('打开标签页时默认 closable 为 true', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹' })

      const state = useTabStore.getState()
      expect(state.tabs[1].closable).toBe(true)
    })

    it('打开标签页时可自定义 closable', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹', closable: false })

      const state = useTabStore.getState()
      expect(state.tabs[1].closable).toBe(false)
    })

    it('标签页数量限制：最多 15 个，超限返回 false', () => {
      const { openTab } = useTabStore.getState()

      // 打开 14 个额外标签页（加上 market = 15）
      for (let i = 0; i < 14; i++) {
        const result = openTab({ type: 'order', title: `📝 报单-合约${i}`, props: { instrumentID: `contract${i}` } })
        expect(result).toBe(true)
      }

      expect(useTabStore.getState().tabs).toHaveLength(15)

      // 第 16 个应该返回 false
      const overflowResult = openTab({ type: 'order', title: '📝 报单-合约99', props: { instrumentID: 'contract99' } })
      expect(overflowResult).toBe(false)
      expect(useTabStore.getState().tabs).toHaveLength(15)
      // 活跃标签页不变
      expect(useTabStore.getState().activeTabId).not.toBe('tab-order-contract99')
    })

    it('openTab 按 type+collectionId 去重（激活已有）', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'collection', title: '📁 A', props: { collectionId: 'coll-x' } })
      const result = openTab({ type: 'collection', title: '📁 A', props: { collectionId: 'coll-x' } })
      expect(result).toBe(true)
      expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection')).toHaveLength(1)
    })

    it('可同时打开多个不同 collectionId 的夹标签', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'collection', title: '📁 A', props: { collectionId: 'a' } })
      openTab({ type: 'collection', title: '📁 B', props: { collectionId: 'b' } })
      expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection')).toHaveLength(2)
    })
  })

  // --- closeTab ---

  describe('closeTab', () => {
    it('应关闭指定标签页', () => {
      const { openTab, closeTab } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹' })

      expect(useTabStore.getState().tabs).toHaveLength(2)

      const favTabId = useTabStore.getState().tabs[1].id
      closeTab(favTabId)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs.find((t) => t.id === favTabId)).toBeUndefined()
    })

    it('关闭活跃标签页时应激活相邻标签页', () => {
      const { openTab, closeTab } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹' })
      openTab({ type: 'settings', title: '⚙ 设置' })

      // 当前：market, collections, settings (active)
      expect(useTabStore.getState().activeTabId).toBe('tab-settings')

      const settingsTabId = useTabStore.getState().tabs[2].id
      closeTab(settingsTabId)

      // 关闭 settings 后，应激活 collections（前一个）
      expect(useTabStore.getState().activeTabId).toBe('tab-collections')
    })

    it('关闭中间活跃标签页时应激活后一个标签页', () => {
      const { openTab, closeTab, setActiveTab } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹' })
      openTab({ type: 'settings', title: '⚙ 设置' })

      const favTabId = useTabStore.getState().tabs[1].id
      setActiveTab(favTabId)

      // 当前：market, collections (active), settings
      closeTab(favTabId)

      // 关闭中间的 collections，应激活 settings（后一个）
      expect(useTabStore.getState().activeTabId).toBe('tab-settings')
    })

    it('不应关闭固定标签（market）', () => {
      const { closeTab } = useTabStore.getState()
      closeTab('tab-market')

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs[0].type).toBe('market')
      expect(state.activeTabId).toBe('tab-market')
    })

    it('关闭不存在的标签页应无操作', () => {
      const { closeTab } = useTabStore.getState()
      closeTab('non-existent-tab')

      expect(useTabStore.getState().tabs).toHaveLength(1)
    })
  })

  // --- updateTab ---

  describe('updateTab', () => {
    it('应更新标签页 props 与 title，id 保持稳定（K线页内切换合约）', () => {
      const { openTab, updateTab } = useTabStore.getState()
      openTab({ type: 'kline', title: '📈 K线-IF2608', props: { instrumentID: 'IF2608' } })

      updateTab('tab-kline-IF2608', {
        props: { instrumentID: 'rb2610' },
        title: '📈 K线-rb2610',
      })

      const state = useTabStore.getState()
      const tab = state.tabs.find((t) => t.type === 'kline')
      expect(tab).toBeDefined()
      expect(tab?.id).toBe('tab-kline-IF2608') // id 稳定，不复算
      expect(tab?.props).toEqual({ instrumentID: 'rb2610' })
      expect(tab?.title).toBe('📈 K线-rb2610')
      expect(state.activeTabId).toBe('tab-kline-IF2608')
    })

    it('切换后从行情表重新打开同合约应去重（按 type+instrumentID 内容匹配并自愈）', () => {
      const { openTab, updateTab } = useTabStore.getState()
      openTab({ type: 'kline', title: '📈 K线-IF2608', props: { instrumentID: 'IF2608' } })
      // 页内切换到 rb2610（id 保持 tab-kline-IF2608）
      updateTab('tab-kline-IF2608', {
        props: { instrumentID: 'rb2610' },
        title: '📈 K线-rb2610',
      })
      // 从行情表右键打开 rb2610：不应新建标签
      const result = openTab({ type: 'kline', title: '📈 K线-rb2610', props: { instrumentID: 'rb2610' } })

      expect(result).toBe(true)
      const state = useTabStore.getState()
      expect(state.tabs.filter((t) => t.type === 'kline')).toHaveLength(1)
      expect(state.activeTabId).toBe('tab-kline-IF2608')
    })

    it('重新打开被切换走的旧合约时应自愈回该合约', () => {
      const { openTab, updateTab } = useTabStore.getState()
      openTab({ type: 'kline', title: '📈 K线-IF2608', props: { instrumentID: 'IF2608' } })
      updateTab('tab-kline-IF2608', {
        props: { instrumentID: 'rb2610' },
        title: '📈 K线-rb2610',
      })
      // 重新打开 IF2608：命中旧 id tab-kline-IF2608，props/title 自愈
      openTab({ type: 'kline', title: '📈 K线-IF2608', props: { instrumentID: 'IF2608' } })

      const tab = useTabStore.getState().tabs.find((t) => t.type === 'kline')
      expect(tab?.props).toEqual({ instrumentID: 'IF2608' })
      expect(tab?.title).toBe('📈 K线-IF2608')
    })

    it('目标合约已被其他标签打开时，应激活它并关闭当前标签', () => {
      const { openTab, updateTab } = useTabStore.getState()
      openTab({ type: 'kline', title: '📈 K线-IF2608', props: { instrumentID: 'IF2608' } })
      openTab({ type: 'kline', title: '📈 K线-rb2610', props: { instrumentID: 'rb2610' } })
      // 当前活跃 tab-kline-rb2610；把 IF2608 标签切换到 rb2610 → 冲突，关闭并激活 rb2610
      updateTab('tab-kline-IF2608', {
        props: { instrumentID: 'rb2610' },
        title: '📈 K线-rb2610',
      })

      const state = useTabStore.getState()
      expect(state.tabs.filter((t) => t.type === 'kline')).toHaveLength(1)
      expect(state.tabs.find((t) => t.id === 'tab-kline-IF2608')).toBeUndefined()
      expect(state.activeTabId).toBe('tab-kline-rb2610')
    })

    it('更新不存在的标签页应无操作', () => {
      const { updateTab } = useTabStore.getState()
      updateTab('non-existent-tab', { props: { instrumentID: 'rb2610' } })
      expect(useTabStore.getState().tabs).toHaveLength(1)
    })
  })

  // --- setActiveTab ---

  describe('setActiveTab', () => {
    it('应设置指定标签页为活跃', () => {
      const { openTab, setActiveTab } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹' })

      const favTabId = useTabStore.getState().tabs[1].id
      setActiveTab(favTabId)

      expect(useTabStore.getState().activeTabId).toBe(favTabId)
    })

    it('设置不存在的标签页为活跃应无操作', () => {
      const { setActiveTab } = useTabStore.getState()
      setActiveTab('non-existent-tab')

      expect(useTabStore.getState().activeTabId).toBe('tab-market')
    })
  })

  // --- getTabByType ---

  describe('getTabByType', () => {
    it('应返回指定类型和 props 的标签页', () => {
      const { openTab, getTabByType } = useTabStore.getState()
      openTab({ type: 'order', title: '📝 报单-au2406', props: { instrumentID: 'au2406' } })

      const tab = getTabByType('order', { instrumentID: 'au2406' })
      expect(tab).toBeDefined()
      expect(tab?.type).toBe('order')
      expect(tab?.props).toEqual({ instrumentID: 'au2406' })
    })

    it('不存在时应返回 undefined', () => {
      const { getTabByType } = useTabStore.getState()
      const tab = getTabByType('order', { instrumentID: 'non-existent' })
      expect(tab).toBeUndefined()
    })

    it('不传 props 时应返回同类型的第一个标签页', () => {
      const { openTab, getTabByType } = useTabStore.getState()
      openTab({ type: 'collections', title: '📁 收藏夹' })

      const tab = getTabByType('collections')
      expect(tab).toBeDefined()
      expect(tab?.type).toBe('collections')
    })
  })
})

describe('closeOthers / closeAll / togglePin', () => {
  function seed() {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-order', type: 'order', title: '📝 报单', props: {}, closable: true, pinned: true },
        { id: 'tab-kline', type: 'kline', title: '📈 K线', props: {}, closable: true },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-kline',
    })
  }

  it('closeOthers 关闭除指定标签外的所有可关闭非固定标签，activeTabId 保持', () => {
    seed()
    useTabStore.getState().closeOthers('tab-kline')
    const { tabs, activeTabId } = useTabStore.getState()
    // 保留 market（closable:false）+ order（pinned）+ kline（目标）
    expect(tabs.map((t) => t.id)).toEqual(['tab-market', 'tab-order', 'tab-kline'])
    expect(activeTabId).toBe('tab-kline')
  })

  it('closeOthers 对固定目标标签同样跳过其他固定标签', () => {
    seed()
    useTabStore.getState().closeOthers('tab-order') // 目标是固定标签
    const { tabs } = useTabStore.getState()
    expect(tabs.map((t) => t.id)).toEqual(['tab-market', 'tab-order'])
  })

  it('closeAll 关闭所有可关闭非固定标签，activeTabId 指向剩余第一个', () => {
    seed()
    useTabStore.getState().closeAll()
    const { tabs, activeTabId } = useTabStore.getState()
    // 保留 market（closable:false）+ order（pinned）
    expect(tabs.map((t) => t.id)).toEqual(['tab-market', 'tab-order'])
    expect(activeTabId).toBe('tab-market')
  })

  it('closeAll 后活跃标签被关闭时，activeTabId 落到剩余第一个', () => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-kline', type: 'kline', title: '📈 K线', props: {}, closable: true },
      ],
      activeTabId: 'tab-kline',
    })
    useTabStore.getState().closeAll()
    expect(useTabStore.getState().activeTabId).toBe('tab-market')
  })

  it('togglePin 切换 pinned；closable:false 标签拒绝固定', () => {
    seed()
    useTabStore.getState().togglePin('tab-kline')
    expect(useTabStore.getState().tabs.find((t) => t.id === 'tab-kline')!.pinned).toBe(true)
    useTabStore.getState().togglePin('tab-kline')
    expect(useTabStore.getState().tabs.find((t) => t.id === 'tab-kline')!.pinned).toBe(false)
    // market 不可固定
    useTabStore.getState().togglePin('tab-market')
    expect(useTabStore.getState().tabs.find((t) => t.id === 'tab-market')!.pinned).toBeUndefined()
  })

  it('openTab 新标签默认 pinned:false', () => {
    useTabStore.setState({ tabs: [], activeTabId: '' })
    useTabStore.getState().openTab({ type: 'kline', title: '📈 K线' })
    expect(useTabStore.getState().tabs[0].pinned).toBe(false)
  })
})

describe('双固定标签初始化', () => {
  beforeEach(() => useTabStore.setState({ tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }, { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false }], activeTabId: 'tab-market' }))

  it('初始含期货+期权两个不可关闭标签', () => {
    const { tabs } = useTabStore.getState()
    expect(tabs.map((t) => t.title)).toEqual(['📊 期货', '📈 期权'])
    expect(tabs.every((t) => !t.closable)).toBe(true)
  })

  it('closeTab 拒绝关闭固定标签', () => {
    useTabStore.getState().closeTab('tab-market')
    expect(useTabStore.getState().tabs.length).toBe(2)
  })
})

describe('双固定标签默认初始化（未播种）', () => {
  it('store 默认态含期货+期权两个不可关闭标签，activeTabId 指向 tab-market', () => {
    // 重置到模块加载时捕获的真实默认态（不依赖 beforeEach 播种）
    useTabStore.setState(defaultTabStoreState, true)
    const { tabs, activeTabId } = useTabStore.getState()
    expect(tabs.length).toBe(2)
    expect(tabs.map((t) => t.title)).toEqual(['📊 期货', '📈 期权'])
    expect(tabs.every((t) => t.closable === false)).toBe(true)
    expect(activeTabId).toBe('tab-market')
  })
})
