# PR-12a Code Review 反馈

## 第 1 轮审查（初审）

**审查分支**：`feature/pr-12a-frontend-gaps`
**审查 commit**：`bccca93` ~ `b9b218f`（7 commits）
**审查时间**：2026-07-17

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

1. **【useReconnect.ts:46,55】类型断言 `as any` 不安全**
   - 现状：`ws.connect(endpoint, onMessageRef.current as any)` 使用 `as any` 绕过类型检查
   - 问题：丢失类型安全，如果 `onMessage` 签名变更不会被捕获
   - 建议：定义明确的回调类型或使用泛型：
     ```typescript
     type MessageHandler = (data: unknown) => void
     ws.connect(endpoint, onMessageRef.current as MessageHandler)
     ```
   - 或者修改 WSManager.connect 的类型签名以接受可选回调

2. **【useReconnect.ts:58-62】轮询检测断连（每秒 setInterval）**
   - 现状：`setInterval(() => { if (!ws.isConnected(endpoint)) ... }, 1000)`
   - 问题：每秒轮询检查连接状态，可能不是最优方案
   - 建议：如果 WSManager 支持 `onclose` 事件回调，直接监听断连事件更高效：
     ```typescript
     ws.onClose(endpoint, () => scheduleReconnect())
     ```
   - 备注：当前实现可工作，轮询开销可接受，但后续可优化

3. **【useMarketWs.ts:13-27】snapshotToKline 时间解析逻辑**
   - 现状：`(snap.updateTime ?? '00:00:00').split(':').map(Number)` 解析时分秒
   - 问题：如果 `updateTime` 格式异常（如空字符串或非 HH:mm:ss），会得到 NaN
   - 建议：添加解析校验：
     ```typescript
     const [h = 0, m = 0, s = 0] = (snap.updateTime ?? '00:00:00').split(':').map(Number)
     ```

4. **【PerfMonitor/index.tsx:20-22】Ctrl+P 快捷键可能与浏览器冲突**
   - 现状：`e.ctrlKey && e.key === 'p'` 拦截 Ctrl+P
   - 问题：Chrome 中 Ctrl+P 是打印快捷键，可能影响用户
   - 建议：考虑使用其他快捷键组合（如 Ctrl+Shift+P）或添加开发者模式判断

5. **【MarketTable.tsx:39】涨跌计算基准逻辑**
   - 现状：`const preSettlement = snap.preSettlementPrice || snap.preClosePrice || snap.lastPrice`
   - 问题：使用 `||` 运算符，当 `preSettlementPrice` 为 0 时会跳过
   - 建议：使用 `??` 运算符或显式检查：
     ```typescript
     const preSettlement = snap.preSettlementPrice ?? snap.preClosePrice ?? snap.lastPrice
     ```

---

### 🔵 疑问确认

1. **【useReconnect.ts:36】指数退避参数确认**
   - 现状：`BASE_DELAY * Math.pow(2, retryCountRef.current)` → 1s, 2s, 4s, 8s, 16s
   - 疑问：是否需要添加随机抖动（jitter）避免重连风暴？

2. **【useMarketWs.ts:35-37】WSManager 实例创建方式**
   - 现状：`if (!wsRef.current) { wsRef.current = new WSManager(wsBaseUrl) }`
   - 疑问：如果 `wsBaseUrl` 变化，WSManager 不会重建，可能连接到旧地址
   - 确认：`wsBaseUrl` 是否会在组件生命周期内变化？

3. **【App.tsx:15-20】onAppLayout 回调类型变更**
   - 现状：`(layout: Record<string, number>)` 替代之前的 `(sizes: number[])`
   - 疑问：这是 API 变更还是类型修复？是否需要同步更新 panelStorage 的调用方式？

---

### 审查结论

**✅ 通过**

**理由**：
1. 无阻断性问题，TypeScript 编译通过（0 errors）
2. 185 个测试全部通过（28 文件），新增：
   - useReconnect 测试（4 个）
   - useMarketWs 测试（新增 2 个：重连状态、appendKline）
   - PerfMonitor 测试（5 个）
   - MarketTable 测试（新增 1 个：涨跌幅基准验证）
3. 功能完整性：
   - WebSocket 断线重连（指数退避，最多 5 次）✅
   - 实时 K 线更新（WS market_data → appendKline）✅
   - FPS 性能监控（Ctrl+P 切换）✅
   - 涨跌幅计算基准修正（preSettlementPrice）✅
4. 代码质量：Hook 职责清晰、测试覆盖充分

**改进建议**：
- 上述 🟡 改进建议可在后续 PR 中逐步完善
- 特别是类型断言优化（`as any` → 明确类型）

**下一步**：
请完成人工验证后生成 PR 描述，执行合并操作。

**人工验证内容**：
```bash
# 1. 启动后端
cd server && python -m uvicorn main:app --reload --port 8000

# 2. 启动前端
cd frontend && npm run dev

# 3. 浏览器访问 http://localhost:5173

# 4. 验证以下内容：
#    - 行情表格涨跌幅显示正确（基于结算价）
#    - K 线图实时更新（WS 推送）
#    - 按 Ctrl+P 显示 FPS 监控
#    - FPS 监控显示绿色（>30）或红色（<30）
#    - 断开网络后自动重连（观察控制台日志）
#    - 控制台无报错
```

---

## 第 2 轮审查（复审）

**审查分支**：`feature/pr-12a-frontend-gaps`
**审查 commit**：`e531b77`（1 commit 修复）
**审查时间**：2026-07-17

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

无

**改进处理确认**：

| # | 问题 | 处理 | 验证 |
|---|------|------|------|
| 1 | `as any` 类型断言 | ✅ 采纳 | `useReconnect.ts:5` 定义 `MessageHandler`，第49/58行使用 `as MessageHandler` |
| 2 | 轮询检测断连 | ❌ 保留 | WSManager 不支持 `onClose`，轮询是当前可行方案 |
| 3 | snapshotToKline 时间解析 | ✅ 采纳 | `useMarketWs.ts:15` 改为 `[h = 0, m = 0, s = 0]` 添加默认值 |
| 4 | Ctrl+P 与浏览器冲突 | ❌ 保留 | 开发调试工具，不影响生产 |
| 5 | `\|\|` vs `??` 空值运算符 | ✅ 采纳 | `MarketTable.tsx:39` 改为 `??` |

---

### 🔵 疑问确认

无

**疑问回复确认**：

| # | 问题 | 回复 |
|---|------|------|
| 1 | 指数退避是否需要抖动 | SimNow 测试环境规模小，重连风暴风险低，暂不需要 |
| 2 | wsBaseUrl 变化后 WSManager 不重建 | wsBaseUrl 来自 `.env` 配置，组件生命周期内固定不变 |
| 3 | onAppLayout 类型变更 | 类型修复，react-resizable-panels v4 的回调参数类型为 `Record<string, number>` |

---

### 测试验证

```
Test Files  28 passed (28)
     Tests  185 passed (185)
TypeScript  0 errors
```

---

### 审查结论

**✅ 通过**

**理由**：
1. 初审 5 个改进建议：3 个采纳并修复，2 个合理保留（有技术理由）
2. 初审 3 个疑问全部回复，技术理由充分
3. TypeScript 编译通过，185 个测试全部通过
4. 修复内容：类型安全、时间解析防护、空值运算符 — 代码质量提升

**下一步**：
请生成 PR 描述，执行合并操作。
