/**
 * vtable 滚动条统一主题 —— 行情表格（MarketTable）与期权链表格（TQuoteTable）共用，
 * 保证两处横向/纵向滚动条观感一致。
 */

/** vtable 滚动条厚度（px）：加粗，便于抓握与发现 */
export const SCROLLBAR_SIZE = 12

/** 明显的滚动条：加粗(12px) + 高亮蓝滑块 + 浅色轨道 + 常显 */
export const PROMINENT_SCROLL_STYLE = {
  scrollSliderColor: '#4a9eff',
  scrollRailColor: '#21262d',
  width: SCROLLBAR_SIZE,
  visible: 'always' as const,
}
