import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ContractInfo } from '@/services/types'
import './styles.css'

interface ContractSearchProps {
  contracts: ContractInfo[]
  onSelect?: (instrumentID: string) => void
}

export function ContractSearch({ contracts, onSelect }: ContractSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return contracts.filter(
      (c) =>
        c.instrumentID.toLowerCase().includes(q) ||
        c.instrumentName.toLowerCase().includes(q),
    )
  }, [query, contracts])

  // Reset activeIndex when results change
  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('.search-result-item')
    items[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = useCallback((instrumentID: string) => {
    onSelect?.(instrumentID)
    setQuery('')
    setIsOpen(false)
    setActiveIndex(-1)
  }, [onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && query.trim()) {
        setIsOpen(true)
        setActiveIndex(0)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % results.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex].instrumentID)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }, [isOpen, results, activeIndex, query, handleSelect])

  return (
    <div className="contract-search">
      <input
        ref={inputRef}
        type="text"
        placeholder="搜索合约..."
        className="search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => {
          if (query.trim()) setIsOpen(true)
        }}
        onBlur={() => {
          // delay to allow click on results
          setTimeout(() => {
            setIsOpen(false)
            setActiveIndex(-1)
          }, 150)
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && query.trim() && (
        <div className="search-results" ref={listRef}>
          {results.length > 0 ? (
            results.map((c, index) => (
              <div
                key={c.instrumentID}
                className={`search-result-item${index === activeIndex ? ' search-result-item--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(c.instrumentID)
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {c.instrumentID}
              </div>
            ))
          ) : (
            <div className="search-no-results">无匹配合约</div>
          )}
        </div>
      )}
    </div>
  )
}
