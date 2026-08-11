/**
 * vtable 滚动条统一主题 —— 行情表格（MarketTable）与期权链表格（TQuoteTable）共用，
 * 保证两处横向/纵向滚动条观感一致。
 */

/** vtable 滚动条厚度（px）：6px，低调细条，与全局原生滚动条一致 */
export const SCROLLBAR_SIZE = 6

/** 统一的低调滚动条：细灰滑块 + 透明轨道 + hover 表格时浮现 */
export const SCROLL_STYLE = {
  scrollSliderColor: 'rgba(139,148,158,0.45)',
  scrollRailColor: 'rgba(255,255,255,0.03)',
  width: SCROLLBAR_SIZE,
  visible: 'focus' as const,
  /** 进度条钉在表格视口底部（而非内容底部）：行数少时不再跑到上边 */
  barToSide: true,
}
