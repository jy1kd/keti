# Bug Fix: 第一轮测试反馈汇总

> 来源：testing-guide.md 测试反馈（2026-07-29），持续更新中

## 问题描述

测试过程中发现的搜索、订阅、预设相关的交互异常。经代码验证和设计讨论，最终采用**方案 A：拆分预设合约与用户自选合约为两个独立视图**进行重构。

## Bug 列表

### Bug 1: 订阅按钮无反馈提示

- **状态**：已修复（重构后移除了订阅按钮，订阅通过搜索模态框操作）
- **代码定位**：`MarketPanel.tsx` — `handleSubscribeSelected` 无 `toast` 调用
- **严重程度**：低

### Bug 2: 搜索框与行情表格过滤逻辑不一致

- **状态**：已修复（重构后不再有"已订阅"过滤，双标签天然分离数据源）
- **原问题**：`ContractSearch` 使用 `contracts`（全量），表格使用 `displayContracts`（过滤后），数据源不一致
- **严重程度**：高

### Bug 3: 退订后预设合约消失

- **状态**：已修复（重构后预设合约和自选合约完全独立，退订只影响自选合约）
- **原问题**：`removeContractById` 错误修改 `presetIds`，且预设/用户合约混在同一数组
- **严重程度**：高

## 重构方案：方案 A — 双标签独立视图

参考无限易等实际交易终端，预设合约和自选合约是两个独立视图，互不影响。

### 设计

| 标签 | 数据源 | CTP 订阅 | 用户操作 |
|------|--------|---------|---------|
| 预设合约 | `presetContracts`（后端加载） | 始终订阅 | 不可退订 |
| 自选合约 | `userContracts`（localStorage） | 按需订阅/退订 | 可增删 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/stores/contracts.ts` | 拆分 `contracts` 为 `presetContracts` + `userContracts`，移除 `showSubscribedOnly` |
| `frontend/src/modules/market/MarketPanel.tsx` | 双标签布局，移除"已订阅"和"订阅"按钮，退订按钮仅自选标签可用 |
| `frontend/src/modules/market/styles.css` | 新增标签切换样式 |
| `frontend/src/stores/contracts.test.ts` | 更新测试适配新 store 结构 |
| `frontend/src/modules/market/MarketPanel.test.tsx` | 更新测试适配双标签布局 |

### 关键逻辑变更

1. `contracts` store：
   - 新增 `presetContracts[]`（预设，只增不减）
   - 新增 `userContracts[]`（用户自选，可增删）
   - 保留 `contracts[]`（合并视图，供 OrderForm 等其他组件使用）
   - `loadSubscribedContracts`：分别填充 `presetContracts` 和 `userContracts`
   - `removeContractById`：只操作 `userContracts`，移除 `isPreset` 判断

2. MarketPanel：
   - 新增 `activeTab: 'preset' | 'user'` 状态
   - `displayContracts` 根据 activeTab 切换数据源
   - 退订按钮：`disabled={!selectedInstrument || activeTab !== 'user' || !userSubscribedIds.has(selectedInstrument)}`

## 非 Bug（已排除）

### ~~搜索框不支持品种名称搜索~~

- **代码验证**：`ContractSearch/index.tsx:20-24` 搜索逻辑包含 `c.instrumentName.toLowerCase().includes(q)`，**支持名称搜索**
- **实际原因**：搜索范围仅限当前标签的合约列表。如需搜索新合约，使用搜索模态框
- **处理**：更新测试文档，说明搜索范围限制
