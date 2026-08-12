# keti 全量代码审查报告

- 审查日期：2026-08-12
- 审查范围：全量代码（`server/` + `frontend/` + 前后端测试）
- 审查方式：静态阅读（后端 pytest 未运行，`server/venv` 未装 pytest）
- 结论：工程质量高，无崩溃级阻断问题；存在 3 个高优先级问题与若干改进项

## 总体评价

- 工程架构清晰：`ctp_wrapper` 命名、`SubscribeMarketData` 字符串列表 + `.decode()` 防护等 AGENTS.md 关键陷阱均已正确落地。
- 性能意识强：`MarketTable` 仅对可见行局部 `updateRecords` + 快照引用比较 + 预加载；`useSubscriptionManager` 软上限 + LRU + 宽限期。
- 交易回报/持仓处理防御性强：`order_manager` 会话过滤陈旧回调、乐观 pending、trade 防御更新；`query_service` 单锁 + bIsLast 等待，保守但正确。
- 测试覆盖充分：后端 30+ 测试文件（`test_order_manager.py` 1249 行、`test_market_service.py` 923 行），前端 50+ 测试文件、600+ 用例，断言扎实。
- 浮动窗/脱离拖拽/缩放（`FloatingWindow`、`detachDrag`、`resizeDrag`、`TabContent` portal 渲染）实现完整，边界处理细致。

## 🔴 高优先级（建议尽快修复）

1. **Escape 热键全局冲突**
   - 位置：`frontend/src/stores/userPrefs.ts:13`（默认 `batchCancel: 'Escape'`）、`frontend/src/hooks/useHotKeys.ts:52`、`frontend/src/modules/order/OrderPanel.tsx:242`
   - 冲突方：`ContextMenu/index.tsx:39`、`TabBar/index.tsx:66,164,216`、`ContractSearch/index.tsx:90`、`AccountBar.tsx:119`、`ConfirmDialog/index.tsx:19`、`detachDrag.ts:63`、`resizeDrag.ts:92`
   - 说明：Escape 同时被用于“关闭菜单/弹窗”与“打开批量撤单面板”。按下 Esc 会一边关闭菜单一边弹出批量撤单，行为冲突。
   - 建议：默认改为组合键（如 `Ctrl+Shift+X`）或从默认配置移除 `batchCancel`；`HotKeyTab` 保存时检测与内置 UI 键（Escape/Enter/Tab）的冲突。

2. **串行反向“平仓成交后再开仓”语义与实现不符**
   - 位置：`server/api/order.py:437`（docstring）与 `:514`（实际注释）
   - 说明：文档声称“平仓全部成交后再发开仓”，实际是平仓单被柜台接受（`om.insert` 成功）即发开仓，平仓可能未成交甚至被拒。真实交易中是敞口风险。
   - 建议：改为监听成交回报（OrderManager trade 回调）确认平仓全部成交后再发开仓；至少先修正文档并加风险提示。

3. **market_service.subscribe 限额竞态**
   - 位置：`server/services/market_service.py:225-275`
   - 说明：限额检查在锁内（:236），但 CTP 调用（:252-270）与本地写入（:272-275）都在锁外；两个并发请求可同时通过检查，总订阅数可突破 500 上限。
   - 建议：锁内预占（pending）+ 失败回滚，或写入前二次校验。

## 🟡 建议改进

4. **全局异常处理器泄漏内部信息且无堆栈日志**
   - 位置：`server/main.py:157-168`
   - 说明：`str(exc)` 直接返回给客户端（可能含路径/内部状态），且未记录异常堆栈。
   - 建议：返回通用 message，用 `logger.exception` 记录堆栈。

5. **IPC 监控全局拦截器影响所有用户**
   - 位置：`frontend/src/pages/IPCMonitorPage.tsx:143-153`
   - 说明：模块加载即 monkey-patch `window.WebSocket`/`window.fetch`，且被 `TabContent` 静态 import 进主包；每条行情消息额外 `JSON.parse` + `[...globalMessages.slice(-999), msg]` 千元素数组复制。
   - 建议：动态 import 懒加载该页面；拦截器仅页面挂载时启用、卸载时恢复。

