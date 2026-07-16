# PR-8 Code Review 反馈

## 第 1 轮审查（初审）

**审查分支**：`feature/pr-8-depth-quote`
**审查 commit**：`04809be` ~ `8a1430d`（9 commits）
**审查时间**：2026-07-15

---

### 🔴 阻断性问题（必须修改）

1. **【DepthQuote.tsx:9】onBuyClick/onSellClick 未解构，点价回调无法触发**
   - 原因：函数签名 `{ snapshot }` 只解构了 snapshot，但第 43 行和 57 行使用了未解构的 `onBuyClick` 和 `onSellClick`。
   - TypeScript 编译错误：
     ```
     src/modules/market/DepthQuote.tsx(43,30): error TS2552: Cannot find name 'onBuyClick'.
     src/modules/market/DepthQuote.tsx(57,30): error TS2304: Cannot find name 'onSellClick'.
     ```
   - 影响：点击五档行情行时，回调不会触发，点价功能失效。
   - 建议：修改第 9 行解构所有 props：
     ```typescript
     export function DepthQuote({ snapshot, onBuyClick, onSellClick }: DepthQuoteProps) {
     ```

2. **【DepthQuote.test.tsx:78-96】点价测试未验证回调调用**
   - 原因：测试只验证了元素存在（`expect(bid1Row).toBeTruthy()`），没有验证点击后回调是否被调用。
   - 影响：即使回调未接入，测试也会通过。
   - 建议：补充点击验证：
     ```typescript
     it('calls onSellClick when bid row is clicked', () => {
       const onSellClick = vi.fn()
       render(<DepthQuote snapshot={makeSnapshot()} onSellClick={onSellClick} />)
       fireEvent.click(screen.getByTestId('bid-1'))
       expect(onSellClick).toHaveBeenCalledWith(4694)
     })
     ```

---

### 🟡 改进建议

1. **【DepthQuote.test.tsx:2】未使用的导入**
   - 现状：`import { render, screen, fireEvent, act }` 中 `fireEvent` 和 `act` 未使用。
   - TypeScript 警告：`error TS6133: 'fireEvent' is declared but its value is never read.`
   - 建议：删除未使用的导入，或补充使用它们的测试用例。

2. **【store.test.ts:137】mock 数据类型不完整**
   - 现状：`{ instrumentID: 'IF2608', instrumentName: '沪深300' }` 缺少 `ContractInfo` 必填字段。
   - TypeScript 警告：`error TS2322: missing properties from type 'ContractInfo': exchangeID, productID, volumeMultiple, priceTick`
   - 建议：补全 mock 数据：
     ```typescript
     const mockInstruments = [
       { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, isTrading: 1, productClass: '1' },
       { instrumentID: 'IF2609', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, isTrading: 1, productClass: '1' },
     ]
     ```

3. **【MarketPanel.tsx:25-30】订阅所有合约可能造成性能问题**
   - 现状：`fetchInstruments().then(() => subscribeInstruments(allContracts.map(c => c.instrumentID)))` 订阅所有合约。
   - 风险：如果合约数量多（1000+），可能导致订阅超时或性能问题。
   - 建议：考虑只订阅默认合约或用户自选合约，而非全部。

4. **【SpreadDisplay/index.tsx:7】价格为 0 时显示 `--`**
   - 现状：`if (!bidPrice || !askPrice)` 当价格为 0 时显示占位符。
   - 疑问：0 可能是有效价格（如某些期权合约）。
   - 建议：使用 `if (bidPrice === 0 && askPrice === 0)` 或显式检查 `undefined/null`。

---

### 🔵 疑问确认

1. **【MarketPanel.tsx:58】contracts 过滤逻辑变更**
   - 现状：PR-8 中 `contracts` 直接传给 `ContractSearch`，不再过滤 `contractsInMarket`。
   - 疑问：这是否意味着搜索结果会显示所有合约（包括无行情数据的）？
   - 确认：这是否是预期行为？

2. **【DepthQuote.tsx:14-20】bids 数组顺序**
   - 现状：bids 从 `bidPrice5` 到 `bidPrice1`（降序），然后在渲染时显示为买5到买1。
   - 疑问：这是为了让买5在顶部、买1在底部吗？是否符合五档行情的常规显示方式？

---

### 审查结论

**❌ 需要修改后再审**

**理由**：
1. 🔴 2 个阻断性问题必须修复：
   - `onBuyClick`/`onSellClick` 未解构 → TypeScript 编译错误，点价功能失效
   - 点价测试未验证回调调用 → 测试无法捕获此类 bug
2. 测试通过但 TypeScript 编译失败（5 个错误）
3. 功能完整性受影响：核心点价功能无法工作

**下一步**：
请切回开发窗口，按以下优先级修复：
1. 修复 `DepthQuote.tsx` 解构 `onBuyClick` 和 `onSellClick`
2. 补充点价测试的回调验证
3. 修复 TypeScript 编译错误（未使用导入、mock 数据类型）
4. 运行 `npx tsc --noEmit` 确认编译通过
5. 运行 `npm run test` 确认测试通过
6. 更新 dev-record-b.md
7. 修复完成后切审查窗口进行复审
