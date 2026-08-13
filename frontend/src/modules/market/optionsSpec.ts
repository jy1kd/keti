import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getContractStatus } from '@/utils/contractStatus'
import { PLACEHOLDER, isValidPrice, coloredStyle, statusStyle, type QuoteTableSpec, type QuoteRecord, type QuoteRowKind } from './quoteTableCore'

const columns = [
  { field: 'instrumentID', title: '合约', width: 150 },
  { field: 'contractType', title: '类型', width: 50, style: statusStyle },
  { field: 'strikePrice', title: '行权价', width: 90 },
  { field: 'expireDate', title: '到期日', width: 115 },
  { field: 'exchangeID', title: '交易所', width: 85 },
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
  const kind: QuoteRowKind = contract.productClass === '1' ? 'underlying' : 'option'
  const status = getContractStatus(contract)
  const contractType = kind === 'underlying' ? '标' : (contract.optionsType === '1' ? 'C' : 'P')
  const base = {
    instrumentID: contract.instrumentID,
    kind,
    contractType,
    strikePrice: kind === 'option' ? contract.strikePrice : PLACEHOLDER,
    expireDate: contract.expireDate || PLACEHOLDER,
    exchangeID: contract.exchangeID || PLACEHOLDER,
    status,
    favorite: isFavorited ? '⭐' : '☆',
  }
  if (!snap) {
    return { ...base, lastPrice: PLACEHOLDER, change: PLACEHOLDER, changePercent: PLACEHOLDER, bidPrice1: PLACEHOLDER, askPrice1: PLACEHOLDER, volume: PLACEHOLDER, openInterest: PLACEHOLDER }
  }
  const preSettlement = (snap.preSettlementPrice && snap.preSettlementPrice > 0) ? snap.preSettlementPrice : (snap.preClosePrice || snap.lastPrice)
  const change = snap.lastPrice - preSettlement
  const changePercent = preSettlement ? (change / preSettlement) * 100 : 0
  return {
    ...base,
    lastPrice: isValidPrice(snap.lastPrice) ? snap.lastPrice : PLACEHOLDER,
    change: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? change : PLACEHOLDER,
    changePercent: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? changePercent : PLACEHOLDER,
    bidPrice1: isValidPrice(snap.bidPrice1) ? snap.bidPrice1 : PLACEHOLDER,
    askPrice1: isValidPrice(snap.askPrice1) ? snap.askPrice1 : PLACEHOLDER,
    volume: snap.volume,
    openInterest: snap.openInterest,
  }
}

/** 标底行：深色底 + 上分隔线 */
function rowStyle(record: QuoteRecord): Record<string, unknown> | undefined {
  if (record.kind === 'underlying') return { bgColor: '#1a2230' }
  return undefined
}

export const optionsSpec: QuoteTableSpec = { columns, buildRecord, rowStyle }
