/**
 * OrderPage — 报单标签页
 *
 * 专业交易终端风格的独立报单页面。
 * 顶部行情卡片显示合约关键数据，下方集成 OrderForm。
 */

import { useEffect, useMemo } from 'react';
import { OrderForm } from '@/modules/order/OrderForm';
import { useOrderStore } from '@/modules/order/store';
import { useMarketStore } from '@/modules/market/store';
import { useContractsStore } from '@/stores/contracts';
import { isElectron } from '@/services/electron';
import './OrderPage.css';

interface OrderPageProps {
  instrumentID?: string;
}

/** 千分位格式化（纯数字，无小数点） */
function formatInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** 价格格式化：保留到 priceTick 精度 */
function formatPrice(n: number, tick: number): string {
  const decimals = tick < 1 ? String(tick).length - 1 : 0;
  return n.toFixed(decimals);
}

export function OrderPage({ instrumentID }: OrderPageProps) {
  const setOrderForm = useOrderStore((s) => s.setOrderForm);
  const snapshots = useMarketStore((s) => s.snapshots);
  const contracts = useContractsStore((s) => s.contracts);

  // Set instrument ID from props
  useEffect(() => {
    if (instrumentID) {
      setOrderForm({ instrumentID });
    }
  }, [instrumentID, setOrderForm]);

  const snapshot = instrumentID ? snapshots.get(instrumentID) : null;
  const contract = contracts.find((c) => c.instrumentID === instrumentID);
  const priceTick = contract?.priceTick ?? 0.2;

  // ── 涨跌计算 ──

  const { changeVal, changePct, changeClass } = useMemo(() => {
    if (!snapshot || !snapshot.lastPrice || !snapshot.preSettlementPrice) {
      return { changeVal: '—', changePct: '—', changeClass: 'flat' };
    }
    const val = snapshot.lastPrice - snapshot.preSettlementPrice;
    const pct = snapshot.preSettlementPrice !== 0
      ? (val / snapshot.preSettlementPrice) * 100
      : 0;
    return {
      changeVal: (val >= 0 ? '+' : '') + formatPrice(val, priceTick),
      changePct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      changeClass: val > 0 ? 'up' : val < 0 ? 'down' : 'flat',
    };
  }, [snapshot, priceTick]);

  return (
    <div className="order-page">
      {/* ── 标题栏 ── */}
      <div className="order-page__title-bar">
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

      {/* ── 行情卡片 ── */}
      {instrumentID && (
        <div className="order-page__quote-card">
          {/* 头部：合约 + 涨跌 */}
          <div className="quote-card__header">
            <div className="quote-card__contract">
              <span className="quote-card__code">{instrumentID}</span>
              {contract && (
                <span className="quote-card__name">{contract.instrumentName}</span>
              )}
            </div>
            <div className={`quote-card__change quote-card__change--${changeClass}`}>
              <span className="quote-card__change-val">{changeVal}</span>
              <span className="quote-card__change-pct">{changePct}</span>
            </div>
          </div>

          <div className="quote-card__divider" />

          {/* 行情数据网格 */}
          <div className="quote-card__grid">
            <div className="quote-card__cell">
              <span className="quote-card__label">最新</span>
              <span className={`quote-card__value quote-card__value--highlight`}>
                {snapshot?.lastPrice != null ? formatPrice(snapshot.lastPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">买一</span>
              <span className="quote-card__value">
                {snapshot?.bidPrice1 != null ? formatPrice(snapshot.bidPrice1, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">卖一</span>
              <span className="quote-card__value">
                {snapshot?.askPrice1 != null ? formatPrice(snapshot.askPrice1, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">今开</span>
              <span className="quote-card__value">
                {snapshot?.openPrice != null ? formatPrice(snapshot.openPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">最高</span>
              <span className="quote-card__value quote-card__value--up">
                {snapshot?.highestPrice != null ? formatPrice(snapshot.highestPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">最低</span>
              <span className="quote-card__value quote-card__value--down">
                {snapshot?.lowestPrice != null ? formatPrice(snapshot.lowestPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">昨结</span>
              <span className="quote-card__value">
                {snapshot?.preSettlementPrice != null ? formatPrice(snapshot.preSettlementPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">涨停</span>
              <span className="quote-card__value quote-card__value--up">
                {snapshot?.upperLimitPrice != null ? formatPrice(snapshot.upperLimitPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">跌停</span>
              <span className="quote-card__value quote-card__value--down">
                {snapshot?.lowerLimitPrice != null ? formatPrice(snapshot.lowerLimitPrice, priceTick) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">成交量</span>
              <span className="quote-card__value">
                {snapshot?.volume != null ? formatInt(snapshot.volume) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">持仓</span>
              <span className="quote-card__value">
                {snapshot?.openInterest != null ? formatInt(snapshot.openInterest) : '—'}
              </span>
            </div>
            <div className="quote-card__cell">
              <span className="quote-card__label">交易所</span>
              <span className="quote-card__value quote-card__value--muted">
                {contract?.exchangeID || '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Electron 提示 ── */}
      {isElectron() && (
        <div className="order-page__electron-info">
          独立窗口模式
        </div>
      )}

      {/* ── 报单表单 ── */}
      <div className="order-page__form">
        <OrderForm priceTick={priceTick} />
      </div>
    </div>
  );
}
