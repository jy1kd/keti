# PR-6a 人工验证讨论记录

## 验证项 #1：mockData.ts 已删除

### 结果
- ✅ 通过
- mockData.ts 已删除，contracts 初始值为 `[]`

---

## 验证项 #2：行情表格显示后端真实数据

### 结果
- ✅ 通过
- 合约列表从 `GET /api/market/instruments` 获取（8个合约：IF2608/2609、IC2608/2609、IH2608/2609、IM2608/2609）
- 表格显示所有合约，无快照数据的合约显示 `--` 占位符
- 搜索框可搜索全部合约

---

## 验证项 #3：WebSocket 行情推送正常工作

### 问题描述
WebSocket 连接建立后，CTP 行情数据无法推送到前端。表格始终显示 `--` 占位符。

### 分析
1. CTP 连接正常：`OnFrontConnected` → `OnRspUserLogin` → `OnRspSubMarketData` 全部成功
2. CTP 行情回调正常：`OnRtnDepthMarketData` 持续推送 IF2608 数据（已通过独立脚本验证）
3. `ctp_bridge.py` 正确注册了 `OnRtnDepthMarketData` 回调
4. **根因**：`ws/handlers.py` 的 `handle_market_ws` 直接调用 `websocket.accept()` 但**从未调用 `ws_manager.connect()`**。WebSocketManager 的连接池为空，`broadcast()` 遍历空列表，数据推不出去。

### 解决方案
1. **方案A：PR-7 修复**（推荐）
   - 修改 `ws/handlers.py`，让 handler 注册到 WebSocketManager
   - 这是 PR-7 的职责范围（task.md 第 645-646 行）
   - 优点：按 PR 依赖关系推进，不破坏任务边界
   - 缺点：PR-6a 无法端到端验证 WebSocket 推送

2. **方案B：角色A 在 PR-5 中修复**
   - PR-5 的验收标准包含 "WebSocket 行情推送正常"
   - 但 PR-5 已标记为 ✅ 已完成，说明验收时遗漏了此项
   - 优点：补上 PR-5 的遗漏
   - 缺点：跨 PR 边界

### 最终决定
采用方案A：这是 PR-7 的工作范围。PR-6a 前端代码已全部就绪（useMarketWs hook、store updateSnapshot），等待 PR-7 完成后即可端到端工作。

### 处理结果
- 无需修复（PR-6a 范围内无问题）
- 后端问题需角色A 在 PR-7 中修复

---

## 验证项 #4：合约搜索使用后端合约列表

### 结果
- ✅ 通过
- 搜索框传入全部 contracts（8个），不再过滤为仅已订阅合约
- 支持 instrumentID 和 instrumentName 模糊搜索

---

## 验证项 #5：无 mock 数据残留

### 结果
- ✅ 通过
- `contracts` 初始值为 `[]`（非 MOCK_CONTRACTS）
- `snapshots` 初始为空 Map
- 无 `import.meta.env.DEV` 判断

---

## 总结

- 通过项：4 条（#1, #2, #4, #5）
- 待 PR-7 修复：1 条（#3 WebSocket 推送）
- PR-6a 前端代码已全部就绪，无待修改项
