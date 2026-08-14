import { useCallback, useMemo, useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useTabStore, type Tab } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useMarketStore } from '@/modules/market/store'
import { CollectionsFlyout } from '@/components/CollectionsFlyout'
import { startDetachDrag, detachTabAt } from '@/utils/detachDrag'
import { computeTabOverflow } from './overflow'
import './styles.css'

interface ContextMenuState {
  tabId: string
  tabType: string
  tabTitle: string
  pinned: boolean
  x: number
  y: number
}

/** `+` 悬停选择栏可打开的停靠标签类型（底部功能栏子集，固定 4 项） */
const ADD_TAB_ITEMS = [
  { type: 'order' as const, icon: '📝', label: '五档下单', title: '📝 五档下单' },
  { type: 'kline' as const, icon: '📈', label: 'K线', title: '📈 K线' },
  { type: 'infinite' as const, icon: '♾️', label: '无限下单', title: '♾️ 无限下单' },
  { type: 'settings' as const, icon: '⚙', label: '设置', title: '⚙ 设置' },
]

/**
 * 标签栏组件
 *
 * 显示所有打开的标签页，支持切换、关闭、新增。
 * `+` 悬停弹出选择栏，停靠打开底部功能栏标签（报单/K线/无限下单/设置）。
 * 键盘导航：左/右箭头切换标签，Home/End 跳转首尾。
 * 右键菜单：关闭/关闭其他/关闭所有/固定(取消固定)/窗口化
 */
