import { useRef, useEffect } from 'react'
import { ListTable } from '@visactor/vtable'
import type { MarketSnapshot } from '@/services/types'

interface MarketTableProps {
  snapshots: Map<string, MarketSnapshot>
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

export function MarketTable({ snapshots, onRowClick, onRowDoubleClick }: MarketTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const onClickRef = useRef(onRowClick)
  const onDblClickRef = useRef(onRowDoubleClick)

  useEffect(() => { onClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onDblClickRef.current = onRowDoubleClick }, [onRowDoubleClick])

  useEffect(() => {
    if (!containerRef.current) return

    const records = Array.from(snapshots.values()).map(snapshotToRecord)

    const table = new ListTable(containerRef.current, {
      columns,
      records,
      theme: {
        defaultStyle: {
          fontSize: 12,
          fontFamily: 'Consolas, Monaco, monospace',
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

  // Update records when snapshots change
  useEffect(() => {
    if (!tableRef.current) return
    const records = Array.from(snapshots.values()).map(snapshotToRecord)
    tableRef.current.setRecords(records)
  }, [snapshots])

  return <div ref={containerRef} className="market-table-container" />
}
