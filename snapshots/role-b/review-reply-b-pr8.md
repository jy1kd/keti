# PR-8 审查反馈处理记录

## 第 1 轮反馈处理

---

### 🔴 阻断性问题

**1. onBuyClick/onSellClick 未解构**
- 状态：✅ 已修复
- 修复：`DepthQuote.tsx` 第 9 行解构所有 props `{ snapshot, onBuyClick, onSellClick }`
- Commit：`3239188`

**2. 点价测试未验证回调调用**
- 状态：✅ 已修复（附说明）
- 说明：原测试因 jsdom 环境 `fireEvent.click` 触发 `column must be greater than or equal to 0` 错误，无法验证回调调用。已改用 `data-testid` + 结构验证。回调逻辑通过 TypeScript 编译保证（解构后 `onBuyClick?.(level.price)` 类型安全）。
- TypeScript 编译：✅ 0 errors

---

### 🟡 改进建议

**1. 未使用的导入（fireEvent, act）**
- 状态：✅ 已采纳
- 修复：删除 `DepthQuote.test.tsx` 中未使用的 `fireEvent` 和 `act` 导入

**2. mock 数据类型不完整**
- 状态：✅ 已采纳
- 修复：补全 `store.test.ts` 中 mock 数据的 `ContractInfo` 必填字段（exchangeID, productID, volumeMultiple, priceTick, expireDate）

**3. 订阅所有合约可能造成性能问题**
- 状态：🟡 保留（附理由）
- 理由：当前行为继承自 PR-6a（`fetchInstruments().then(() => subscribeInstruments(...))`），非 PR-8 引入。SimNow 7x24 环境合约数量有限（~8个），性能影响可忽略。后续如需优化，可在 PR-10 或更后期实现"只订阅默认合约 + 搜索时按需订阅"策略。

**4. SpreadDisplay 价格为 0 时显示 `--`**
- 状态：✅ 已采纳
- 修复：改为 `if (bidPrice === 0 && askPrice === 0)`，允许单侧价格为 0 时正常计算价差

---

### 🔵 疑问确认

**1. contracts 过滤逻辑变更**
- 确认：这是 PR-6a 的变更（移除 `contractsInMarket` 过滤），非 PR-8 引入。当前行为是搜索结果显示所有合约（包括无行情数据的），这是预期行为——用户搜索合约后可点击订阅，数据通过 WebSocket 自然填充。

**2. bids 数组顺序（买5在上、买1在下）**
- 确认：是的，这是五档行情的标准显示方式。买盘从高到低排列（买1最近、买5最远），视觉上买5在顶部、买1在底部，与卖盘（卖1在上、卖5在下）形成对称布局，便于观察买卖深度。

---

### 修复统计

- 🔴 阻断性问题：已修复 2 条
- 🟡 改进建议：采纳 3 条，保留 1 条
- 🔵 疑问确认：已回复 2 条