6. **行情高频回调事件日志**
   - 位置：`server/ctp_wrapper/callback.py:122-124`（每 tick `_log`）、`:35,49-50`（MAX_EVENTS=10000，裁剪复制 5000 元素）
   - 建议：`OnRtnDepthMarketData` 跳过事件日志或抽样记录；`events` 改用 `collections.deque`。

7. **平仓今昨仓数量错误**
   - 位置：`frontend/src/modules/query/Position.tsx:14-48,96`
   - 说明：选“平今”（`close_today`）时委托量用总持仓 `pos.position`，今仓小于总持仓会被柜台拒单。
   - 建议：今仓>0 时用 `todayPosition`，否则用 `ydPosition`。

8. **exchangeID 默认 CFFEX 掩盖缺失**
   - 位置：`server/api/order.py:40,133`、`frontend/src/modules/order/store.ts:11,48`
   - 说明：合约不在缓存（如手动输入）时默认 CFFEX，会把单发到错误交易所。
   - 建议：从合约缓存强制推导；推导不出则拒单并提示。

9. **start.py 死代码**
   - 位置：`server/start.py:127-132`
   - 说明：`uvicorn_args` 构建后仅打印未使用（实际走 `:139` 的 kwargs）。
   - 建议：删除或直接用其启动。

10. **K 线服务初始化时机**
    - 位置：`server/services/ctp_startup.py:298-300`、`server/api/market.py:161-165`
    - 说明：`kline_service` 仅 MD 连接成功后才创建，启动初期 `/api/market/kline` 静默返回空。
    - 建议：随 app 创建；数据未就绪时明确提示。

## ⚪ 观察项

11. `frontend/src/modules/market/MarketTable.tsx:302` 遗留 `console.log`（Shift+click 调试日志）。
12. `MarketTable.tsx:41-62,234` vtable 回调大量 `any`（`priceColor/coloredStyle/statusStyle/bodyStyle`）。
13. `frontend/src/components/SettingsPanel/HotKeyTab.tsx:10` 把 Escape 列入 `MODIFIER_KEYS`，`:83` 提示“按 Esc 清除”实际不生效；热键仅单键、无修饰组合；保存冲突检测不覆盖内置 UI 键。
14. `frontend/src/hooks/useHotKeys.ts:55-64` 无 `e.repeat` 防护（长按 Esc 连弹批量撤单），与第 1 项同源。
15. `frontend/src/modules/options/TQuoteTable.tsx:166-168` 每个 tick `setRecords` 全量重建（链规模小可接受，可改 `updateRecords` 局部更新）。
16. `frontend/src/modules/options/OptionPanel.tsx:117-135` 整链订阅（可能上百合约）与 `useSubscriptionManager` 480 软上限/LRU 交互；`:124` 订阅失败静默；`:138-152` debounce timer 无卸载清理。
17. `frontend/src/modules/query/store.ts:192-219` 每 10s 串行 5 项查询约 12s 一轮，长时间占用后端查询线程；`QueryPanel.tsx:49-60` 的 `c` 键在报单页直接撤销全部、无确认。
18. `frontend/src/services/ws.ts:57,61` 连接日志用 `console.log`。
19. `server/.env.sample` 为 GBK 乱码（按 UTF-8 打开），建议统一 UTF-8 编码。
20. 部分前端测试使用 `toBeDefined/toBeTruthy` 弱断言（如 `FavoritesPage.test.tsx:105`），但整体断言扎实，不阻塞。

## 验证说明

- 本次为静态审查；后端 pytest 未运行（`server/venv` 未装 pytest，全局 Python 3.13 亦未装）。需要时可先安装依赖再执行 `cd server && python -m pytest tests -q`。
