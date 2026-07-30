/**
 * KLinePage
 *
 * Standalone K-line page for Electron windows.
 * This page can be opened in a separate window via WindowManager.
 */

import { useEffect } from 'react';
import { KLineChart } from '@/modules/market/KLineChart';
import { useMarketStore } from '@/modules/market/store';
import { useContractsStore } from '@/stores/contracts';
import { getKlineData } from '@/services/api';
import { PERIOD_MS } from '@/hooks/useMarketWs';
import { isElectron } from '@/services/electron';

interface KLinePageProps {
  instrumentID: string;
}

export function KLinePage({ instrumentID }: KLinePageProps) {
  const klineData = useMarketStore((s) => s.klineData);
  const currentPeriod = useMarketStore((s) => s.currentPeriod);
  const setPeriod = useMarketStore((s) => s.setPeriod);
  const setKlineData = useMarketStore((s) => s.setKlineData);
  const contracts = useContractsStore((s) => s.contracts);

  // Get contract info
  const contract = contracts.find((c) => c.instrumentID === instrumentID);

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
      .catch(() => { /* 静默失败 */ });
  }, [instrumentID, currentPeriod, setKlineData]);

  // Get K-line data for the instrument
  const data = klineData.get(instrumentID) ?? [];

  return (
    <div className="kline-page">
      <div className="kline-page__header">
        <h1>K线图</h1>
        <div className="kline-page__instrument">
          <span className="instrument-id">{instrumentID}</span>
          {contract && (
            <span className="instrument-name">{contract.instrumentName}</span>
          )}
        </div>
      </div>

      <div className="kline-page__content">
        <KLineChart
          instrument={instrumentID}
          klineData={data}
          period={currentPeriod}
          onPeriodChange={setPeriod}
        />
      </div>

      <div className="kline-page__footer">
        {isElectron() && (
          <div className="kline-page__electron-info">
            <span>独立窗口模式</span>
          </div>
        )}
      </div>
    </div>
  );
}
