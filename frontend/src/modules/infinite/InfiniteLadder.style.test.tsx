import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readCssBlock(selector: string): string {
  const css = readFileSync(resolve(__dirname, 'InfiniteLadder.css'), 'utf-8')
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS block not found: ${selector}`)
  return match[1]
}

describe('InfiniteLadder 价格列居中', () => {
  it('.infinite-row__price 内容居中（非右对齐贴边）', () => {
    const block = readCssBlock('.infinite-row__price')
    expect(block).toMatch(/justify-content:\s*center/)
    expect(block).not.toMatch(/justify-content:\s*flex-end/)
  })

  it('列头价格居中，与行内价格对齐', () => {
    const block = readCssBlock('.ladder-head__cell--price')
    expect(block).toMatch(/justify-content:\s*center/)
  })
})
