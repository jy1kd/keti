import { useRef, useEffect } from 'react'
import { ListTable } from '@visactor/vtable'
import type { MarketSnapshot } from '@/services/types'

interface MarketTableProps {
  snapshots: Map<string, MarketSnapshot>
  selectedInstrument?: string | null
  onRowClick?: (instrumentID: string, price: number) => void
  onRowDoubleClick?: (instrumentID: string, price: number) => void
}

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

function snapshotToRecord(snap: MarketSnapshot) {
  const preClose = snap.preClosePrice || snap.preSettlementPrice || snap.lastPrice
  const change = snap.lastPrice - preClose
  const changePercent = preClose ? (change / preClose) * 100 : 0
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

export function MarketTable({ snapshots, selectedInstrument, onRowClick, onRowDoubleClick }: MarketTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const onClickRef = useRef(onRowClick)
  const onDblClickRef = useRef(onRowDoubleClick)
  const rafRef = useRef<number>(0)
  const pendingSnapshotsRef = useRef<Map<string, MarketSnapshot> | null>(null)

  useEffect(() => { onClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onDblClickRef.current = onRowDoubleClick }, [onRowDoubleClick])

  useEffect(() => {
    if (!containerRef.current) return

    const records = Array.from(snapshots.values()).map(snapshotToRecord)

    const table = new ListTable(containerRef.current, {
      columns,
      records,
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
      const record = records[args.row]
      if (record && onClickRef.current) {
        onClickRef.current(record.instrumentID, record.lastPrice)
      }
    })

    table.on('dblclick_cell', (args: any) => {
      const record = records[args.row]
      if (record && onDblClickRef.current) {
        onDblClickRef.current(record.instrumentID, record.lastPrice)
      }
    })

    tableRef.current = table

    return () => {
      table.release()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update records when snapshots change (debounced via rAF)
  useEffect(() => {
    pendingSnapshotsRef.current = snapshots
    if (rafRef.current) return // 已有待处理的 rAF，跳过
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (!tableRef.current || !pendingSnapshotsRef.current) return
      const records = Array.from(pendingSnapshotsRef.current.values()).map(snapshotToRecord)
      tableRef.current.setRecords(records)
    })
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [snapshots])

  // 高亮选中合约行
  useEffect(() => {
    if (!tableRef.current || !selectedInstrument) return
    const records = Array.from(snapshots.values()).map(snapshotToRecord)
    const rowIndex = records.findIndex((r) => r.instrumentID === selectedInstrument)
    if (rowIndex >= 0) {
      // vtable 行索引：0 是表头，数据行从 1 开始
      const vtableRow = rowIndex + 1
      tableRef.current.selectRow(vtableRow)
      tableRef.current.scrollToCell({ row: vtableRow, col: 0 })
    }
  }, [selectedInstrument, snapshots])

  return <div ref={containerRef} className="market-table-container" />
}
