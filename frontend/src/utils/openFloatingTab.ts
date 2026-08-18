import { useTabStore, generateTabId, type TabType } from '@/stores/tabs'
import { defaultFloatingSize, FLOATING_CHROME_H, useFloatingWindowStore } from '@/stores/floatingWindows'
import { useMarketStore } from '@/modules/market/store'
import { detachTabAt } from './detachDrag'

interface OpenFloatingTabOptions {
  type: TabType
  title: string
  props?: Record<string, unknown>
  /** 浮动窗初始尺寸；缺省用 defaultFloatingSize() */
  size?: { w: number; h: number }
  /** 浮动窗初始位置（viewport 坐标）；缺省按窗口居中 */
  position?: { x: number; y: number }
}

/** 报单浮动窗初始尺寸（对齐原 OrderPopup 弹窗：宽 540 固定、高按内容约 620） */
export const ORDER_FLOATING_SIZE = { w: 620, h: 540 }

/**
 * openFloatingTab — 打开标签页并立即脱离为浮动窗口（统一「弹窗」入口）
 *
 * 浮动窗口机制天然支持 标签页 ↔ 浮动窗口 双向转换（⇧ 停靠回标签栏 / 拖拽脱离），
 * 所有右上角入口统一走此函数：标签不进标签栏、以浮动窗形态弹出。
 * openTab 会把新标签设为活跃；detachTabAt 对活跃标签脱离后又会把活跃切回 market，
 * 会拽走主窗口当前页（如从期权页双击标底 → 主窗口跳到期货页）。故脱离成功后恢复
 * 打开前的活跃标签，打开浮动窗不再干扰主窗口内容。
 * 返回 false 表示标签页数量达上限或脱离失败。
 */
export function openFloatingTab({ type, title, props = {}, size, position }: OpenFloatingTabOptions): boolean {
  const priorActive = useTabStore.getState().activeTabId
  const opened = useTabStore.getState().openTab({ type, title, props })
  if (!opened) return false

  const tabId = generateTabId(type, props)
  const { w, h } = size ?? defaultFloatingSize()
  const x = position ? position.x : Math.max(0, Math.round((window.innerWidth - w) / 2))
  const y = position ? position.y : Math.max(0, Math.round((window.innerHeight - h) / 2 - 20))
  const ok = detachTabAt(tabId, { x, y }, size)
  if (ok && priorActive) useTabStore.getState().setActiveTab(priorActive)
  return ok
}

/** 打开报单浮动窗：优先定位当前选中合约，否则空白报单窗 */
export function openOrderFloating(): boolean {
  const inst = useMarketStore.getState().selectedInstrument
  return openFloatingTab({
    type: 'order',
    title: inst ? `📝 五档下单-${inst}` : '📝 五档下单',
    props: inst ? { instrumentID: inst } : {},
    size: ORDER_FLOATING_SIZE,
  })
}

/** 打开K线浮动窗：有选中合约则直接定位到该合约 */
export function openKlineFloating(): boolean {
  const inst = useMarketStore.getState().selectedInstrument
  return openFloatingTab({
    type: 'kline',
    title: inst ? `📈 K线-${inst}` : '📈 K线',
    props: inst ? { instrumentID: inst } : {},
  })
}

/** 打开 T型报价悬浮窗：传 underlyingID 则预选该标底，否则空白（窗内自选） */
export function openTQuoteFloating(underlyingID?: string): boolean {
  return openFloatingTab({
    type: 'tquote',
    title: underlyingID ? `📉 T型报价-${underlyingID}` : '📉 T型报价',
    props: underlyingID ? { instrumentID: underlyingID } : {},
    size: { w: 900, h: 600 },
  })
}

/** 打开收藏夹悬浮窗：初始即为悬浮窗口（可 ⇧ 停靠回标签栏） */
export function openCollectionFloating(collectionId: string, name: string): boolean {
  return openFloatingTab({
    type: 'collection',
    title: `📁 ${name}`,
    props: { collectionId },
    size: { w: 900, h: 600 },
  })
}

