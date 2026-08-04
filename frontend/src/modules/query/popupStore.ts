import { create } from 'zustand'
import { useMarketStore } from '@/modules/market/store'

interface QueryPopupState {
  /** 弹窗是否打开 */
  isOpen: boolean
  /**
   * 打开查询弹窗；传入合约时同步设置全局选中合约，
   * 使查询面板「合约/K线」子页显示该合约。
   */
  open: (instrumentID?: string) => void
  /** 关闭弹窗 */
  close: () => void
}

/**
 * QueryPopupStore — 悬浮查询弹窗状态
 *
 * 非模态悬浮弹窗的开关。
 * 查询面板为全局账户查询（报单/成交/持仓/资金/止损单/合约/K线），
 * 非按合约拆分，故仅维护 isOpen；open 可选传入合约同步到全局选中。
 */
export const useQueryPopupStore = create<QueryPopupState>((set) => ({
  isOpen: false,
  open: (instrumentID) => {
    if (instrumentID) {
      useMarketStore.getState().setSelectedInstrument(instrumentID)
    }
    set({ isOpen: true })
  },
  close: () => set({ isOpen: false }),
}))
