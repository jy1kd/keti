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

const UP_COLOR = '#ef4444'
const DOWN_COLOR = '#22c55e'
const FLAT_COLOR = '#e6edf3'

/** productID → 品种中文名（SimNow 柜台不返中文名，前端本地映射） */
const PRODUCT_NAMES: Record<string, string> = {
  IF: '沪深300', IC: '中证500', IH: '上证50', IM: '中证1000',
  T: '10年国债', TF: '5年国债', TS: '2年国债', TL: '30年国债',
  cu: '沪铜', al: '沪铝', zn: '沪锌', pb: '沪铅',
  ni: '沪镍', sn: '沪锡', au: '沪金', ag: '沪银',
  rb: '螺纹钢', wr: '线材', hc: '热卷', ss: '不锈钢',
  fu: '燃料油', bu: '石油沥青', ru: '天然橡胶', sp: '纸浆',
  sc: '原油', lu: '低硫燃油',
  m: '豆粕', y: '豆油', a: '黄大豆1号', b: '黄大豆2号',
  p: '棕榈油', c: '玉米', cs: '玉米淀粉', j: '焦炭',
  jm: '焦煤', i: '铁矿石', eg: '乙二醇', eb: '苯乙烯',
  l: '塑料', pp: '聚丙烯', v: 'PVC', pg: '液化气',
  MA: '甲醇', TA: 'PTA', FG: '玻璃', SA: '纯碱',
  CF: '棉花', CY: '棉纱', SR: '白糖', OI: '菜油',
  RM: '菜粕', AP: '苹果', PK: '花生', CJ: '红枣',
  UR: '尿素', SH: '烧碱', PF: '短纤',
  bc: '国际铜', nr: '20号胶',
  SM: '硅铁', SF: '锰硅',
}

/** 从合约代码提取月份后缀（IF2608 → 2608） */
function extractMonth(instrumentID: string): string {
  const m = instrumentID.match(/\d+$/)
  return m ? m[0] : ''
}

/** 根据 productID + 合约代码组装显示名称（IF + IF2608 → 沪深3002608） */
function buildInstrumentName(productID: string, instrumentID: string): string {
  const productName = PRODUCT_NAMES[productID]
  if (!productName) return PLACEHOLDER
  return productName + extractMonth(instrumentID)
}

/** 根据 record.change 正负返回文字颜色 */
function priceColor(record: any): string {
  const change = typeof record?.change === 'number' ? record.change : 0
  if (change > 0) return UP_COLOR
  if (change < 0) return DOWN_COLOR
  return FLAT_COLOR
}

/** 列级 style 回调：通过 table.records 拿到行数据，按涨跌着色 */
function coloredStyle(args: any) {
  const record = args.table?.records?.[args.row]
  return { color: priceColor(record) }
}

const columns = [
  { field: 'instrumentID', title: '合约', width: 90 },
  { field: 'instrumentName', title: '合约名称', width: 140 },
  { field: 'exchangeID', title: '交易所', width: 70 },
  { field: 'expireDate', title: '到期日', width: 90 },
  { field: 'lastPrice', title: '最新价', width: 100, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 80, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 80, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 100, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 100, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 100 },
  { field: 'openInterest', title: '持仓量', width: 100 },
]

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined) {
  const displayName = buildInstrumentName(contract.productID, contract.instrumentID)
  if (!snap) {
    return {
      instrumentID: contract.instrumentID,
      instrumentName: displayName,
      exchangeID: contract.exchangeID || PLACEHOLDER,
      expireDate: contract.expireDate || PLACEHOLDER,
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
    instrumentName: displayName,
    exchangeID: contract.exchangeID || PLACEHOLDER,
    expireDate: contract.expireDate || PLACEHOLDER,
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
    if (rowIndex >= 0 && rowIndex < recordsRef.current.length) {
      const vtableRow = rowIndex + 1
      try {
        tableRef.current.selectRow(vtableRow)
        tableRef.current.scrollToCell({ row: vtableRow, col: 0 })
      } catch {
        // 表格内部状态尚未就绪（如 setRecords 还在 RAF 队列中），
        // 忽略本次高亮 — 下次 contracts/snapshots 更新时会自动重试
      }
    }
  }, [selectedInstrument, contracts])

  return <div ref={containerRef} className="market-table-container" />
}
