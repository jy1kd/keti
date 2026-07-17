import { useRef, useEffect } from 'react'
import { ListTable } from '@visactor/vtable'
import type { MarketSnapshot, ContractInfo } from '@/services/types'

interface MarketTableProps {
  contracts: ContractInfo[]
  snapshots: Map<string, MarketSnapshot>
  selectedInstrument?: string | null
  onRowClick?: (instrumentID: string, price: number) => void
  onRowDoubleClick?: (instrumentID: string, price: number) => void
}

const PLACEHOLDER = '--'

const columns = [
  { field: 'instrumentID', title: '合约', width: 100 },
  { field: 'lastPrice', title: '最新价', width: 100 },
  { field: 'change', title: '涨跌', width: 80 },
  { field: 'changePercent', title: '涨跌%', width: 80 },
  { field: 'bidPrice1', title: '买一', width: 100 },
  { field: 'askPrice1', title: '卖一', width: 100 },
  { field: 'volume', title: '成交量', width: 100 },
  { field: 'openInterest', title: '持仓量', width: 100 },
]

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined) {
  if (!snap) {
    return {
      instrumentID: contract.instrumentID,
      lastPrice: PLACEHOLDER,
      change: PLACEHOLDER,
      changePercent: PLACEHOLDER,
      bidPrice1: PLACEHOLDER,
      askPrice1: PLACEHOLDER,
      volume: PLACEHOLDER,
      openInterest: PLACEHOLDER,
    }
  }
  const preSettlement = snap.preSettlementPrice ?? snap.preClosePrice ?? snap.lastPrice
  const change = snap.lastPrice - preSettlement
  const changePercent = preSettlement ? (change / preSettlement) * 100 : 0
  return {
    instrumentID: snap.instrumentID,
    lastPrice: snap.lastPrice,
    change,
    changePercent,
    bidPrice1: snap.bidPrice1,
    askPrice1: snap.askPrice1,
    volume: snap.volume,
    openInterest: snap.openInterest,
  }
}

export function MarketTable({ contracts, snapshots, selectedInstrument, onRowClick, onRowDoubleClick }: MarketTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const onClickRef = useRef(onRowClick)
  const onDblClickRef = useRef(onRowDoubleClick)
  const recordsRef = useRef<ReturnType<typeof buildRecord>[]>([])
  const rafRef = useRef<number>(0)
  const pendingRef = useRef<{ contracts: ContractInfo[]; snapshots: Map<string, MarketSnapshot> } | null>(null)

  useEffect(() => { onClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onDblClickRef.current = onRowDoubleClick }, [onRowDoubleClick])

  useEffect(() => {
    if (!containerRef.current) return

    const records = contracts.map((c) => buildRecord(c, snapshots.get(c.instrumentID)))
    recordsRef.current = records

    const table = new ListTable(containerRef.current, {
      columns,
      records,
      widthMode: 'adaptive',
      theme: {
        underlayBackgroundColor: '#0d1117',
        defaultStyle: {
          fontSize: 12,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          color: '#e6edf3',
          bgColor: '#0d1117',
          borderColor: '#21262d',
          hover: {
            cellBgColor: '#1c2333',
          },
          select: {
            inlineRowBgColor: 'rgba(240, 180, 41, 0.12)',
          },
        },
        headerStyle: {
          fontSize: 11,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          fontWeight: '600',
          color: '#8b949e',
          bgColor: '#161b22',
          borderColor: '#30363d',
        },
        bodyStyle: {
          bgColor: '#0d1117',
          borderColor: '#21262d',
        },
        selectionStyle: {
          cellBorderColor: '#f0b429',
          cellBorderLineWidth: 1,
          cellBgColor: 'rgba(240, 180, 41, 0.08)',
          inlineRowBgColor: 'rgba(240, 180, 41, 0.12)',
        },
        scrollStyle: {
          scrollSliderColor: '#30363d',
          scrollRailColor: '#161b22',
          visible: 'always',
        },
        frameStyle: {
          borderColor: '#30363d',
          cornerRadius: 0,
        },
      },
    })

    table.on('click_cell', (args: any) => {
      const rowIndex = args.row - 1 // vtable row 0 = header, row 1 = first data row
      const record = recordsRef.current[rowIndex]
      if (record && onClickRef.current) {
        const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onClickRef.current(record.instrumentID, price)
      }
    })

    table.on('dblclick_cell', (args: any) => {
      const rowIndex = args.row - 1
      const record = recordsRef.current[rowIndex]
      if (record && onDblClickRef.current) {
        const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onDblClickRef.current(record.instrumentID, price)
      }
    })

    tableRef.current = table

    return () => {
      table.release()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update records when contracts or snapshots change (debounced via rAF)
  useEffect(() => {
    pendingRef.current = { contracts, snapshots }
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (!tableRef.current || !pendingRef.current) return
      const { contracts: c, snapshots: s } = pendingRef.current
      const records = c.map((contract) => buildRecord(contract, s.get(contract.instrumentID)))
      recordsRef.current = records
      tableRef.current.setRecords(records)
    })
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [contracts, snapshots])

  // 高亮选中合约行
  useEffect(() => {
    if (!tableRef.current || !selectedInstrument) return
    const rowIndex = contracts.findIndex((c) => c.instrumentID === selectedInstrument)
    if (rowIndex >= 0) {
      const vtableRow = rowIndex + 1
      tableRef.current.selectRow(vtableRow)
      tableRef.current.scrollToCell({ row: vtableRow, col: 0 })
    }
  }, [selectedInstrument, contracts])

  return <div ref={containerRef} className="market-table-container" />
}
