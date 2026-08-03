import { useState, useEffect, useRef, useCallback } from 'react'
import type { ContractInfo } from '@/services/types'

/** 搜索防抖间隔（毫秒） */
const SEARCH_DEBOUNCE_MS = 300

/**
 * 合约搜索 Hook
 *
 * 支持按合约代码、合约名称、品种代码搜索
 * 300ms 防抖避免频繁搜索
 *
 * @param contracts 合约列表
 * @returns 搜索状态和方法
 */
export function useContractSearch(contracts: ContractInfo[]) {
  const [query, setQuery] = useState('')
  const [filteredContracts, setFilteredContracts] = useState<ContractInfo[]>(contracts)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 合约列表变化时重新过滤
  useEffect(() => {
    if (!query.trim()) {
      setFilteredContracts(contracts)
      return
    }

    const lowerQuery = query.toLowerCase()
    const filtered = contracts.filter((c) => {
      const instrumentID = c.instrumentID?.toLowerCase() ?? ''
      const instrumentName = c.instrumentName?.toLowerCase() ?? ''
      const productID = c.productID?.toLowerCase() ?? ''
      return (
        instrumentID.includes(lowerQuery) ||
        instrumentName.includes(lowerQuery) ||
        productID.includes(lowerQuery)
      )
    })
    setFilteredContracts(filtered)
  }, [contracts, query])

  // 防抖更新 query
  const setQueryDebounced = useCallback((newQuery: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setQuery(newQuery)
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    query,
    setQuery: setQueryDebounced,
    filteredContracts,
  }
}
