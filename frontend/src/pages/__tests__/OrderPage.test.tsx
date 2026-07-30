import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderPage } from '../OrderPage';
import { useContractsStore } from '@/stores/contracts';

describe('OrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up contracts store with test data
    useContractsStore.setState({
      contracts: [
        {
          instrumentID: 'IF2608',
          instrumentName: '沪深300',
          exchangeID: 'CFFEX',
          productID: 'IF',
          volumeMultiple: 300,
          priceTick: 0.2,
          expireDate: '2026-08-15',
          isTrading: 1,
          productClass: '1',
        },
      ],
      presetContracts: [],
      userContracts: [],
      presetIds: [],
    });
  });

  it('should render order form', () => {
    render(<OrderPage />);
    expect(screen.getByText('报单')).toBeDefined();
  });

  it('should display instrument ID when provided', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText('IF2608')).toBeDefined();
  });

  it('should render direction buttons', () => {
    render(<OrderPage />);
    expect(screen.getByText('买')).toBeDefined();
    expect(screen.getByText('卖')).toBeDefined();
  });

  it('should render submit button', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText(/买入 IF2608/)).toBeDefined();
  });
});
