### Task 2: 行情表格新增 合约乘数/最小变动价位 列 + 固定列宽

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx:63-77,82-123,190`
- Test: `frontend/src/modules/market/MarketTable.test.tsx`

**Interfaces:**
- Consumes: `MarketTable` props 不变（`contracts: ContractInfo[]` 已含 `volumeMultiple` / `priceTick`）。
- Produces: 15 列固定宽度表格，`widthMode: 'standard'`；`buildRecord` 输出含 `volumeMultiple` / `priceTick`（number）。

- [ ] **Step 1: 写失败测试**

在 `MarketTable.test.tsx` 的 `describe('MarketTable')` 块内（状态列 tests 之后）追加：

```tsx
  it('columns 包含合约乘数与最小变动价位，且采用固定列宽 standard', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.widthMode).toBe('standard')
    const titles = options.columns.map((c: { title: string }) => c.title)
    expect(titles).toContain('合约乘数')
    expect(titles).toContain('最小变动价位')
    for (const col of options.columns) {
      expect(typeof col.width).toBe('number')
      expect(col.width as number).toBeGreaterThan(0)
    }
  })

  it('buildRecord 从 contract 填充合约乘数与最小变动价位（有快照）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0] // au2508
    expect(record.volumeMultiple).toBe(1000)
    expect(record.priceTick).toBe(0.02)
  })

  it('无快照时合约乘数/最小变动价位仍从 contract 显示（静态列）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={new Map()} />)
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0]
    expect(record.volumeMultiple).toBe(1000)
    expect(record.priceTick).toBe(0.02)
    expect(record.lastPrice).toBe('--')
  })
```

（`mockContracts` 第一条 `au2508` 的 `volumeMultiple: 1000, priceTick: 0.02` 已在文件第 9 行定义，无需改 fixture。）

- [ ] **Step 2: 运行验证失败**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx -t "合约乘数"`
Expected: FAIL（columns 无这两列、`widthMode` 为 `'adaptive'`、record 无这两个字段）

- [ ] **Step 3: 实现 — columns + buildRecord + widthMode**

`MarketTable.tsx`：

1. 替换 `columns`（第 63-77 行）为固定列宽 15 列，新增 `volumeMultiple` / `priceTick` 列，插入 到期日 之前：

```ts
const columns = [
  { field: 'instrumentID', title: '合约', width: 70 },
  { field: 'productName', title: '合约品种', width: 80 },
  { field: 'exchangeID', title: '交易所', width: 60 },
  { field: 'volumeMultiple', title: '合约乘数', width: 70 },
  { field: 'priceTick', title: '最小变动价位', width: 90 },
  { field: 'expireDate', title: '到期日', width: 85 },
  { field: 'status', title: '状态', width: 60, style: statusStyle },
  { field: 'lastPrice', title: '最新价', width: 90, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 80, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 80, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 90, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 90, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 90 },
  { field: 'openInterest', title: '持仓量', width: 90 },
  { field: 'favorite', title: '⭐', width: 50 },
]
```

2. `buildRecord` 两个分支各加两行（静态列，与 `expireDate` 同源 `contract`）：

- 无快照分支（第 85-101 行 return 对象）内加：
```ts
      volumeMultiple: contract.volumeMultiple,
      priceTick: contract.priceTick,
```
- 有快照分支（第 108-122 行 return 对象）内加同样的两行。

3. 第 190 行 `widthMode: 'adaptive',` → `widthMode: 'standard',`。

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`
Expected: 全部 PASS（含既有 `状态列为到期日右侧的列` —— 新列序 到期日→状态 紧邻关系不变；局部更新/行索引用例不受影响）

- [ ] **Step 5: 全量测试 + 构建**

Run: `cd frontend && npm test && npm run build`
Expected: 全绿，build 成功

- [ ] **Step 6: 提交**

```bash
git add src/modules/market/MarketTable.tsx src/modules/market/MarketTable.test.tsx
git commit -m "feat(market): 行情表格新增合约乘数/最小变动价位列，固定列宽 + 原生横向滚动"
```

---

## 自检记录（writing-plans Self-Review）

- **Spec 覆盖**：§1 查询面板删 Tab → Task 1；§2 补 2 列 → Task 2；§3 固定列宽 + 横向滚动 → Task 2（`widthMode:'standard'` + 每列显式 width）；§4 测试 → 两个 Task 各含 TDD 步骤。无缺项。
- **占位符扫描**：所有 code 步骤含具体内容。
- **类型一致性**：`volumeMultiple` / `priceTick` 在 columns、buildRecord、测试中一致；`QueryTab` 收窄在 store.ts 与两个测试文件中一致。
