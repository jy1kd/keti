/**
 * OrderPage — 报单标签页
 *
 * 专业交易终端风格。标签页与浮动窗共用同一 P1 主体 `OrderTradeBody`
 * （左压缩参数区 TradeParams + 右三列十档盘口 MarketDepth）；
 * 浮动窗（统一浮动窗模式）额外承载原 OrderPopup 完整功能：
 * 账户栏 AccountBar + 行情统计栏 QuoteStatsBar（完整态）+ 底部工具条 FooterBar。
 */

import { useEffect } from 'react';
import { OrderTradeBody } from '@/modules/order/OrderTradeBody';
import { AccountBar } from '@/modules/order/AccountBar';
import { QuoteStatsBar } from '@/modules/order/QuoteStatsBar';
import { FooterBar } from '@/modules/order/FooterBar';
import { useOrderStore } from '@/modules/order/store';
import { useOrderLayoutStore } from '@/modules/order/layoutStore';
import { useTabStore } from '@/stores/tabs';
import './OrderPage.css';
// 双栏布局复用 OrderPopup 的样式类（.order-popup__body 等），保证与弹窗样式统一
import '@/modules/order/OrderPopup.css';

interface OrderPageProps {
  instrumentID?: string;
  /** 浮动窗口模式（报单标签脱离为浮动窗）：承载原 OrderPopup 完整功能 */
  floating?: boolean;
  /** 所属标签页 id：页内切换合约时更新该标签页 props 与标题 */
  tabId?: string;
}

export function OrderPage({ instrumentID, floating = false, tabId }: OrderPageProps) {
  const setOrderForm = useOrderStore((s) => s.setOrderForm);
  const expanded = useOrderLayoutStore((s) => s.expanded);
  const updateTab = useTabStore((s) => s.updateTab);

  // Set instrument ID from props
  useEffect(() => {
    if (instrumentID) {
      setOrderForm({ instrumentID });
    }
  }, [instrumentID, setOrderForm]);

  // 页内切换合约 → 更新所属标签页 props 与标题（id 稳定）；
  // useTabContractLocks 据此自动迁移订阅锁定（与 KLinePage 一致）。
  const handleSwitch = (code: string) => {
    if (tabId && code !== instrumentID) {
      updateTab(tabId, {
        props: { instrumentID: code },
        title: `📝 报单-${code}`,
      });
    }
  };

  // ── 浮动窗口模式（报单标签脱离为浮动窗）──
  // 统一浮动窗后承载原 OrderPopup 完整功能：账户栏 + P1 主体 + 行情统计栏（完整态）+ 底部工具条。
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
        <AccountBar instrumentID={instrumentID} />
        <OrderTradeBody instrumentID={instrumentID} onSwitch={handleSwitch} />
        {expanded && <QuoteStatsBar instrumentID={instrumentID} />}
        <FooterBar />
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

      {/* ── P1 报单主体（与浮动窗共用，保证样式统一）── */}
      {instrumentID && (
        <OrderTradeBody instrumentID={instrumentID} onSwitch={handleSwitch} />
      )}
    </div>
  );
}
