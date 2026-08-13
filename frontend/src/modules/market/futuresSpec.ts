import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getProductName } from '@/utils/productNames'
import { getContractStatus } from '@/utils/contractStatus'
import { PLACEHOLDER, isValidPrice, coloredStyle, statusStyle, type QuoteTableSpec, type QuoteRecord } from './quoteTableCore'

const columns = [
  { field: 'instrumentID', title: '合约', width: 130 },
  { field: 'productName', title: '合约品种', width: 100 },
  { field: 'exchangeID', title: '交易所', width: 85 },
  { field: 'volumeMultiple', title: '合约乘数', width: 95 },
  { field: 'priceTick', title: '最小变动价位', width: 120 },
  { field: 'expireDate', title: '到期日', width: 115 },
  { field: 'status', title: '状态', width: 85, style: statusStyle },
  { field: 'lastPrice', title: '最新价', width: 90, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 115, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 115, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 120, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 120, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 90 },
  { field: 'openInterest', title: '持仓量', width: 90 },
  { field: 'favorite', title: '⭐', width: 60 },
]

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean): QuoteRecord {
  const productName = getProductName(contract.productID)
  const status = getContractStatus(contract)
  if (!snap) {
    return {
      kind: 'normal',
      instrumentID: contract.instrumentID,
      productName,
      exchangeID: contract.exchangeID || PLACEHOLDER,
      volumeMultiple: contract.volumeMultiple,
      priceTick: contract.priceTick,
      expireDate: contract.expireDate || PLACEHOLDER,
      status,
      lastPrice: PLACEHOLDER,
      change: PLACEHOLDER,
      changePercent: PLACEHOLDER,
      bidPrice1: PLACEHOLDER,
      askPrice1: PLACEHOLDER,
      volume: PLACEHOLDER,
      openInterest: PLACEHOLDER,
      favorite: isFavorited ? '⭐' : '☆',
    }
  }
  // preSettlementPrice 可能为 0（CTP DBL_MAX 被 sanitize 后），此时 fallback 到昨收
  const preSettlement = (snap.preSettlementPrice && snap.preSettlementPrice > 0)
    ? snap.preSettlementPrice
    : (snap.preClosePrice || snap.lastPrice)
  const change = snap.lastPrice - preSettlement
  const changePercent = preSettlement ? (change / preSettlement) * 100 : 0
  return {
    kind: 'normal',
    instrumentID: snap.instrumentID,
    productName,
    exchangeID: contract.exchangeID || PLACEHOLDER,
    volumeMultiple: contract.volumeMultiple,
    priceTick: contract.priceTick,
    expireDate: contract.expireDate || PLACEHOLDER,
    status,
    lastPrice: isValidPrice(snap.lastPrice) ? snap.lastPrice : PLACEHOLDER,
    change: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? change : PLACEHOLDER,
    changePercent: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? changePercent : PLACEHOLDER,
    bidPrice1: isValidPrice(snap.bidPrice1) ? snap.bidPrice1 : PLACEHOLDER,
    askPrice1: isValidPrice(snap.askPrice1) ? snap.askPrice1 : PLACEHOLDER,
    volume: snap.volume,
    openInterest: snap.openInterest,
    favorite: isFavorited ? '⭐' : '☆',
  }
}

export const futuresSpec: QuoteTableSpec = { columns, buildRecord }
