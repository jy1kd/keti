import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const STORAGE_KEY = 'simnow-order-popup'

interface OrderPopupState {
  /** 当前悬浮报单弹窗的合约；null 表示弹窗关闭 */
  instrumentID: string | null
  /** 弹窗形态：false=精简态（默认，盯盘），true=完整态（展开行情统计栏） */
  expanded: boolean
  /** 打开弹窗；弹窗已开时切换合约 */
  openPopup: (instrumentID: string) => void
  /** 关闭弹窗 */
  closePopup: () => void
  /** 切换精简态 / 完整态 */
  toggleExpanded: () => void
  /** 显式设置弹窗形态（标题栏 `—` 收起 / FooterBar 展开） */
  setExpanded: (expanded: boolean) => void
}

/**
 * OrderPopupStore — 悬浮报单弹窗状态
 *
 * 非模态悬浮弹窗的开关与当前合约。
 * `expanded`（精简/完整态）本地持久化到 localStorage，跨会话记忆用户偏好；
 * `instrumentID`（弹窗开关）不持久化——弹窗会话态，每次打开默认关闭。
 */
export const useOrderPopupStore = create<OrderPopupState>()(
  persist(
    (set) => ({
      instrumentID: null,
      expanded: false,
      openPopup: (instrumentID) => set({ instrumentID }),
      closePopup: () => set({ instrumentID: null }),
      toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
      setExpanded: (expanded) => set({ expanded }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 仅持久化 expanded：弹窗开关 instrumentID 不跨会话恢复
      partialize: (s) => ({ expanded: s.expanded }),
    }
  )
)
