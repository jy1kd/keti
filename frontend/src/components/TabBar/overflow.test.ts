import { describe, it, expect } from 'vitest'
import { computeTabOverflow } from './overflow'

describe('computeTabOverflow', () => {
  it('全部标签放得下时不隐藏任何标签', () => {
    const r = computeTabOverflow(['a', 'b', 'c'], 500, [100, 100, 100])
    expect(r.hiddenTabIds).toEqual([])
  })

  it('MAX_SCROLL 为 2 × 平均标签宽', () => {
    const r = computeTabOverflow(['a', 'b', 'c'], 100, [100, 100, 100])
    // 平均宽 100 → MAX_SCROLL 200
    expect(r.maxScroll).toBe(200)
  })

  it('右边缘超出「视口宽 + MAX_SCROLL」的标签视为隐藏', () => {
    // 容器 300，MAX_SCROLL=200，可到达右缘 500。
    // a 右缘100 b 右缘200 c 右缘300 d 右缘400 e 右缘500 f 右缘600 → f 隐藏
    const r = computeTabOverflow(['a','b','c','d','e','f'], 300, [100,100,100,100,100,100])
    expect(r.hiddenTabIds).toEqual(['f'])
  })

  it('空标签列表返回空结果', () => {
    const r = computeTabOverflow([], 300, [])
    expect(r.hiddenTabIds).toEqual([])
    expect(r.maxScroll).toBe(0)
  })
})
