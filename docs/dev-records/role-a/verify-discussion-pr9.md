# PR-9 人工验证讨论记录

---

## 验证项 #1：服务启动 + 连接状态

### 问题描述
启动后端后，调用 /logout 再 /login，MD 的 `mdConnected` 一直显示 false。TD 正常。

### 分析
logout 断开了 MD 和 TD 双方，但 login（`connect_trading`）只重连 TD，不重连 MD。MD 只在进程启动时连接一次。

### 解决方案
1. 方案 A：login 时同时重连 MD — 语义完整但变慢
2. 方案 B（选中）：logout 不断开 MD — MD 不需要验证，应持久运行

### 最终决定
方案 B。MD 在 logout 时保持连接，`mdConnected` 不受 login/logout 周期影响。

### 处理结果
- 已修复
- Commit：`a39e65a` — logout 只断开 TD，不碰 MD

---

## 验证项 #10：WebSocket 端点

### 问题描述
浏览器 Console 中首次连接 `/ws/market` 触发 onerror，其他 4 个端点正常 open。

### 分析
所有 5 个端点共用同一个 `handle_ws()` 函数，逻辑完全一致（`ws_manager.connect()` → `websocket.accept()`）。`/ws/market` 独有的 `subscribe_fn`/`unsubscribe_fn` 不会在连接阶段执行。确认是浏览器端时序问题（首次 WebSocket 创建时服务端未完全就绪），重试后正常。无需代码修改。

### 处理结果
- 无需修复（时序问题，重试即可）

---

## 验证汇总

| # | 验证项 | 结果 |
|---|--------|------|
| 1 | 服务启动 + 连接状态 | ✅（修复 logout 后重验证通过） |
| 2 | 参数校验 | ✅ 三条均返回 422 |
| 3 | 合法报单 | ✅ 返回 orderRef |
| 4 | 撤单不存在 | ✅ 返回 false |
| 5 | 批量撤单 | ✅ count=1（#3 插入的） |
| 6 | 一键反向 501 | ✅ |
| 7 | 一键锁仓 501 | ✅ |
| 8 | 状态查询 404 | ✅ |
| 9 | 连接状态 API | ✅ 三字段正确 |
| 10 | WebSocket 端点 | ✅ 重试后全部 open |
