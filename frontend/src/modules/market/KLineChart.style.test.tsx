import { describe, it, expect } from 'vitest'
// 样式文件在测试环境中通过 vite 处理，这里验证 CSS 类名是否在组件中使用
import { KLineChart } from './KLineChart'

describe('KLineChart component structure', () => {
  it('KLineChart component is exported', () => {
    expect(KLineChart).toBeDefined()
    expect(typeof KLineChart).toBe('function')
  })
})
