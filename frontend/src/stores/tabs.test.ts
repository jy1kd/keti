import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore, TAB_TYPES, PINNED_TAB_TYPE } from './tabs'

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
        'favorites',
        'order',
        'kline',
        'options',
        'ipc-monitor',
        'settings',
        'query',
      ])
    })

    it('PINNED_TAB_TYPE 应为 market', () => {
      expect(PINNED_TAB_TYPE).toBe('market')
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
      openTab({ type: 'favorites', title: '⭐ 自选' })

      const state = useTabStore.getState()
      expect(state.tabs[1].closable).toBe(true)
    })

    it('打开标签页时可自定义 closable', () => {
      const { openTab } = useTabStore.getState()
      openTab({ type: 'favorites', title: '⭐ 自选', closable: false })

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
  })

  // --- closeTab ---

  describe('closeTab', () => {
    it('应关闭指定标签页', () => {
      const { openTab, closeTab } = useTabStore.getState()
      openTab({ type: 'favorites', title: '⭐ 自选' })

      expect(useTabStore.getState().tabs).toHaveLength(2)

      const favTabId = useTabStore.getState().tabs[1].id
      closeTab(favTabId)

      const state = useTabStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs.find((t) => t.id === favTabId)).toBeUndefined()
    })

    it('关闭活跃标签页时应激活相邻标签页', () => {
      const { openTab, closeTab } = useTabStore.getState()
      openTab({ type: 'favorites', title: '⭐ 自选' })
      openTab({ type: 'settings', title: '⚙ 设置' })

      // 当前：market, favorites, settings (active)
      expect(useTabStore.getState().activeTabId).toBe('tab-settings')

      const settingsTabId = useTabStore.getState().tabs[2].id
      closeTab(settingsTabId)

      // 关闭 settings 后，应激活 favorites（前一个）
      expect(useTabStore.getState().activeTabId).toBe('tab-favorites')
    })

    it('关闭中间活跃标签页时应激活后一个标签页', () => {
      const { openTab, closeTab, setActiveTab } = useTabStore.getState()
      openTab({ type: 'favorites', title: '⭐ 自选' })
      openTab({ type: 'settings', title: '⚙ 设置' })

      const favTabId = useTabStore.getState().tabs[1].id
      setActiveTab(favTabId)

      // 当前：market, favorites (active), settings
      closeTab(favTabId)

      // 关闭中间的 favorites，应激活 settings（后一个）
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

  // --- setActiveTab ---

  describe('setActiveTab', () => {
    it('应设置指定标签页为活跃', () => {
      const { openTab, setActiveTab } = useTabStore.getState()
      openTab({ type: 'favorites', title: '⭐ 自选' })

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
      openTab({ type: 'favorites', title: '⭐ 自选' })

      const tab = getTabByType('favorites')
      expect(tab).toBeDefined()
      expect(tab?.type).toBe('favorites')
    })
  })
})
