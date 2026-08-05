import type { ContractInfo } from '@/services/types'

export type ContractStatus = '交易中' | '已停牌' | '已到期'

/** 归一化日期：支持 YYYYMMDD 与 YYYY-MM-DD 两种格式，返回 YYYYMMDD */
function normalizeDate(s: string | undefined): string {
  if (!s) return ''
  return s.replace(/-/g, '')
}

/** 今日日期 YYYYMMDD（本地时区） */
function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${m}${day}`
}

/** 是否已到期：expireDate 存在且早于今日 */
export function isExpired(contract: Pick<ContractInfo, 'expireDate'>): boolean {
  const expire = normalizeDate(contract.expireDate)
  if (!/^\d{8}$/.test(expire)) return false
  return expire < todayStr()
}

/**
 * 计算合约状态：
 * - 已到期：expireDate 早于今日（即使 isTrading=1 也可能存在柜台未及时下架的到期合约）
 * - 交易中：isTrading===1 且未到期
 * - 已停牌：isTrading!==1
 */
export function getContractStatus(contract: ContractInfo): ContractStatus {
  if (isExpired(contract)) return '已到期'
  if (contract.isTrading === 1) return '交易中'
  return '已停牌'
}

/** 过滤开关：仅显示交易中合约（含未到期） */
export function isContractActive(contract: ContractInfo): boolean {
  return getContractStatus(contract) === '交易中'
}
