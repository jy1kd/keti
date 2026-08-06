/**
 * OrderPage — 报单标签页
 *
 * 专业交易终端风格。与报单弹窗 OrderPopup 共用同一 P1 主体 `OrderTradeBody`
 * （左压缩参数区 TradeParams + 右三列十档盘口 MarketDepth），标签页和弹窗样式统一。
 */

import { useEffect } from 'react';
import { OrderTradeBody } from '@/modules/order/OrderTradeBody';
import { useOrderStore } from '@/modules/order/store';
import './OrderPage.css';
// 双栏布局复用 OrderPopup 的样式类（.order-popup__body 等），保证与弹窗样式统一
import '@/modules/order/OrderPopup.css';

interface OrderPageProps {
  instrumentID?: string;
  /** 浮动窗口模式（报单标签拖出转为弹窗）：与行情面板 OrderPopup 一致 */
  floating?: boolean;
}

export function OrderPage({ instrumentID, floating = false }: OrderPageProps) {
  const setOrderForm = useOrderStore((s) => s.setOrderForm);

  // Set instrument ID from props
  useEffect(() => {
    if (instrumentID) {
      setOrderForm({ instrumentID });
    }
  }, [instrumentID, setOrderForm]);

  // ── 浮动窗口模式（报单标签拖出转为弹窗）──
  // 与行情面板 OrderPopup 一致：P1 主体（压缩参数区 + 三列十档盘口）。
  if (floating) {
    if (!instrumentID) {
      return (
        <div className="order-floating">
          <div className="order-page__no-contract">
            请在行情表格中选择合约后打开报单标签
          </div>
        </div>
      );
    }
    return (
      <div className="order-floating">
        <OrderTradeBody instrumentID={instrumentID} />
      </div>
    );
  }

  return (
    <div className="order-page">
      {/* ── 标题栏 ── */}
      <div className="order-page__title-bar" data-drag-handle>
        <span className="order-page__title">📝 报单</span>
        {instrumentID && (
          <span className="order-page__subtitle">{instrumentID}</span>
        )}
      </div>

      {/* ── 合约选择提示 ── */}
      {!instrumentID && (
        <div className="order-page__no-contract">
          请在行情表格中选择合约后打开报单标签
        </div>
      )}

      {/* ── P1 报单主体（与弹窗 OrderPopup 共用，保证样式统一）── */}
      {instrumentID && (
        <OrderTradeBody instrumentID={instrumentID} />
      )}
    </div>
  );
}
