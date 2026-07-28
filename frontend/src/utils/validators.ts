/**
 * 校验价格 — 必须大于0，不能是NaN
 * 返回 null 表示通过，返回字符串表示错误信息
 */
export function validatePrice(price: number): string | null {
  if (Number.isNaN(price)) return '请输入有效价格'
  if (price <= 0) return '价格必须大于0'
  return null
}

/**
 * 校验数量 — 必须为正整数
 */
export function validateVolume(volume: number): string | null {
  if (Number.isNaN(volume)) return '请输入有效数量'
  if (volume <= 0) return '数量必须大于0'
  if (!Number.isInteger(volume)) return '数量必须为整数'
  return null
}

/**
 * 校验合约代码 — 不能为空
 */
export function validateInstrumentId(instrumentId: string): string | null {
  if (!instrumentId || instrumentId.trim() === '') return '请输入合约代码'
  return null
}

/**
 * 校验数量上限 — 根据报单类型和品种类型
 * 交易指令规则：
 *   市价：期货≤60手，期权≤30手
 *   限价：期货≤500手，期权≤100手
 * 返回 null 表示通过，返回字符串表示错误信息
 */
export function validateVolumeWithLimit(
  volume: number,
  orderType: 'limit' | 'market',
  productClass: string = '1',  // "1"=期货, "2"=期权
): string | null {
  const basic = validateVolume(volume)
  if (basic) return basic

  const isOption = productClass === '2'
  const limit = orderType === 'market'
    ? (isOption ? 30 : 60)
    : (isOption ? 100 : 500)

  if (volume > limit) return `数量不能超过${limit}手`
  return null
}
