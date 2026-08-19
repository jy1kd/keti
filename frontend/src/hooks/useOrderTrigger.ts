import { useUserPrefsStore } from '@/stores/userPrefs'
import type { OrderTriggerConfig } from '@/services/types'

/** 读取盘口下单触发设置（五档/无限下单共用） */
export function useOrderTrigger(): OrderTriggerConfig {
  return useUserPrefsStore((s) => s.orderTrigger)
}
