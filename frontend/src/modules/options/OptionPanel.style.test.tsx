import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readCssBlock(selector: string): string {
  const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf-8')
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS block not found: ${selector}`)
  return match[1]
}

describe('OptionPanel 自动填充', () => {
  it('.options-chain-table 以 height:100% 撑满可用高度（父级 .options-content 为 block 且已有 flex:1）', () => {
    const block = readCssBlock('.options-chain-table')
    expect(block).toMatch(/width:\s*100%/)
    expect(block).toMatch(/height:\s*100%/)
  })

  it('.options-panel 用 flex 填充（非固定 height:100%，避免与工具栏叠加溢出）', () => {
    const block = readCssBlock('.options-panel')
    expect(block).toMatch(/flex:\s*1\s+1\s+0/)
    expect(block).not.toMatch(/height:\s*100%/)
  })
})
