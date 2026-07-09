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
