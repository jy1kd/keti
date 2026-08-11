/**
 * KLinePage — K线标签页
 *
 * 专业交易终端风格的独立K线页面。
 * 顶部单一展示栏（合约搜索切换框 + 最新价 + 多周期 + 技术指标）由 KLineChart 标题栏承载，
 * 合约代码区即搜索框（可输入切换合约），不再并排显示静态合约代码。
 * 同时兼容 Electron 独立窗口模式。
 */

import { useEffect } from 'react';
import { KLineChart } from '@/modules/market/KLineChart';
import { ContractSearch } from '@/components/ContractSearch';
import { useMarketStore } from '@/modules/market/store';
import { useContractsStore } from '@/stores/contracts';
import { useTabStore } from '@/stores/tabs';
import { getKlineData } from '@/services/api';
import { PERIOD_MS } from '@/hooks/useMarketWs';
import { isElectron } from '@/services/electron';
import './KLinePage.css';

interface KLinePageProps {
  instrumentID?: string;
  /** 所属标签页 id：页内搜索切换合约时更新该标签页的 props 与标题 */
  tabId?: string;
}

/** 价格格式化：保留到 priceTick 精度 */
function formatPrice(n: number, tick: number): string {
  const decimals = tick < 1 ? String(tick).length - 1 : 0;
  return n.toFixed(decimals);
}

export function KLinePage({ instrumentID, tabId }: KLinePageProps) {
  const klineData = useMarketStore((s) => s.klineData);
  const currentPeriod = useMarketStore((s) => s.currentPeriod);
  const setPeriod = useMarketStore((s) => s.setPeriod);
  const setKlineData = useMarketStore((s) => s.setKlineData);
  const snapshots = useMarketStore((s) => s.snapshots);
  const contracts = useContractsStore((s) => s.contracts);
  const loadAllInstruments = useContractsStore((s) => s.loadAllInstruments);
  const updateTab = useTabStore((s) => s.updateTab);

  // Get contract info
  const contract = contracts.find((c) => c.instrumentID === instrumentID);
  const snapshot = instrumentID ? snapshots.get(instrumentID) : null;
  const priceTick = contract?.priceTick ?? 0.2;
  const latestPrice = snapshot?.lastPrice != null ? formatPrice(snapshot.lastPrice, priceTick) : '--';

  // 兜底加载合约列表：直接以 K线标签启动（如 Electron 独立窗口）时行情表未挂载，
  // contracts 可能为空，搜索切换依赖合约数据。
  useEffect(() => {
    if (contracts.length === 0) {
      loadAllInstruments();
    }
  }, [contracts.length, loadAllInstruments]);

  // 页内搜索切换合约：更新所属标签页 props 与标题（id 稳定），
  // useTabContractLocks 据此自动迁移订阅锁定。
  const handleSwitch = (newInstrumentID: string) => {
    if (tabId && newInstrumentID !== instrumentID) {
      updateTab(tabId, {
        props: { instrumentID: newInstrumentID },
        title: `📈 K线-${newInstrumentID}`,
      });
    }
  };

  // Fetch K-line data on mount and when period changes
  useEffect(() => {
    if (!instrumentID) return;

    getKlineData(instrumentID, currentPeriod, 200)
      .then((res) => {
        if (res.bars?.length) {
          const periodMs = PERIOD_MS[currentPeriod] ?? PERIOD_MS['1m'];
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
      <div className="kline-page__content">
        <KLineChart
          instrument={instrumentID ?? ''}
          latestPrice={latestPrice}
          klineData={data}
          period={currentPeriod}
          onPeriodChange={setPeriod}
          searchSlot={
            <ContractSearch
              key={instrumentID ?? ''}
              contracts={contracts}
              initialQuery={instrumentID ?? ''}
              onSelect={handleSwitch}
              placeholder={instrumentID ? undefined : '请选择合约'}
            />
          }
        />
      </div>
      {isElectron() && <div className="kline-page__electron-info">独立窗口模式</div>}
    </div>
  );
}
