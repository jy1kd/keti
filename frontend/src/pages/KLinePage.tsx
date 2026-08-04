/**
 * KLinePage — K线标签页
 *
 * 专业交易终端风格的独立K线页面。
 * 顶部标题栏显示合约代码/名称/最新价，下方集成 KLineChart（多周期 + 技术指标切换）。
 * 同时兼容 Electron 独立窗口模式。
 */

import { useEffect } from 'react';
import { KLineChart } from '@/modules/market/KLineChart';
import { useMarketStore } from '@/modules/market/store';
import { useContractsStore } from '@/stores/contracts';
import { getKlineData } from '@/services/api';
import { PERIOD_MS } from '@/hooks/useMarketWs';
import { isElectron } from '@/services/electron';
import './KLinePage.css';

interface KLinePageProps {
  instrumentID?: string;
}

/** 价格格式化：保留到 priceTick 精度 */
function formatPrice(n: number, tick: number): string {
  const decimals = tick < 1 ? String(tick).length - 1 : 0;
  return n.toFixed(decimals);
}

export function KLinePage({ instrumentID }: KLinePageProps) {
  const klineData = useMarketStore((s) => s.klineData);
  const currentPeriod = useMarketStore((s) => s.currentPeriod);
  const setPeriod = useMarketStore((s) => s.setPeriod);
  const setKlineData = useMarketStore((s) => s.setKlineData);
  const snapshots = useMarketStore((s) => s.snapshots);
  const contracts = useContractsStore((s) => s.contracts);

  // Get contract info
  const contract = contracts.find((c) => c.instrumentID === instrumentID);
  const snapshot = instrumentID ? snapshots.get(instrumentID) : null;
  const priceTick = contract?.priceTick ?? 0.2;
  const latestPrice = snapshot?.lastPrice != null ? formatPrice(snapshot.lastPrice, priceTick) : '—';

  // Fetch K-line data on mount and when period changes
  useEffect(() => {
    if (!instrumentID) return;

    getKlineData(instrumentID, currentPeriod, 200)
      .then((res) => {
        if (res.bars?.length) {
          const periodMs = PERIOD_MS[currentPeriod] ?? PERIOD_MS['5m'];
          const aligned = res.bars.map((bar) => ({
            ...bar,
            timestamp: Math.floor(bar.timestamp / periodMs) * periodMs,
          }));
          setKlineData(instrumentID, aligned);
        }
      })
      .catch((err) => {
        console.warn('[KLinePage] Failed to fetch kline data:', err);
      });
  }, [instrumentID, currentPeriod, setKlineData]);

  // Get K-line data for the instrument
  const data = instrumentID ? (klineData.get(instrumentID) ?? []) : [];

  return (
    <div className="kline-page">
      {/* ── 标题栏 ── */}
      <div className="kline-page__title-bar">
        <span className="kline-page__title">📈 K线</span>
        {instrumentID && <span className="kline-page__subtitle">{instrumentID}</span>}
      </div>

      {/* ── 合约选择提示 ── */}
      {!instrumentID && (
        <div className="kline-page__no-contract">
          请在行情表格中选择合约后打开K线标签
        </div>
      )}

      {/* ── 合约信息条 ── */}
      {instrumentID && (
        <div className="kline-page__info">
          <span className="kline-page__code">{instrumentID}</span>
          {contract && <span className="kline-page__name">{contract.instrumentName}</span>}
          <span className="kline-page__latest">
            <span className="kline-page__latest-label">最新</span>
            <span className="kline-page__latest-value">{latestPrice}</span>
          </span>
        </div>
      )}

      {/* ── K线图 ── */}
      {instrumentID && (
        <div className="kline-page__content">
          <KLineChart
            instrument={instrumentID}
            klineData={data}
            period={currentPeriod}
            onPeriodChange={setPeriod}
          />
        </div>
      )}

      {/* ── Electron 提示 ── */}
      {isElectron() && (
        <div className="kline-page__electron-info">
          独立窗口模式
        </div>
      )}
    </div>
  );
}
