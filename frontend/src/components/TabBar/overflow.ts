/**
 * 计算溢出标签集合与有界滚轮的最大滚动量。
 *
 * 语义（设计文档 §2）：
 * - 滚轮横滚范围限制为「屏宽 + 2 个标签」，即 MAX_SCROLL = 2 × 平均标签宽。
 * - 隐藏判定：标签右边缘 > 视口宽 + MAX_SCROLL → 收进 `▾` 下拉。
 *
 * 纯函数：给定标签顺序、滚动容器可视宽度、各标签宽度，输出隐藏标签 ID 与最大滚动量。
 * tabWidths[i] 与 tabIds[i] 一一对应。
 */
export function computeTabOverflow(
  tabIds: string[],
  containerWidth: number,
  tabWidths: number[],
): { hiddenTabIds: string[]; maxScroll: number } {
  const total = tabWidths.reduce((sum, w) => sum + w, 0)
  const avg = tabWidths.length > 0 ? total / tabWidths.length : 0
  const maxScroll = 2 * avg

  const hiddenTabIds: string[] = []
  let left = 0
  for (let i = 0; i < tabIds.length; i++) {
    const width = tabWidths[i] ?? 0
    const right = left + width
    if (right > containerWidth + maxScroll) {
      hiddenTabIds.push(tabIds[i])
    }
    left += width
  }
  return { hiddenTabIds, maxScroll }
}
