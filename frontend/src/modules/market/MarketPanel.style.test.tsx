import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * MarketPanel 工具栏样式回归 —— 审查 🟡-1：
 * 宽屏下搜索区 max-width 360px + actions margin-left:auto 会在「全部/自选」与
 * 「仅交易中/收藏」之间产生空隙，与设计稿 §3.2 紧凑排布不一致。
 * 断言搜索区不设 max-width、操作区不设 margin-left:auto。
 */
function readCssBlock(selector: string): string {
  const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf-8')
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS block not found: ${selector}`)
  return match[1]
}

describe('MarketPanel 工具栏紧凑排布（审查 🟡-1）', () => {
  it('.market-toolbar__search 不设 max-width（flex 吃掉中间空间，无空隙）', () => {
    const block = readCssBlock('.market-toolbar__search')
    expect(block).toMatch(/flex:\s*1/)
    expect(block).not.toMatch(/max-width/)
  })

  it('.market-toolbar__actions 不设 margin-left:auto（与「全部/自选」紧排）', () => {
    const block = readCssBlock('.market-toolbar__actions')
    expect(block).not.toMatch(/margin-left/)
  })
})
