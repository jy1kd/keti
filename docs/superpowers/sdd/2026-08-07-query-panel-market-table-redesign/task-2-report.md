# Task 2 Report: 行情表格新增 合约乘数/最小变动价位 列 + 固定列宽

Status: DONE

Commit: `02ee649` on branch `feature/table-refactor`

## 变更内容（按文件）

### `frontend/src/modules/market/MarketTable.tsx`
- 替换 `columns`（15 列固定宽度数组）：
  - 新增 `volumeMultiple`（合约乘数, width 70）和 `priceTick`（最小变动价位, width 90），插入在 到期日 之前。
  - 每列都改为显式 `width`（合约 70 / 合约品种 80 / 交易所 60 / 合约乘数 70 / 最小变动价位 90 / 到期日 85 / 状态 60 / 最新价 90 / 涨跌 80 / 涨跌% 80 / 买一 90 / 卖一 90 / 成交量 90 / 持仓量 90 / ⭐ 50）。
  - 列顺序与 brief Step 3 的 15 列数组逐字一致。
- `buildRecord` 两个分支（无快照 / 有快照）各加两行静态字段：
  - `volumeMultiple: contract.volumeMultiple`
  - `priceTick: contract.priceTick`
  - 与 `expireDate` 同源 `contract`，无快照时仍显示。
- `widthMode: 'adaptive'` → `widthMode: 'standard'`，配合已有的 `scrollStyle.visible: 'always'`，溢出显示原生横向滚动条。列宽调整仍由 vtable 默认开启。

### `frontend/src/modules/market/MarketTable.test.tsx`
- 在状态列 tests 之后、`// --- onVisibleRangeChange tests ---` 之前追加 brief Step 1 的 3 个测试（verbatim）：
  1. columns 包含合约乘数与最小变动价位，且采用固定列宽 standard
  2. buildRecord 从 contract 填充合约乘数与最小变动价位（有快照）
  3. 无快照时合约乘数/最小变动价位仍从 contract 显示（静态列）
- 未改 `mockContracts` fixture（`au2508` 的 `volumeMultiple: 1000, priceTick: 0.02` 已存在）。

## 测试与验证命令及结果

| 步骤 | 命令 | 结果 |
|------|------|------|
| Step 2（红） | `npx vitest run src/modules/market/MarketTable.test.tsx -t "合约乘数"` | FAIL，3 failed（columns 无新列、widthMode 仍 adaptive、record 无新字段）符合预期 |
| Step 4（绿） | `npx vitest run src/modules/market/MarketTable.test.tsx` | 27 passed |
| Step 5 全量 | `npm test` | 92 files / 1048 tests 全部 passed |
| 类型检查 | `npx tsc --noEmit` | 无错误 |
| 构建 | `npm run build` | 成功（`dist/` 产出；chunk 大小与 electron 动态导入告警为既有问题，与本变更无关） |

## 与 brief 的偏差

无偏差。所有代码均按 brief Step 1 / Step 3 逐字实现；提交信息使用 brief Step 6 原文。未改动 `services/api.ts`，未新增任何 API 调用。

## 自检记录

- 列顺序与 brief 15 列数组逐字一致（到期日 → 状态 紧邻关系不变，既有测试 `状态列为到期日右侧的列` 仍通过）。
- 新增字段均来自 `ContractInfo`（`volumeMultiple` / `priceTick` 为必填 number），两条 buildRecord 分支一致。
- 收藏列仍是最后一列（index = `columns.length - 1`），click handler 的收藏列判断不受影响。
- 固定列宽不持久化（无 localStorage / 无额外 state），符合约束。
- 列 resize 未显式配置，保持 vtable 默认开启。
