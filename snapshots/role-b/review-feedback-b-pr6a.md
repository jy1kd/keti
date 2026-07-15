# PR-6a Code Review 反馈

## 第 1 轮审查（初审）

**审查分支**：`feature/pr-6a-market-real-api`
**审查 commit**：`a2d767d` ~ `b0138d7`（6 commits）
**审查时间**：2026-07-15

---

### 🔴 阻断性问题（必须修改）

1. **【store.ts:33-38】fetchInstruments 未更新 contracts store，合约搜索功能失效**
   - 原因：`fetchInstruments()` 调用 `getInstruments()` API 后，仅返回数据但未存储到 `useContractsStore`。`useContractsStore` 有 `setContracts` 方法，但未被调用。
   - 影响：合约搜索框 (`ContractSearch`) 依赖 `useContractsStore.contracts` 进行搜索，由于数据未同步，搜索结果始终为空。
   - 建议：修改 `fetchInstruments` 实现：
     ```typescript
     fetchInstruments: async () => {
       try {
         const data = await getInstruments()
         if (data?.instruments) {
           useContractsStore.getState().setContracts(data.instruments)
         }
       } catch {
         // 网络失败不影响现有状态
       }
     }
     ```

2. **【App.tsx / MarketPanel.tsx】useMarketWs Hook 未被调用，WebSocket 推送未启用**
   - 原因：`useMarketWs` Hook 已实现，但在 `MarketPanel.tsx` 或 `App.tsx` 中未看到调用代码。
   - 影响：行情数据无法通过 WebSocket 实时推送，只能通过 `getSnapshots` 获取静态快照。
   - 建议：在 `MarketPanel.tsx` 或 `App.tsx` 中添加：
     ```typescript
     import { useMarketWs } from '@/hooks/useMarketWs'
     import { API_BASE } from '@/services/api'

     // 在组件内调用
     useMarketWs(API_BASE.replace('http', 'ws'))
     ```

3. **【stores/contracts.ts:14】contracts store 仍使用 mock 数据**
   - 原因：`contracts: import.meta.env.DEV ? MOCK_CONTRACTS : []` 仍然存在。
   - 影响：PR-6a 目标是移除所有 mock 数据，但 contracts store 仍依赖 mock。开发环境合约列表来自 mock 而非 API。
   - 建议：将 `contracts` 初始值改为空数组 `[]`，完全依赖 `fetchInstruments` 获取数据。

---

### 🟡 改进建议

1. **【store.ts:40-56】subscribeInstruments 错误处理过于静默**
   - 现状：`catch {}` 空块，网络失败时用户无感知。
   - 建议：至少添加 `console.warn('[MarketStore] subscribeInstruments failed:', error)` 便于调试。

2. **【useMarketWs.ts:18】WSManager.connect 端点路由需确认**
   - 现状：`ws.connect('market', callback)` 假设 WSManager 支持端点参数路由到 `/ws/market`。
   - 建议：确认 `WSManager.connect` 方法是否已实现端点路由功能，或需要传完整 URL。

3. **【MarketPanel.tsx:12-14】fetchInstruments 缺少防重复调用机制**
   - 现状：每次组件渲染都会触发 `fetchInstruments`（虽然 zustand 方法引用稳定，但 StrictMode 会调用两次）。
   - 建议：添加 loading 状态或使用 ref 标记已加载。

4. **【api.ts:46-49】getInstruments 返回类型不明确**
   - 现状：返回 `any`，缺少类型定义。
   - 建议：定义返回类型接口：
     ```typescript
     interface InstrumentsResponse {
       instruments: ContractInfo[]
       count: number
     }
     export async function getInstruments(keyword?: string): Promise<InstrumentsResponse> { ... }
     ```

---

### 🔵 疑问确认

1. **【store.ts:44-50】subscribeInstruments 获取快照的时机**
   - 疑问：`subscribeInstruments` 在订阅成功后立即调用 `getSnapshots`，但后端可能尚未推送数据。
   - 确认：是否应该等待 WebSocket 推送而非主动查询？或两者并行？

2. **【useMarketWs.ts】连接地址构造**
   - 疑问：Hook 接收 `wsBaseUrl` 参数，但实际调用位置未见。
   - 确认：`API_BASE` 是 `http://localhost:8000`，WebSocket 地址应为 `ws://localhost:8000`，如何转换？

3. **【MarketPanel.tsx:19-21】contractsInMarket 过滤逻辑**
   - 现状：`contracts.filter((c) => snapshots.has(c.instrumentID))` 只显示有行情数据的合约。
   - 疑问：如果用户搜索新合约（尚无行情数据），搜索结果会为空。是否需要显示所有合约？

---

### 审查结论

**❌ 需要修改后再审**

**理由**：
1. 🔴 3 个阻断性问题必须修复：
   - fetchInstruments 未同步到 contracts store → 合约搜索失效
   - useMarketWs 未调用 → WebSocket 推送未启用
   - contracts store 仍用 mock → 与 PR 目标不符
2. 测试虽然通过，但核心功能（合约搜索、实时推送）未真正集成
3. 代码逻辑完整，但调用链断开

**下一步**：
请切回开发窗口，按以下优先级修复：
1. 修复 `fetchInstruments` 同步到 `useContractsStore`
2. 在 `MarketPanel.tsx` 或 `App.tsx` 调用 `useMarketWs`
3. 移除 `contracts.ts` 中的 mock 数据
4. 运行测试确认通过
5. 更新 dev-record-b.md
6. 修复完成后切审查窗口进行复审
