const STORAGE_PREFIX = 'simnow-panel-sizes-'

export function savePanelSizes(layoutKey: string, sizes: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + layoutKey, JSON.stringify(sizes))
  } catch {
    // localStorage might be full or disabled
  }
}

export function loadPanelSizes(layoutKey: string): Record<string, number> | null {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + layoutKey)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}
