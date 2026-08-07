import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const STORAGE_KEY = 'simnow-order-layout'

interface OrderLayoutState {
  /** 完整态（展开行情统计栏）；false=精简态（默认） */
  expanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
}

/**
 * OrderLayoutStore — 报单页布局偏好（精简态 / 完整态）
 *
 * 由原 OrderPopupStore.expanded 迁移而来：统一浮动窗口后，报单浮动窗
 * 的「完整态（展开行情统计栏）」偏好本地持久化，跨会话记忆。
 */
export const useOrderLayoutStore = create<OrderLayoutState>()(
  persist(
    (set) => ({
      expanded: false,
      toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
      setExpanded: (expanded) => set({ expanded }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ expanded: s.expanded }),
    }
  )
)
