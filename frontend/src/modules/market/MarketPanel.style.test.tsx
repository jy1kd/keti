import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * MarketPanel 工具栏布局回归 —— 设计 4.5「功能靠左、搜索贴右」：
 * 搜索区用 margin-left:auto 把搜索簇推到最右（不设 max-width，避免宽屏下与左侧功能集群
 * 之间产生空隙）；操作区（仅交易中/收藏）不设 margin-left:auto，随「全部/自选」紧排。
 */
function readCssBlock(selector: string): string {
  const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf-8')
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS block not found: ${selector}`)
  return match[1]
}

describe('MarketPanel 工具栏布局（设计 4.5：功能靠左、搜索贴右）', () => {
  it('.market-toolbar__search 用 margin-left:auto 贴右，不设 max-width（无空隙）', () => {
    const block = readCssBlock('.market-toolbar__search')
    expect(block).toMatch(/margin-left:\s*auto/)
    expect(block).not.toMatch(/max-width/)
  })

  it('.market-toolbar__actions 不设 margin-left:auto（与「全部/自选」紧排）', () => {
    const block = readCssBlock('.market-toolbar__actions')
    expect(block).not.toMatch(/margin-left/)
  })
})

describe('MarketPanel 高度链修复（审查）', () => {
  it('.panel-content 不再同时声明 flex:1 与 height:100%（双重计数）', () => {
    const block = readCssBlock('.panel-content')
    expect(block).toMatch(/flex:\s*1/)
    expect(block).not.toMatch(/height:\s*100%/)
  })
})
