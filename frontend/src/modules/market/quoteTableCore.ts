import type { MarketSnapshot, ContractInfo } from '@/services/types'
import type { ContractStatus } from '@/utils/contractStatus'

/** 行类型：普通行情行 / 期权标底行 / 期权行（Task 6 期权表用） */
export type QuoteRowKind = 'normal' | 'underlying' | 'option'

export interface QuoteRecord {
  instrumentID: string
  kind: QuoteRowKind
  [field: string]: unknown
}

export interface ColumnDef {
  field: string
  title: string
  width: number
  style?: (args: any) => any
}

export interface QuoteTableSpec {
  columns: ColumnDef[]
  buildRecord: (contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean) => QuoteRecord
  /** 可选：按记录返回行级样式覆盖（期权表标底行深色底用） */
  rowStyle?: (record: QuoteRecord) => Record<string, unknown> | undefined
}

export const PLACEHOLDER = '--'
export const CTP_INVALID_PRICE = 1.7976931348623157e+308
export const isValidPrice = (p: number) => p > 0 && p < CTP_INVALID_PRICE
export const UP_COLOR = '#ef4444'
export const DOWN_COLOR = '#22c55e'
export const FLAT_COLOR = '#e6edf3'

/** 根据 record.change 正负返回文字颜色 */
export function priceColor(record: any): string {
  const change = typeof record?.change === 'number' ? record.change : 0
  if (change > 0) return UP_COLOR
  if (change < 0) return DOWN_COLOR
  return FLAT_COLOR
}

/** 列级 style 回调：通过 table.records 拿到行数据，按涨跌着色
 * 注意：args.row 是 vtable 物理行号（0=表头），records 是 0 起始数据数组，需 -1 */
export function coloredStyle(args: any) {
  const record = args.table?.records?.[args.row - 1]
  return { color: priceColor(record) }
}

/** 状态列着色：交易中绿色 / 已停牌橙色 / 已到期灰色（row 需 -1，理由同上） */
export function statusStyle(args: any) {
  const record = args.table?.records?.[args.row - 1]
  const status = record?.status as ContractStatus | undefined
  if (status === '交易中') return { color: '#3fb950' }
  if (status === '已停牌') return { color: '#d29922' }
  return { color: '#8b949e' }
}

/** 金色活动锚点是否渲染：仅当锚点合约位于选中选区内（金在蓝内，防双高亮区） */
export function shouldRenderAnchor(
  selectedInstrument: string | null | undefined,
  selectedContracts?: Set<string>,
): boolean {
  if (!selectedInstrument) return false
  if (!selectedContracts || selectedContracts.size === 0) return false
  return selectedContracts.has(selectedInstrument)
}
