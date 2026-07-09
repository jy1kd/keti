import { describe, it, expect } from 'vitest'
import { api, API_BASE } from './api'

describe('api (Axios 实例)', () => {
  it('API_BASE 有值', () => {
    expect(API_BASE).toBeTruthy()
  })

  it('api 实例存在且为 Axios 实例', () => {
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
  })

  it('api.defaults.baseURL 已配置', () => {
    expect(api.defaults.baseURL).toBeTruthy()
  })

  it('api.defaults.timeout 已配置', () => {
    expect(api.defaults.timeout).toBe(10000)
  })

  it('api.defaults.headers 包含 Content-Type: application/json', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})