export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const closeOthers = useTabStore((s) => s.closeOthers)
  const closeAll = useTabStore((s) => s.closeAll)
  const togglePin = useTabStore((s) => s.togglePin)
  const windows = useFloatingWindowStore((s) => s.windows)
  const suppressClickRef = useRef(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuWrapRef = useRef<HTMLDivElement>(null)
  const openTab = useTabStore((s) => s.openTab)

  // 收藏夹快速入口（顶栏 📁 hover / `+` 菜单项）：悬浮弹层
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const collectionsWrapRef = useRef<HTMLDivElement>(null)

  // 收藏夹弹层：点击外部 / Escape 关闭
  useEffect(() => {
    if (!collectionsOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (collectionsWrapRef.current && !collectionsWrapRef.current.contains(e.target as Node)) {
        setCollectionsOpen(false)
      }
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setCollectionsOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [collectionsOpen])

  // 选择栏：点击外部 / Escape 关闭
  useEffect(() => {
    if (!addMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (addMenuWrapRef.current && !addMenuWrapRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [addMenuOpen])

  useEffect(() => {
    if (!addMenuOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setAddMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addMenuOpen])

  const handleAddItem = useCallback((item: (typeof ADD_TAB_ITEMS)[number]) => {
    // 携带当前选中合约打开（报单/K线标签直接定位到该合约），未选中则打开空白标签
    const inst = useMarketStore.getState().selectedInstrument
    openTab({
      type: item.type,
      title: inst ? `${item.title}-${inst}` : item.title,
      ...(inst ? { props: { instrumentID: inst } } : {}),
    })
    setAddMenuOpen(false)
  }, [openTab])

  // 排除已拖入浮动窗口的标签（浮动标签从标签栏隐藏）
  // useMemo 稳定引用：避免 measureOverflow / RO / wheel 等依赖 visibleTabs 的 effect 每次渲染空转
  const visibleTabs = useMemo(() => tabs.filter((t) => !windows[t.id]), [tabs, windows])

  // 固定标签（期货/期权等 closable:false）：固定在左侧、可滚动区之外；不参与滚轮/溢出/隐藏
  const fixedTabs = visibleTabs.filter((t) => !t.closable)

  // 可滚动区标签：排除固定标签；pinned 靠左排序
  const scrollTabs = useMemo(() => {
    const rest = visibleTabs.filter((t) => t.closable)
    return [...rest.filter((t) => t.pinned), ...rest.filter((t) => !t.pinned)]
  }, [visibleTabs])

  // ── 溢出（▾ 下拉 + 有界滚轮）──
  const [hiddenTabIds, setHiddenTabIds] = useState<string[]>([])
  const [overflowOpen, setOverflowOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const overflowWrapRef = useRef<HTMLDivElement>(null)

  const hiddenTabs = scrollTabs.filter((t) => hiddenTabIds.includes(t.id))
  const hasHidden = hiddenTabs.length > 0

  // ▾ 点击项：激活 + 将目标标签滚入视口 + 关闭
  const handleOverflowItemClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab.id)
      const scrollEl = scrollRef.current
      if (scrollEl) {
        const targetEl = scrollEl.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
        if (targetEl) {
          const tabEls = Array.from(scrollEl.querySelectorAll<HTMLElement>('[role="tab"]'))
          const widths = tabEls.map((el) => el.offsetWidth)
          const ids = scrollTabs.map((t) => t.id)
          const { maxScroll } = computeTabOverflow(ids, scrollEl.clientWidth, widths)
          // 目标标签滚到可视左缘；clamp 到 [0, maxScroll]
          scrollEl.scrollLeft = Math.max(0, Math.min(targetEl.offsetLeft, maxScroll))
        }
      }
      setOverflowOpen(false)
    },
    [setActiveTab, scrollTabs],
  )

  // 测量：读取容器宽与各标签宽，computeTabOverflow 计算隐藏集
  const measureOverflow = useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const tabEls = Array.from(scrollEl.querySelectorAll<HTMLElement>('[role="tab"]'))
    const ids = scrollTabs.map((t) => t.id)
    const widths = tabEls.map((el) => el.offsetWidth)
    const { hiddenTabIds: hidden } = computeTabOverflow(ids, scrollEl.clientWidth, widths)
    // 内容不变时复用 prev 引用，避免空转重渲染（React 对相同引用 bailout）
    setHiddenTabIds((prev) =>
      prev.length === hidden.length && prev.every((id, i) => id === hidden[i]) ? prev : hidden,
    )
  }, [scrollTabs])

  useEffect(() => {
    measureOverflow()
    const scrollEl = scrollRef.current
    if (!scrollEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measureOverflow())
    ro.observe(scrollEl)
    return () => ro.disconnect()
  }, [measureOverflow])

  // ▾ 下拉：点击外部 / Escape 关闭
  useEffect(() => {
    if (!overflowOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (overflowWrapRef.current && !overflowWrapRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [overflowOpen])

  useEffect(() => {
    if (!overflowOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overflowOpen])

  // 原生非 passive wheel 监听：React onWheel 为 passive，preventDefault 无效
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const onWheel = (e: WheelEvent) => {
      // 滚轮横滚仅作用于可滚动区内的标签；visibleTabs 与 DOM 顺序一致
      const tabEls = Array.from(scrollEl.querySelectorAll<HTMLElement>('[role="tab"]'))
      const widths = tabEls.map((el) => el.offsetWidth)
      // 无溢出时不拦截滚轮（单标签/全部放得下），让页面正常滚动
      const totalWidth = widths.reduce((sum, w) => sum + w, 0)
      if (totalWidth <= scrollEl.clientWidth) return
      const ids = scrollTabs.map((t) => t.id)
      const { maxScroll } = computeTabOverflow(ids, scrollEl.clientWidth, widths)
      const target = scrollEl.scrollLeft + e.deltaX + e.deltaY
      scrollEl.scrollLeft = Math.max(0, Math.min(target, maxScroll))
      e.preventDefault()
    }
    scrollEl.addEventListener('wheel', onWheel, { passive: false })
    return () => scrollEl.removeEventListener('wheel', onWheel)
  }, [scrollTabs])

  // 标签栏拖拽脱离（药丸 ghost）；阈值由 startDetachDrag 内部判定
  const handleTabPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, tab: Tab) => {
    if (e.button !== 0 || !tab.closable) return
    startDetachDrag({
      event: e.nativeEvent,
      sourceEl: e.currentTarget,
      canDetach: () => tab.closable,
      ghostKind: 'pill',
      onDetaching: () => { suppressClickRef.current = true },
      onDetach: (pos) => detachTabAt(tab.id, pos),
    })
  }, [])

  // 点击空白处关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // 按 Escape 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [contextMenu])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const currentIndex = scrollTabs.findIndex((t) => t.id === activeTabId)
      if (currentIndex === -1) return

      let nextIndex: number | null = null

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % scrollTabs.length
          break
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + scrollTabs.length) % scrollTabs.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = scrollTabs.length - 1
          break
        default:
          return
      }

      e.preventDefault()
      setActiveTab(scrollTabs[nextIndex].id)
    },
    [scrollTabs, activeTabId, setActiveTab],
  )

  // 右键菜单处理
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tab: { id: string; type: string; title: string }) => {
      e.preventDefault()
      const pinned = !!useTabStore.getState().tabs.find((t) => t.id === tab.id)?.pinned
      setContextMenu({ tabId: tab.id, tabType: tab.type, tabTitle: tab.title, pinned, x: e.clientX, y: e.clientY })
    },
    [],
  )

  // 点完菜单项后统一关闭：右键菜单 + ▾ 下拉一起消失
  // （右键 ▾ 隐藏标签时下拉保持展开，选中某个功能后二者同时关闭）
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setOverflowOpen(false)
  }, [])

  return (
    <div
      className="tab-bar"
      role="tablist"
      aria-label="标签栏"
      onKeyDown={handleKeyDown}
    >
      {/* 固定标签（期货/期权等 closable:false）：固定左侧、不随滚轮、无右键、无图标 */}
      {fixedTabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          data-tab-id={tab.id}
          tabIndex={0}
          aria-selected={tab.id === activeTabId}
          className={`tab-bar__market tab-bar__tab${tab.id === activeTabId ? ' tab-bar__tab--active' : ''}`}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            setActiveTab(tab.id)
          }}
          onContextMenu={(e) => e.preventDefault()} // 固定标签无右键菜单
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveTab(tab.id)
            }
          }}
        >
          <span className="tab-bar__title">{tab.title}</span>
        </div>
      ))}

      {/* 可滚动标签区：有界滚轮横滚，隐藏滚动条 */}
      <div className="tab-bar__scroll" ref={scrollRef}>
      {scrollTabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          data-tab-id={tab.id}
          tabIndex={0}
          aria-selected={tab.id === activeTabId}
          className={`tab-bar__tab${tab.id === activeTabId ? ' tab-bar__tab--active' : ''}${hiddenTabIds.includes(tab.id) ? ' tab-bar__tab--hidden' : ''}${!hiddenTabIds.includes(tab.id) && hasHidden ? ' tab-bar__tab--grow' : ''}`}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            setActiveTab(tab.id)
          }}
          onPointerDown={(e) => handleTabPointerDown(e, tab)}
          onContextMenu={(e) => handleContextMenu(e, tab)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveTab(tab.id)
            }
          }}
        >
          <span className="tab-bar__title">{tab.title}</span>
          {tab.closable && tab.pinned ? (
            <button
              type="button"
              aria-label="取消固定"
              title="取消固定"
              className="tab-bar__pin"
              onClick={(e) => {
                e.stopPropagation()
                togglePin(tab.id)
              }}
            >
              📌
            </button>
          ) : tab.closable ? (
            <button
              type="button"
              aria-label="关闭标签"
              className="tab-bar__close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      </div>

      {/* ▾ 溢出按钮：有隐藏标签才显示；点击展开隐藏标签列表 */}
      {hasHidden && (
        <div className="tab-bar__overflow" ref={overflowWrapRef}>
          <button
            type="button"
            className={`tab-bar__overflow-btn${overflowOpen ? ' tab-bar__overflow-btn--active' : ''}`}
            aria-label="溢出标签"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
          >
            ▾
          </button>
          {overflowOpen && (
            <div className="tab-bar__overflow-menu" role="menu" aria-label="隐藏标签">
              {hiddenTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  aria-selected={tab.id === activeTabId}
                  className={`tab-bar__overflow-item${tab.id === activeTabId ? ' tab-bar__overflow-item--active' : ''}`}
                  onClick={() => handleOverflowItemClick(tab)}
                  onContextMenu={(e) => {
                    // 隐藏标签在滚动区外不可直接右键，这里复用在标签右键菜单，提供关闭/固定/窗口化等操作。
                    // 不在此处关闭 ▾ 下拉：保持展开，等点完菜单项（mousedown 落在 wrap 外）再与右键菜单统一消失。
                    e.preventDefault()
                    handleContextMenu(e, tab)
                  }}
                >
                  {/* title 已含 emoji 前缀（如「📝 五档下单-IF2608」），不再单独渲染 icon，避免图标重复 */}
                  <span className="tab-bar__overflow-title">{tab.title}</span>
                  {tab.id === activeTabId && (
                    <span className="tab-bar__overflow-check" aria-label="当前标签">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tab-bar__separator" />
      {/* 收藏夹快速入口：hover 弹出（新建 + 列表，点击直接打开为悬浮窗） */}
      <div
        ref={collectionsWrapRef}
        className="tab-bar__collections-wrap"
        onMouseEnter={() => setCollectionsOpen(true)}
        onMouseLeave={() => setCollectionsOpen(false)}
      >
        <button
          type="button"
          className={`tab-bar__collections${collectionsOpen ? ' tab-bar__collections--active' : ''}`}
          aria-label="收藏夹"
          title="收藏夹"
          aria-expanded={collectionsOpen}
          onClick={() => setCollectionsOpen((v) => !v)}
        >
          📁
        </button>
        {collectionsOpen && <CollectionsFlyout onClose={() => setCollectionsOpen(false)} />}
      </div>
      {/* `+` 悬停选择栏：停靠打开底部功能栏标签 */}
      <div
        ref={addMenuWrapRef}
        className="tab-bar__add-wrap"
        onMouseEnter={() => setAddMenuOpen(true)}
        onMouseLeave={() => setAddMenuOpen(false)}
      >
        <button
          type="button"
          className={`tab-bar__add${addMenuOpen ? ' tab-bar__add--active' : ''}`}
          aria-label="新增标签"
          title="新增标签"
          aria-expanded={addMenuOpen}
          onClick={() => setAddMenuOpen(true)}
        >
          +
        </button>
        {addMenuOpen && (
          <div className="tab-bar__add-menu" role="menu" aria-label="新增标签选择">
            {ADD_TAB_ITEMS.map((item) => (
              <button
                key={item.type}
                type="button"
                role="menuitem"
                className="tab-bar__add-menu-item"
                onClick={() => handleAddItem(item)}
              >
                {/* 渲染完整 title（含图标），保证 getByText('📝 五档下单') 可命中单个元素 */}
                <span className="tab-bar__add-menu-label">{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-bar__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { closeTab(contextMenu.tabId); closeContextMenu() }}
          >
            <span className="tab-bar__context-icon">✕</span>
            <span>关闭</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { closeOthers(contextMenu.tabId); closeContextMenu() }}
          >
            <span className="tab-bar__context-icon">⊞</span>
            <span>关闭其他</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { closeAll(); closeContextMenu() }}
          >
            <span className="tab-bar__context-icon">⧉</span>
            <span>关闭所有</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { togglePin(contextMenu.tabId); closeContextMenu() }}
          >
            {/* icon 恒定 📌，label 恒为文字：与其他菜单项 icon+label 结构一致，避免错位 */}
            <span className="tab-bar__context-icon">📌</span>
            <span>{contextMenu.pinned ? '取消固定' : '固定'}</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { detachTabAt(contextMenu.tabId, { x: contextMenu.x, y: contextMenu.y }); closeContextMenu() }}
          >
            <span className="tab-bar__context-icon">🗗</span>
            <span>窗口化</span>
          </button>
        </div>
      )}
    </div>
  )
}
