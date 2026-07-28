# PR-6a 审查反馈处理记录

## 第 1 轮审查反馈处理

**处理时间**：2026-07-15
**审查反馈文件**：review-feedback-b-pr6a.md

---

### 🔴 阻断性问题（已修复 3 条）

#### #1 fetchInstruments 未同步到 contracts store
- **状态**：✅ 已修复
- **修复内容**：`store.ts` 中 `fetchInstruments` 调用 API 后，同步调用 `useContractsStore.getState().setContracts(data.instruments)`
- **Commit**：`8ac415e`

#### #2 useMarketWs Hook 未被调用
- **状态**：✅ 已修复
- **修复内容**：`MarketPanel.tsx` 中导入并调用 `useMarketWs(API_BASE.replace('http', 'ws'))`
- **Commit**：`5326be4`

#### #3 contracts store 仍使用 mock 数据
- **状态**：✅ 已修复
- **修复内容**：删除 `contracts.ts` 中的 `MOCK_CONTRACTS` 导入和 `import.meta.env.DEV` 判断，contracts 初始值改为空数组
- **Commit**：`c05b4e1`

---

### 🟡 改进建议（采纳 3 条，保留 1 条）

#### #1 subscribeInstruments 错误处理过于静默
- **状态**：✅ 采纳
- **修复内容**：`catch` 块中添加 `console.warn('[MarketStore] subscribeInstruments failed:', error)`

#### #2 WSManager.connect 端点路由确认
- **状态**：✅ 无需修改
- **说明**：WSManager.connect 已实现端点路由，`${baseUrl}/ws/${endpoint}` 格式正确。传入 `ws://localhost:8000` 会连接 `ws://localhost:8000/ws/market`。

#### #3 fetchInstruments 防重复调用
- **状态**：✅ 采纳
- **修复内容**：`MarketPanel.tsx` 中添加 `useRef(false)` 标记，防止 React StrictMode 重复调用

#### #4 getInstruments 返回类型
- **状态**：✅ 采纳
- **修复内容**：定义 `InstrumentsResponse`、`SubscribeResponse`、`SnapshotsResponse` 接口，为 API 函数添加类型注解

---

### 🔵 疑问确认（已回复 3 条）

#### #1 subscribeInstruments 获取快照的时机
- **回复**：当前实现采用"订阅后主动查询"策略，确保用户订阅后立即看到数据。WebSocket 推送是增量更新，两者并行不冲突。主动查询获取的是订阅时刻的最新快照，WebSocket 推送后续变化。

#### #2 WebSocket 地址构造
- **回复**：`API_BASE` 是 `http://localhost:8000`，通过 `API_BASE.replace('http', 'ws')` 转换为 `ws://localhost:8000`。WSManager.connect 内部拼接 `/ws/market`，最终连接地址为 `ws://localhost:8000/ws/market`。

#### #3 contractsInMarket 过滤逻辑
- **回复**：当前逻辑只显示有行情数据的合约，这是设计意图。用户搜索新合约时，合约会通过 `fetchInstruments` 从后端获取，但只有订阅后才有行情数据。搜索结果显示所有合约，但表格只显示有行情的合约，避免空行。

---

### 提交记录

- `8ac415e` fix(task-6a): review反馈 - fetchInstruments同步到contracts store
- `5326be4` fix(task-6a): review反馈 - MarketPanel集成useMarketWs WebSocket推送
- `c05b4e1` fix(task-6a): review反馈 - 移除contracts store mock数据
- `269a0f1` fix(task-6a): review反馈 - 改进建议批量修复
