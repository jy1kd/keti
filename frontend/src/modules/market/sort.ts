import type { ContractInfo, OptionChain, OptionQuote } from '@/services/types'
import { getProductName } from '@/utils/productNames'

/** 交易所展示顺序 */
const EXCHANGE_ORDER = ['SHFE', 'DCE', 'CZCE', 'CFFEX', 'INE', 'GFEX']

function exchangeRank(exchangeID: string): number {
  const i = EXCHANGE_ORDER.indexOf(exchangeID)
  return i === -1 ? EXCHANGE_ORDER.length : i
}

/** 数字自然比较：FG609 < FG610 < FG701（按数字段数值比较，非字符串序） */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** 期货排序：交易所固定顺序 → 品种字典序 → 合约月份数字升序 */
export function sortFutures(contracts: ContractInfo[]): ContractInfo[] {
  return [...contracts].sort((a, b) => {
    const ex = exchangeRank(a.exchangeID) - exchangeRank(b.exchangeID)
    if (ex !== 0) return ex
    const prod = a.productID.localeCompare(b.productID)
    if (prod !== 0) return prod
    return naturalCompare(a.instrumentID, b.instrumentID)
  })
}

/** 从标底 ID 去尾数字得品种（FG609 → FG） */
export function deriveUnderlyingProduct(underlyingInstrID: string): string {
  return underlyingInstrID.replace(/\d+$/, '')
}

export interface OptionGroup {
  underlyingID: string
  /** 期货列表中匹配到的标的合约；找不到（如指数期权 IO/HO/MO）为 undefined */
  underlying: ContractInfo | undefined
  options: ContractInfo[]
}

/** 期权分组 + 组内排序：标底自然升序；组内 到期日 → 类型(C前P后) → 行权价升序 */
export function groupOptionsByUnderlying(
  options: ContractInfo[],
  futures: ContractInfo[],
): OptionGroup[] {
  const futMap = new Map(futures.map((f) => [f.instrumentID, f]))
  const groups = new Map<string, ContractInfo[]>()
  for (const o of options) {
    const u = o.underlyingInstrID ?? ''
    if (!groups.has(u)) groups.set(u, [])
    groups.get(u)!.push(o)
  }
  const result: OptionGroup[] = []
  for (const [u, opts] of groups) {
    opts.sort((a, b) => {
      const d = (a.expireDate || '').localeCompare(b.expireDate || '')
      if (d !== 0) return d
      const t = (a.optionsType || '').localeCompare(b.optionsType || '')
      if (t !== 0) return t
      return (a.strikePrice ?? 0) - (b.strikePrice ?? 0)
    })
    result.push({ underlyingID: u, underlying: futMap.get(u), options: opts })
  }
  result.sort((a, b) => naturalCompare(a.underlyingID, b.underlyingID))
  return result
}

/** 标的不可订阅时（指数期权 MO/IO/HO 的 underlyingInstrID 非期货），
 * 合成一条仅作组头的标底合约：productClass='1'（走 underlying 红粗渲染分支），
 * isTrading=0（不可下单/不可订阅）。 */
export function syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo {
  const productID = deriveUnderlyingProduct(underlyingInstrID)
  return {
    instrumentID: underlyingInstrID,
    instrumentName: getProductName(productID),
    exchangeID: '',
    productID,
    volumeMultiple: 0,
    priceTick: 0,
    expireDate: '',
    isTrading: 0,
    productClass: '1',
    underlyingInstrID: undefined,
    optionsType: undefined,
    strikePrice: undefined,
  }
}

/**
 * 解析期权的完整标底合约 ID。
 * CTP 返回的期权合约 underlyingInstrID 在部分交易所（CZCE/GFEX）可能不完整：
 * 有的是完整标底（'FG610'），有的只有品种（'FG'），有的缺失（''）。
 * 该函数优先用完整的 underlyingInstrID（含数字）；缺失/只有品种时从 instrumentID 推断标底。
 *
 * instrumentID 形态：
 *  - 带分隔符：'FG610-C-1300' / 'p2609-C-9400' / 'lc2610-P-72000' → 取首段
 *  - 无分隔符：'RM611C2225' / 'cu2609C90000' / 'sc2612C610' → 取「字母+数字」前缀
 */
