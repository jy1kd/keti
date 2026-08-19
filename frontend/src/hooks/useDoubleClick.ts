import { useCallback, useRef } from 'react'

/**
 * 双击检测：返回一个 handler，首次调用启动计时；在 interval 内再次调用判定为双击。
 * 返回 { preview: () => void; double: () => void } —— 调用方在 handler 里自己区分。
 */
export function useDoubleClick(interval = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  // 返回一个 wrapAnyClick 函数：无论单击/双击先调用一次，双击由内部回调触发。
  // 但我们不需要 —— 直接在组件里用下面的方式。
  const register = useCallback((onClick: () => void, onDouble: () => void) => {
    return () => {
      if (timerRef.current) {
        // 已有第一次点击在途 → 本次为双击
        clearTimeout(timerRef.current)
        timerRef.current = null
        onDouble()
      } else {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          onClick()
        }, interval)
      }
    }
  }, [interval])

  return { register, reset }
}
