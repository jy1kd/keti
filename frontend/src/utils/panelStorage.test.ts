import { describe, it, expect, beforeEach } from 'vitest'
import { savePanelSizes, loadPanelSizes } from './panelStorage'

describe('panelStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads panel sizes', () => {
    const sizes = { 'market-main': 70, 'market-side': 30 }
    savePanelSizes('market', sizes)
    const loaded = loadPanelSizes('market')
    expect(loaded).toEqual(sizes)
  })

  it('returns null when no saved sizes', () => {
    const loaded = loadPanelSizes('market')
    expect(loaded).toBeNull()
  })

  it('handles different layout keys', () => {
    savePanelSizes('market', { 'main': 70, 'side': 30 })
    savePanelSizes('app', { 'top': 75, 'bottom': 25 })

    expect(loadPanelSizes('market')).toEqual({ 'main': 70, 'side': 30 })
    expect(loadPanelSizes('app')).toEqual({ 'top': 75, 'bottom': 25 })
  })

  it('overwrites existing sizes for same key', () => {
    savePanelSizes('market', { 'main': 70 })
    savePanelSizes('market', { 'main': 60 })
    expect(loadPanelSizes('market')).toEqual({ 'main': 60 })
  })
})
