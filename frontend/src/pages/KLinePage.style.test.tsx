import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * KLinePage 布局回归测试 —— 防止 K线标签页 canvas 高度塌陷导致空白。
 *
 * 根因（PR-R16）：.kline-page__content 缺少 display:flex / flex-direction:column，
 * 使子元素 .kline-chart 的 flex:1 失效（非 flex item），canvas 高度塌陷为 0，
 * echarts 无法初始化 → K线区域空白。查询弹窗 .kline-query 声明了同样的 flex
 * 规则所以正常。jsdom 无法计算真实布局高度，故直接断言 CSS 源文件。
 */
function readCssBlock(selector: string): string {
  const css = readFileSync(resolve(__dirname, 'KLinePage.css'), 'utf-8')
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS block not found: ${selector}`)
  return match[1]
}

describe('KLinePage 布局（K线标签页空白回归）', () => {
  it('.kline-page__content 必须是 flex 列容器，让 .kline-chart 填满高度', () => {
    const block = readCssBlock('.kline-page__content')
    expect(block).toMatch(/display:\s*flex/)
    expect(block).toMatch(/flex-direction:\s*column/)
  })

  it('.kline-chart 高度不塌陷（flex:1 + min-height:0 生效）', () => {
    // 作为 .kline-page__content（flex 容器）的子项，flex:1 才能解析出确定高度
    const block = readCssBlock('.kline-page__content')
    expect(block).toMatch(/flex:\s*1/)
    expect(block).toMatch(/min-height:\s*0/)
  })
})