export function resolveUnderlyingInstrumentID(inst: { instrumentID?: string; underlyingInstrID?: string }): string {
  const u = inst.underlyingInstrID ?? ''
  // 含数字 = 完整标底（如 FG610、p2609）
  if (u && /\d/.test(u)) return u
  const id = inst.instrumentID ?? ''
  // 带分隔符：FG610-C-1300 → FG610
  if (id.includes('-')) {
    const first = id.split('-')[0]
    if (first && /\d/.test(first)) return first
  }
  // 无分隔符：RM611C2225 / cu2609C90000 → 字母+数字 前缀
  const m = id.match(/^([A-Za-z]+\d+)[CP]/)
  if (m) return m[1]
  return u // 兜底（可能为 '' 或品种名）
}

/**
 * 从全量合约列表构出期权链 Map（underlying → chains[]）。
 *
 * 仿照期货表的「contracts 一加载完就立刻能渲染」——ContractInfo 自带
 * underlyingInstrID / expireDate / optionsType / strikePrice 四个字段，
 * 已足够拼出 T 型行结构，无需再发 N 次 /api/market/option_chain?underlying。
 * 价格字段（lastPrice/bidPrice/askPrice/volume/openInterest/IV）置 0，
 * 由快照填充（snapshot effect 增量 updateRecords）。
 *
 * 返回的 Map 按到期日升序（与原后端返回后排序结果一致：每个 underlying 内
 * chains[0] = 最早到期）。
 */
export function buildOptionChainsFromContracts(
  options: ContractInfo[],
): Map<string, OptionChain[]> {
  // underlyings → (expireDate → { calls, puts })
  const grouped = new Map<string, Map<string, { calls: OptionQuote[]; puts: OptionQuote[] }>>()

  for (const c of options) {
    const u = c.underlyingInstrID ?? ''
    if (!u) continue
    const expire = c.expireDate ?? ''
    let byExpiry = grouped.get(u)
    if (!byExpiry) {
      byExpiry = new Map()
      grouped.set(u, byExpiry)
    }
    let bucket = byExpiry.get(expire)
    if (!bucket) {
      bucket = { calls: [], puts: [] }
      byExpiry.set(expire, bucket)
    }
    const quote: OptionQuote = {
      instrumentID: c.instrumentID,
      strikePrice: c.strikePrice ?? 0,
      // 价格字段保持 0——OptionQuote 必填字段类型为 number，调用方 valOrDash 兜底为 PLACEHOLDER。
      // 真实价格由 WS snapshot 增量填充（OptionsTable snapshot effect → updateRecords）。
      lastPrice: 0,
      bidPrice: 0,
      askPrice: 0,
      volume: 0,
      openInterest: 0,
      impliedVolatility: 0,
    }
    if (c.optionsType === '1') bucket.calls.push(quote)
    else if (c.optionsType === '2') bucket.puts.push(quote)
  }

  const result = new Map<string, OptionChain[]>()
  for (const [u, byExpiry] of grouped) {
    const chains: OptionChain[] = []
    for (const [expire, { calls, puts }] of byExpiry) {
      // 行权价升序（与原 OptionChain.calls/puts 后端顺序约定一致）
      calls.sort((a, b) => a.strikePrice - b.strikePrice)
      puts.sort((a, b) => a.strikePrice - b.strikePrice)
      chains.push({ underlying: u, expireDate: expire, calls, puts, updateTime: '' })
    }
    chains.sort((a, b) => a.expireDate.localeCompare(b.expireDate))
    result.set(u, chains)
  }
  return result
}
