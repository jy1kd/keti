import { create } from 'zustand'

interface OrderPopupState {
  /** 当前悬浮报单弹窗的合约；null 表示弹窗关闭 */
  instrumentID: string | null
  /** 打开弹窗；弹窗已开时切换合约 */
  openPopup: (instrumentID: string) => void
  /** 关闭弹窗 */
  closePopup: () => void
}

/**
 * OrderPopupStore — 悬浮报单弹窗状态
 *
 * 非模态悬浮弹窗的开关与当前合约。
 * 弹窗内容（五档盘口 + 报单表单）随 instrumentID 变化实时切换。
 */
export const useOrderPopupStore = create<OrderPopupState>((set) => ({
  instrumentID: null,
  openPopup: (instrumentID) => set({ instrumentID }),
  closePopup: () => set({ instrumentID: null }),
}))
