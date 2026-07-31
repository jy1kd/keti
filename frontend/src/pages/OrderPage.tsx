/**
 * OrderPage
 *
 * Standalone order page for Electron windows.
 * This page can be opened in a separate window via WindowManager.
 */

import { useEffect } from 'react';
import { OrderForm } from '@/modules/order/OrderForm';
import { useOrderStore } from '@/modules/order/store';
import { useMarketStore } from '@/modules/market/store';
import { useContractsStore } from '@/stores/contracts';
import { isElectron } from '@/services/electron';

interface OrderPageProps {
  instrumentID?: string;
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

  // Get current snapshot for the instrument
  const snapshot = instrumentID ? snapshots.get(instrumentID) : null;

  // Get contract info for price tick
  const contract = contracts.find((c) => c.instrumentID === instrumentID);
  const priceTick = contract?.priceTick ?? 0.2;

  return (
    <div className="order-page">
      <div className="order-page__header">
        <h1>报单</h1>
        {instrumentID && (
          <div className="order-page__instrument">
            <span className="instrument-id">{instrumentID}</span>
            {snapshot && (
              <span className="instrument-price">
                最新价: {snapshot.lastPrice}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="order-page__content">
        <OrderForm priceTick={priceTick} />
      </div>

      <div className="order-page__footer">
        {isElectron() && (
          <div className="order-page__electron-info">
            <span>独立窗口模式</span>
          </div>
        )}
      </div>
    </div>
  );
}
