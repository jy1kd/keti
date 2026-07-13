import { useState, useMemo } from 'react'
import type { ContractInfo } from '@/services/types'
import './styles.css'

interface ContractSearchProps {
  contracts: ContractInfo[]
  onSelect?: (instrumentID: string) => void
}

export function ContractSearch({ contracts, onSelect }: ContractSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return contracts.filter(
      (c) =>
        c.instrumentID.toLowerCase().includes(q) ||
        c.instrumentName.toLowerCase().includes(q),
    )
  }, [query, contracts])

  const handleSelect = (instrumentID: string) => {
    onSelect?.(instrumentID)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="contract-search">
      <input
        type="text"
        placeholder="搜索合约..."
        className="search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onBlur={() => {
          // delay to allow click on results
          setTimeout(() => setIsOpen(false), 150)
        }}
      />
      {isOpen && query.trim() && (
        <div className="search-results">
          {results.length > 0 ? (
            results.map((c) => (
              <div
                key={c.instrumentID}
                className="search-result-item"
                onMouseDown={() => handleSelect(c.instrumentID)}
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