/** 打开收藏夹管理页悬浮窗（原生菜单「📁 收藏夹」入口，内容同管理页标签） */
export function openCollectionsFloating(): boolean {
  return openFloatingTab({
    type: 'collections',
    title: '📁 收藏夹',
    size: { w: 900, h: 600 },
  })
}

/** 打开设置浮动窗 */
export function openSettingsFloating(): boolean {
  return openFloatingTab({ type: 'settings', title: '⚙ 设置' })
}

/** 打开网络监控浮动窗 */
export function openIpcMonitorFloating(): boolean {
  return openFloatingTab({ type: 'ipc-monitor', title: '📡 网络监控' })
}

/** 打开无限下单浮动窗：有选中合约则直接定位到该合约 */
export function openInfiniteFloating(): boolean {
  const inst = useMarketStore.getState().selectedInstrument
  return openFloatingTab({
    type: 'infinite',
    title: inst ? `♾️ 无限下单-${inst}` : '♾️ 无限下单',
    props: inst ? { instrumentID: inst } : {},
  })
}

/** 打开报单查询浮动窗 */
export function openOrdersQueryFloating(): boolean {
  return openFloatingTab({ type: 'query-orders', title: '📋 报单查询' })
}

/** 打开持仓查询浮动窗 */
export function openPositionsQueryFloating(): boolean {
  return openFloatingTab({ type: 'query-positions', title: '📋 持仓查询' })
}

/** 资金窗内容纵向 padding：`.account-query { padding: 8px }` 上下各 8px */
const ACCOUNT_QUERY_PADDING_V = 16

/**
 * 计算资金窗目标高度：账户卡片网格高度 + 内容 padding + 标题条。
 * 目标高度小于当前高度才返回（收缩），否则返回 null（避免裁卡/不覆盖用户手动拉高）。
 */
export function computeAccountWindowHeight(gridHeight: number, currentH: number): number | null {
  const fitted = Math.round(gridHeight + ACCOUNT_QUERY_PADDING_V + FLOATING_CHROME_H)
  return fitted < currentH ? fitted : null
}

/**
 * 单次尝试：资金窗已渲染出账户卡片网格时，把窗口高度收缩到刚好容纳（越矮越好），
 * 底部保持锚定（对齐行情表格底部）。返回是否完成（无需重试）。
 */
export function fitAccountWindowToContent(): boolean {
  const win = useFloatingWindowStore.getState().windows['tab-query-account']
  if (!win) return false
  const grid = document.querySelector<HTMLElement>('#floating-overlay .account-query .account-grid')
  if (!grid || grid.offsetHeight <= 0) return false
  const newH = computeAccountWindowHeight(grid.offsetHeight, win.h)
  if (newH == null) return true // 已够矮，不收缩
  const bottom = win.y + win.h
  useFloatingWindowStore.getState().resize('tab-query-account', { ...win, y: bottom - newH, h: newH })
  return true
}

/** 打开资金查询浮动窗：对齐行情表格（同宽），账户卡片渲染后收缩到刚好容纳 */
export function openAccountQueryFloating(): boolean {
  const rect = document.querySelector<HTMLElement>('.market-table-container')?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    const opened = openFloatingTab({
      type: 'query-account',
      title: '💰 资金查询',
      size: { w: Math.round(rect.width), h: Math.round(rect.height) },
      position: { x: Math.round(rect.left), y: Math.round(rect.top) },
    })
    // 账户数据异步加载，卡片渲染后收缩窗口（越矮越好）；最多重试约 1s
    if (opened) {
      let attempts = 0
      const tryFit = () => {
        if (fitAccountWindowToContent()) return
        if (++attempts < 20) setTimeout(tryFit, 50)
      }
      tryFit()
    }
    return opened
  }
  return openFloatingTab({ type: 'query-account', title: '💰 资金查询' })
}
