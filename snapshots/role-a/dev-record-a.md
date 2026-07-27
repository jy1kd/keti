# 角色A 开发记录

**角色**：角色A（后端开发）
**负责目录**：server/

---

## PR-1: 后端CTP连接验证（技术Spike）

**分支**：`feature/pr-1-ctp-verify`
**依赖**：无
**状态**：✅ 已合并

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_config.py` | 11 | Config 默认值、环境变量读取、load_config 工厂函数 |
| `tests/test_types.py` | 24 | 8 个枚举类（Direction, OffsetFlag, OrderPriceType, TimeCondition, VolumeCondition, OrderStatus, PosiDirection, ProductClass） |
| `tests/test_callback.py` | 31 | MdSpi/TraderSpi 实例化、回调方法存在性、事件日志 |
| `tests/test_md_user_api.py` | 22 | MdUserApi 构造 + subscribe/unsubscribe/release 状态管理 |
| `tests/test_trader_api.py` | 20 | TraderApi 构造 + insert_order/cancel_order/release 状态管理 |
| **合计** | **108** | |

### 实现进度

#### 第1次循环：配置 + 类型 + 回调（66 tests）
- ✅ `requirements.txt` — ctp-python, python-dotenv
- ✅ `config.py` — Config 类，读取环境变量，SimNow 默认值
- ✅ `ctp/types.py` — 8 个枚举类，值与 CTP 官方一致
- ✅ `ctp/callback.py` — MdSpi + TraderSpi，事件日志 + 自定义 handler
- ✅ 测试文件：`test_config.py`, `test_types.py`, `test_callback.py`
- 📦 Commit: `ce44db8`

#### 第2次循环：API 封装 + 入口 + 配置模板（+26 tests）
- ✅ `ctp/md_user_api.py` — MdUserApi 封装，create/login/subscribe/unsubscribe/release
  - ⚠️ 强制 str 列表（避免 bytes 导致 SWIG 堆损坏）
- ✅ `ctp/trader_api.py` — TraderApi 封装，create/login/insert_order/cancel_order/release
  - 自动生成 order_ref，完整报单字段
- ✅ `main.py` — 4 步验证脚本（import → config → MD → TD）
- ✅ `.env` — 实际配置文件（gitignore，不提交）
- ✅ `.env.sample` — 配置模板（提交）
- ✅ 测试文件：`test_md_user_api.py`, `test_trader_api.py`
- 📦 Commit: `282ecaf`

### 关键设计决策

1. **SubscribeMarketData 参数安全**：`md_user_api.subscribe()` 强制 `str(i)` 转换，防止 bytes 导致崩溃（CTP SWIG bug）
2. **配置默认值**：SimNow 7x24 环境地址硬编码为默认值，开箱即用
3. **事件日志机制**：每个 SPI 回调自动记录 `{type, timestamp, data}`，方便调试
4. **自定义 handler**：通过 `spi.on(event_type, handler)` 注册，避免继承 SPI

### 遇到的问题与解决方案

- **测试隔离**：`_has_ctp` 检测需同时验证 import 成功 + DLL 可用（仅 import 成功不够）
- **OnFrontDisconnected 参数**：回调需要 `reason: int` 参数，测试传 `0` 模拟

### Commit 记录

| Commit | 内容 |
|--------|------|
| `ce44db8` | feat(task-01): 配置管理、CTP类型定义、回调框架 — 66 tests pass |
| `282ecaf` | feat(task-01): CTP行情/交易API封装、验证入口、配置模板 — 92 tests pass |
| `fa0a872` | docs(task-01): 更新progress.md — 开发完成，待审查 |
| (更多 PR-1 commits 见完整记录) | |

---

## PR-3: 后端 FastAPI 框架搭建

**分支**：`feature/pr-3-fastapi-framework`
**依赖**：PR-1
**状态**：✅ 已合并

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_models.py` | 20 | 6 个 Pydantic 模型（MarketSnapshot/KLineData/OrderRequest/OrderReturn/AccountInfo/PositionInfo/InstrumentInfo） |
| `tests/test_ws_manager.py` | 14 | WebSocketManager 连接池、广播、断开清理 |
| `tests/test_connection_api.py` | 8 | 登录/登出/状态 API、参数校验 |
| `tests/test_*.py` (PR-1 原有) | 108 | 回归 |
| **合计** | **150** | |

### 实现进度

#### 第1次循环：数据模型（20 tests）
- ✅ `models/market.py` — MarketSnapshot（50+ 字段）、KLineData
- ✅ `models/order.py` — OrderRequest、OrderReturn
- ✅ `models/account.py` — AccountInfo、PositionInfo
- ✅ `models/contract.py` — InstrumentInfo（含期权字段）

#### 第2次循环：WebSocket 管理（14 tests）
- ✅ `ws/manager.py` — 5 端点连接池 + `broadcast()` + 自动清理断线
- ✅ `ws/handlers.py` — 占位处理器（PR-7 完善）

#### 第3次循环：FastAPI 应用 + 连接 API（8 tests）
- ✅ `api/connection.py` — POST login/logout、GET status
- ✅ `api/market.py` — 占位路由（PR-5 实现）
- ✅ `api/order.py` — 占位路由（PR-9 实现）
- ✅ `api/query.py` — 占位路由（PR-11 实现）
- ✅ `main.py` — 重写为 FastAPI 应用（CORS、13 路由、全局异常处理）

### 关键设计决策

1. **`create_app()` 工厂函数**：main.py 提供 `app` 实例 + `create_app()` 工厂，测试可用工厂创建隔离实例
2. **`WebSocketManager` 全局单例**：`ws_manager` 在模块级创建，路由通过 `app.state` 访问
3. **Pydantic Field 校验**：brokerID 使用 `min_length=1`，由 Pydantic 自动返回 422
4. **连接状态简化**：PR-3 阶段 mdConnected/tdConnected 与 loggedIn 同值，PR-5/PR-9 独立

### Commit 记录

| Commit | 内容 |
|--------|------|
| `47a5fa1` | feat(task-03): Pydantic数据模型 — 行情/报单/账户/合约 — 20 tests pass |
| `c545354` | feat(task-03): WebSocket连接管理器 — 5端点连接池+广播+自动清理 — 14 tests pass |
| `9217d61` | feat(task-03): FastAPI应用入口+连接管理API+占位路由+5端点WebSocket — 150 tests pass |

### 审查反馈修复（2026-07-10）

审查文件：`review-feedback-a-pr3.md`（0 阻断 + 6 建议）

| 建议 | 处理 |
|------|------|
| 🟡 connection.py `request: Request` 未使用 | ✅ 移除，已修复 |
| 🟡 password/userID 无 min_length | ✅ 添加 `min_length=1`，已修复 |
| 🟡 dev-record-a.md 与 progress.md 不一致 | ✅ 统一为「开发完成，待审查」并补全详细记录 |
| 🟡 handler↔manager 集成 gap 加注释 | ✅ handlers.py 添加 PR-7 TODO 注释块 |
| 🟡 WS handler 端到端测试缺失 | ⏳ 延期 PR-7 |
| 🟡 五个 handler 函数重复 | ⏳ 延期 PR-7 |

---

## PR-5: 后端行情API实现

**分支**：`feature/pr-5-market-api`
**依赖**：PR-3
**状态**：✅ 已合并

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_market_service.py` | 44 | MarketService 初始化、合约缓存、订阅管理(500上限)、快照缓存、CTP hooks |
| `tests/test_field_mapping.py` | 22 | CTP深度行情 PascalCase→camelCase 全字段映射 |
| `tests/test_market_api.py` | 20 | REST API 集成测试 |
| `tests/test_ctp_bridge.py` | 8 | CTP回调桥接 |
| `tests/test_ctp_startup.py` | 11 | CTP连接管理（connect_ctp/_connect_ctp/凭证/超时） |
| `tests/test_kline_service.py` | 25 | K线聚合（OHLCV/时间窗口/多周期/volume增量/线程安全） |
| `tests/test_connection_api.py` | 16 | Login/logout/status API（防重入/真实断开/状态读取） |
| `tests/test_*.py` (原有) | 95 | 回归 |
| **合计** | **241** | |

### 实现进度

#### 第1次循环：MarketService 核心逻辑（30 tests）
- ✅ `services/market_service.py` — 合约缓存、订阅管理(500上限)、快照缓存、模糊搜索
- 📦 Commit: `6f19568`

#### 第2次循环：CTP 字段映射（22 tests）
- ✅ `services/field_mapping.py` — CTP CThostFtdcDepthMarketDataField → camelCase dict，40 字段全覆盖
- 📦 Commit: `f810499`

#### 第3次循环：行情 API 路由（20 tests）
- ✅ `api/market.py` — GET instruments/subscribe/unsubscribe/snapshots/kline/depth 全部重写
- ✅ `main.py` — MarketService 注入 app.state
- 📦 Commit: `77a8f9f`

#### 第4次循环：合约列表缓存（5 tests）
- ✅ `data/instruments.json` — 8 个股指期货合约(IF/IC/IH/IM 2608+2609)
- ✅ `MarketService.load_instruments_from_file()` — JSON 文件加载+容错
- ✅ `main.py` — 启动时自动加载 instruments.json
- 📦 Commit: `ef837a3`

#### 第5次循环：CTP自动连接 + login真实化（11+16 tests）
- ✅ `services/ctp_startup.py` — connect_ctp() 非阻塞 + wait=True 同步等待 + 凭证透传
- ✅ `api/connection.py` — login真实化（CTP连接+防重入）、logout真实断开（release+清理状态）
- ✅ `config.py` — Config 构造函数支持显式凭证覆盖 env
- 📦 Commit: `748d6e3`, `041179a`, `e48ae29`, `dbf2756`, `c55bcc8`

#### 第6次循环：K线聚合（25 tests）
- ✅ `services/kline_service.py` — 实时 tick→OHLCV 多周期 bar（1m/5m/15m/30m/1h）
- ✅ `services/ctp_bridge.py` — 新增 kline_service 参数
- 📦 Commit: `1e72b12`

#### 第7次循环：CTP登录逻辑修复 + subscribe接入CTP + 地址自动切换
- ✅ `services/ctp_startup.py` — _on_rsp_user_login 逻辑反转（pRspInfo=None 不再误判成功）
- ✅ `services/market_service.py` — set_ctp_hooks() 桥接 subscribe/unsubscribe 到 CTP
- ✅ `start.py` — 根据时间自动选择 CTP 地址（工作日 09-16 第一套，其余第二套）
- 📦 Commit: `e4b2091`, `6d7d5f2`

### 关键设计决策

1. **MarketService 纯同步设计**：所有数据操作方法均为同步，CTP 回调线程安全。WebSocket 推送由外部调用方处理
2. **字段映射表驱动**：`_DEPTH_MARKET_DATA_FIELDS` 列表定义 CTP→camelCase 映射，40 字段含默认值，`getattr` 兜底
3. **集成测试用独立 FastAPI app**：每个测试文件创建独立 app 实例，不依赖 `main.py` 的全局 `app`
4. **K线实时聚合**：从 tick 累积为 OHLCV bar，5 个周期同时更新，无历史数据
5. **订阅限制批处理原子性**：整批检查上限，不部分添加
6. **CTP hooks 注入**：MarketService 通过 set_ctp_hooks() 接收 subscribe/unsubscribe 回调，解耦 CTP 依赖
7. **login 同步等待**：connect_ctp(wait=True) 阻塞等 CTP 回调结果，密码错误返回 false

### Commit 记录

| Commit | 内容 |
|--------|------|
| `6f19568` | feat(task-05): MarketService核心逻辑 — 合约缓存+订阅管理+快照缓存 — 30 tests pass |
| `f810499` | feat(task-05): CTP字段映射 — PascalCase→camelCase深度行情数据 — 22 tests pass |
| `77a8f9f` | feat(task-05): 行情API路由实现 — instruments/subscribe/unsubscribe/snapshots/kline/depth — 20 tests pass |
| `ef837a3` | feat(task-05): 合约列表缓存 — instruments.json文件加载+启动自加载 — 5 tests pass |
| `c286776` | fix(task-05): CTP回调链路接通 — ctp_bridge.py + MarketService线程安全 |
| `036410e` | fix(task-05): K线占位文档化+代码清理 |
| `40254cd` | fix(task-05): 补充import asyncio和pathlib.Path |
| `a583dae` | fix(task-05): list[str]→List[str]兼容Python 3.8 |
| `51c7639` | feat(task-05): CTP auto-startup — ctp_startup.py + connection.py真实状态 |
| `b7d5e7b` | fix(task-05): lifespan替代on_event + get_running_loop替代get_event_loop |
| `bd74a88` | fix(task-05): front_connected.set()缺失导致CTP永远超时 |
| `6d7d5f2` | fix(task-05): subscribe/unsubscribe接入CTP — set_ctp_hooks() |
| `748d6e3` | fix(task-05): login接口真实化 — connect_ctp()非阻塞+凭证透传 |
| `041179a` | fix(task-05): login防重入+logout真实断开 |
| `e48ae29` | fix(task-05): Config构造函数支持显式凭证 |
| `dbf2756` | fix(task-05): login等待CTP结果再返回 |
| `c55bcc8` | fix(task-05): lifespan启动时wait=True |
| `1e72b12` | feat(task-05): 实时K线聚合服务 — tick→OHLCV多周期bar |
| `e4b2091` | fix(task-05): CTP登录判断逻辑反转 — pRspInfo=None不再误判 |

### 审查反馈修复（2026-07-13）

审查文件：`review-feedback-a-pr5.md`（2 阻断 + 6 建议 + 1 疑问）

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| B1 | 🔴 | CTP 回调链路未接通 | ✅ 新建 `ctp_bridge.py` + MarketService 线程安全 + `wire_ctp_market_bridge()`，8 新测试 |
| B2 | 🔴 | K线端点硬编码空数据 | ✅ docstring 详细标注 CTP 依赖 + PR-7 延期说明 |
| S1 | 🟡 | `Optional` 未使用 | ✅ 删除 import |
| S2 | 🟡 | `request: Request` 未使用 | ✅ `get_kline` 移除参数 |
| S3 | 🟡 | `import os as _os` → pathlib | ✅ 改为 `Path(__file__).parent / "data" / "instruments.json"` |
| S4 | 🟡 | `_FakeMdApi` 死代码 | ✅ 删除 30 行 |
| S5 | 🟡 | 裸 `list` 类型注解 | ✅ 改为 `List[Tuple[str, str, object]]` |
| S6 | 🟡 | `min_length=0` 语义模糊 | ✅ 改为 `min_length=1`，测试同步更新 |
| Q1 | 🔵 | WS 推送是否延期 | ✅ 在 PR-5 内实现，不延期 |

**修复 Commits**：
- `c286776` fix(task-05): CTP回调链路接通
- `036410e` fix(task-05): K线占位文档化+代码清理

### 二次审查反馈修复（2026-07-13）

审查文件：`review-feedback-a-pr5-r2.md`（1 阻断 + 0 建议 + 0 疑问）

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| B3 | 🔴 | `main.py` 缺少 `import asyncio` 和 `from pathlib import Path` | `40254cd` — 添加 2 行 import |

**验证**：`from main import create_app, wire_ctp_market_bridge` 成功，235 tests 通过。

### 三次审查修复（2026-07-14）

审查文件：`review-feedback-a-pr5-r3.md`（CTP auto-startup 实现期间的运行时修复）

| # | 问题 | 处理 |
|---|------|------|
| 1 | `list[str]` TypeError（Python 3.8 兼容） | `a583dae` — `list[str]` → `List[str]` |
| 2 | `@app.on_event("startup")` 废弃警告 | `b7d5e7b` — 改用 `lifespan` context manager |
| 3 | `asyncio.get_event_loop()` RuntimeError | `b7d5e7b` — `get_running_loop()` + fallback |
| 4 | CTP auto-startup 实现 | `51c7639` — `ctp_startup.py` + `connection.py` 真实状态 |

### 四次审查修复（2026-07-14）

审查文件：`review-feedback-a-pr5-r4.md`（1 阻断 + 0 建议 + 0 疑问）

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| B4 | 🔴 | `front_connected.set()` 缺失，CTP 永远超时 | `bd74a88` — 1 行修复 |

**验证**：14/14 ctp_startup + ctp_bridge 测试通过，202 总测试通过。

### 后续开发（审查后新增功能，2026-07-14）

| 功能 | 说明 | Commit |
|------|------|--------|
| subscribe/unsubscribe 接入 CTP | MarketService.set_ctp_hooks() 桥接 MdUserApi | `6d7d5f2` |
| login 接口真实化 | connect_ctp() 凭证透传 + wait=True 同步等待 | `748d6e3`, `dbf2756` |
| login 防重入 + logout 真实断开 | ctp_thread.is_alive() 守卫 + md_api.release() | `041179a` |
| Config 支持显式凭证 | broker_id/user_id/password 可选参数覆盖 env | `e48ae29` |
| lifespan wait=True | 启动时等待 CTP 登录结果 | `c55bcc8` |
| 实时 K 线聚合 | KLineService — tick→OHLCV 多周期 bar | `1e72b12` |
| CTP 登录逻辑修复 | pRspInfo=None 不再误判成功 | `e4b2091` |

**最终测试**：241 passed（3 failed 环境相关）

---

## PR-7: 后端WebSocket管理完善

**分支**：`feature/pr-7-websocket-manager`
**依赖**：PR-5
**状态**：✅ 已合并

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_ws_handlers.py` | 9 | handle_ws 生命周期（connect/disconnect）、消息路由（subscribe/unsubscribe/ping）、异常容错 |
| `tests/test_ws_heartbeat.py` | 7 | 死连接清理、心跳 ping、start/stop 生命周期、周期性清理 |
| `tests/test_reconnect.py` | 12 | ReconnectService：指数退避、重试计数、订阅跟踪、try_reconnect |
| `tests/test_ws_integration.py` | 7 | main.py 路由集成、心跳启动、OnFrontDisconnected 广播、reconnect 集成 |
| **合计** | **35**（新增） | |

**全量测试**：276 passed，2 failed（预存 test_config），46 skipped（async 缺 pytest-asyncio）

### 实现进度

#### 循环1+2：Handler 生命周期 + 消息路由（9 tests）
- ✅ `ws/handlers.py` — `handle_ws()` 统一 handler：accept → ws_manager.connect → route → disconnect
- ✅ 消息路由：subscribe/unsubscribe/ping 三种 action
- ✅ 订阅确认：{type: subscribed, instruments: [...]}
- ✅ Pong 响应：{type: pong}
- ✅ 无效 JSON 容错：静默忽略，不崩溃
- 📦 Commit: `c370cbc`

#### 循环3：心跳机制（7 tests）
- ✅ `ws/manager.py` — `_heartbeat_tick()`：ping 所有连接，移除死连接
- ✅ `start_heartbeat(interval)` / `stop_heartbeat()`：后台任务生命周期
- ✅ 默认 15 秒间隔
- 📦 Commit: `05b16a6`

#### 循环4：断线重连服务（12 tests）
- ✅ `services/reconnect.py` — `ReconnectService`：指数退避（1s/2s/4s/8s/16s）
- ✅ 最大 5 次重试
- ✅ `update_subscriptions()`：跟踪已订阅合约，重连后自动重新订阅
- ✅ `try_reconnect()`：connect_fn 成功后调用 subscribe_fn
- 📦 Commit: `4f07b9f`

#### 循环5：集成 wiring（7 tests）
- ✅ `main.py` — 所有 5 个 WS 路由改用 `handle_ws` + `ws_manager`
- ✅ `main.py` — lifespan 启动心跳（15s）、关闭时停止
- ✅ `main.py` — market 端点接入 MarketService.subscribe/unsubscribe
- ✅ `ctp_startup.py` — `OnFrontDisconnected` → system WebSocket 广播 + reconnect
- ✅ `ws/handlers.py` — 删除旧 placeholder handlers
- 📦 Commit: `5386563`, `200ab85`

### 关键设计决策

1. **统一 handle_ws 函数**：替代 5 个独立 handler，通过 endpoint 参数区分。subscribe_fn/unsubscribe_fn 可选注入
2. **心跳 ping 使用 send_json**：发送 `{"type": "ping"}`，与 broadcast 格式一致。客户端需响应 pong
3. **ReconnectService 纯逻辑**：不包含 threading/asyncio，由调用方决定重连时机和方式
4. **OnFrontDisconnected 异步重连**：新线程执行 sleep + try_reconnect，不阻塞 CTP 回调线程
5. **订阅跟踪自动恢复**：MarketService.subscribe 调用时同步更新 ReconnectService 的订阅列表

### 后续 PR 依赖标注

以下功能在 PR-7 中提供了基础设施（handle_ws + ws_manager + broadcast），但数据源依赖后续 PR：

| 缺口 | 依赖 PR | 说明 |
|------|---------|------|
| ✅ 报单回报 → ws/order 广播 | PR-9 | 已完成：OnRtnOrder → ws_manager.broadcast("order", "order_return", data) |
| ✅ 成交回报 → ws/order 广播 | PR-9 | 已完成：OnRtnTrade → ws_manager.broadcast("order", "trade_return", data) |
| ⏳ 持仓更新 → ws/position 广播 | **PR-11** | ReqQryInvestorPosition 结果需要查询 API |
| 止损单状态 → ws/stop 广播 | PR-13 | StopOrderService 状态变更 → ws_manager.broadcast("stop", "stop_order_update", data) |

PR-7 已完成的基础设施：
- `handle_ws()` 统一 handler，支持任意 endpoint + 可选 subscribe_fn/unsubscribe_fn
- `WebSocketManager.broadcast(endpoint, msg_type, data)` 通用广播
- `ReconnectService` 断线重连 + 自动重新订阅
- `OnFrontDisconnected` → system 广播 + reconnect 触发

### Commit 记录

| Commit | 内容 |
|--------|------|
| `c370cbc` | feat(PR-7): WebSocket handler lifecycle + message routing — 9 tests |
| `05b16a6` | feat(PR-7): WebSocket heartbeat — periodic ping + dead connection cleanup — 7 tests |
| `4f07b9f` | feat(PR-7): CTP reconnect service — exponential backoff + auto-resubscribe — 12 tests |
| `5386563` | feat(PR-7): WebSocket integration — unified handlers + heartbeat + disconnect handling — 7 tests |
| `200ab85` | refactor(PR-7): remove unused placeholder handlers from ws/handlers.py |
| `82ef2e9` | fix(PR-7): review R3 - await同步函数+connection_status状态缺失 |


---

## PR-9: 后端交易API实现

**分支**：`feature/pr-9-trader-api`
**依赖**：PR-7
**状态**：✅ 已合并（PR #12，2026-07-20）

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_types.py` | +15 | CombHedgeFlag / ContingentCondition / ForceCloseReason 枚举 |
| `tests/test_field_mapping.py` | +21 | map_input_order / map_order / map_trade 三种映射函数 |
| `tests/test_trader_api.py` | +9 | insert_order 新参数 (time_condition/hedge_flag/contingent_condition/stop_price)、cancel_order 新参数 |
| `tests/test_order_manager.py` | 16 | OrderManager 构造/insert/cancel/on_rtn_order/on_rtn_trade/cancel_all/线程安全 |
| `tests/test_order_api.py` | 11 | insert/cancel/status/cancel_all/reverse/lock API 端点 + 参数校验 |
| `tests/test_ctp_startup.py` | +4 | start_ctp_trading_connection / TD状态存储 / daemon线程 |
| **合计** | **76**（新增） | |

**全量测试**：391 passed，2 failed（预存 test_config .env 问题），46 skipped（16 trio 环境）

### 实现进度

#### 循环1：枚举补充（15 tests）
- ✅ `ctp_wrapper/types.py` — 新增 CombHedgeFlag / ContingentCondition / ForceCloseReason 三个枚举类
- 📦 Commit: `b3fbec5`

#### 循环2：字段映射（21 tests）
- ✅ `services/field_mapping.py` — map_input_order / map_order / map_trade 三种 CTP→camelCase 映射
- 📦 Commit: `5b7cae2`

#### 循环3：TraderApi 增强（9 tests）
- ✅ `ctp_wrapper/trader_api.py` — insert_order 新增 time_condition / volume_condition / hedge_flag / contingent_condition / force_close_reason / stop_price 参数，取消硬编码字符串
- ✅ cancel_order 新增 exchange_id / instrument_id 参数
- 📦 Commit: `842e772`

#### 循环4：OrderManager 服务（16 tests）
- ✅ `services/order_manager.py` — 方案B 统一入口，包装 TraderApi
- ✅ insert → pending record + CTP 调用
- ✅ cancel / cancel_all / on_rtn_order / on_rtn_trade
- ✅ WebSocket 广播钩子 (set_broadcast_fn)
- ✅ 线程安全 (threading.RLock)
- ✅ reverse / lock 占位（PR-11 完善）
- 📦 Commit: `cf26d85`

#### 循环5：报单 API 路由（11 tests）
- ✅ `api/order.py` — 6 个端点：insert / cancel / status / cancel_all / reverse / lock
- ✅ Pydantic 参数校验（instrumentID 非空、price≥0、volume>0、direction 仅0/1 等）
- ✅ 404 返回 order not found
- 📦 Commit: `79a1f3a`

#### 循环6：TD 连接 + WebSocket 接线（4 tests）
- ✅ `services/ctp_startup.py` — start_ctp_trading_connection()：创建 TraderApi + OrderManager，启动 TD 后台线程
- ✅ CTP 回调 → 字段映射 → OrderManager → WebSocket 广播完整链路
- ✅ `api/connection.py` — /status 端点 tdConnected 真实状态
- ✅ `main.py` — lifespan 启动 TD 连接
- 📦 Commit: `869d358`

### 关键设计决策

1. **OrderManager 方案 B**：统一入口，包装 TraderApi。API 层只依赖 OrderManager，不直接调 TraderApi
2. **TD 连接 fire-and-forget**：TD 在后台线程启动，不阻塞 MD 的 startup。tdConnected 状态实时反映连接结果
3. **reverse / lock 方案 A**：本期只做 API 框架（返回占位消息），实际编排逻辑延期 PR-11
4. **枚举引用替代硬编码**：insert_order 中所有 CTP 字段使用枚举类引用，消除 magic strings
5. **字段映射表驱动**：沿用 `field_mapping.py` 的 `[(ctp_attr, json_key, default)]` 模式，与行情映射一致

### 后续 PR 依赖

以下功能在 PR-9 中提供了 OrderManager + WS 广播基础设施，但数据源依赖后续 PR：

| 缺口 | 依赖 PR | 说明 |
|------|---------|------|
| 持仓更新 → ws/position 广播 | PR-11 | ReqQryInvestorPosition 结果需要查询 API |
| reverse 实际逻辑 | PR-11 | 需要查询持仓方向和数量 |
| lock 实际逻辑 | PR-11 | 需要查询持仓方向和数量 |
| 报单流水查询 | PR-11 | ReqQryOrder 主动查询 |

### 审查反馈修复（R1：1🔴+6🟡，R2：0🔴+2🟡 → 审查通过）

审查文件：`review-feedback-a-pr9.md`

| # | 轮次 | 严重度 | 问题 | 处理 |
|---|:---:|--------|------|------|
| B1 | R1 | 🔴 | TD login 流程不完整（状态永远 "connecting"） | ✅ 补齐 OnFrontConnected→login→OnRspUserLogin 回调链路 |
| S1 | R1 | 🟡 | cancel_all 活单判断硬编码 | ✅ 使用 OrderStatus 常量；后升级为 _ACTIVE_STATUSES 类常量 |
| S2 | R1 | 🟡 | cancel() 未传 exchange/instrument | ✅ 从 tracked order 提取透传 |
| S3 | R1 | 🟡 | reverse/lock 占位返回 200 | ✅ 改为 HTTPException(501) |
| S4 | R1 | 🟡 | broadcast 回调无测试 | ✅ 新增 3 个 TestOrderManagerBroadcast 测试 |
| S5 | R1 | 🟡 | _attempt_reconnect 仅 MD | ✅ 添加 TODO(PR-17) |
| S6 | R1 | 🟡 | OnRspOrderInsert/OnRspOrderAction 未接线 | ✅ 已接线+logger.warning 记录错误 |
| S7 | R2 | 🟡 | progress.md 未更新 | ✅ 已更新 |
| S8 | R2 | 🟡 | 工作区不干净 | ✅ 全部 commit |

### SimNow 实盘调试记录（17 commits）

TDD 完成 + 审查修复后，接入 SimNow 7x24 环境进行实盘测试，发现以下问题：

| # | 问题 | 根因 | 修复 Commit |
|---|------|------|-------------|
| 1 | insert 返回假成功 | `ReqOrderInsert` 返回 0 = 消息已入队，不等回调 | `fc12f66` |
| 2 | cancel 返回假成功 | 同上，不等 `OnRspOrderAction` | `cdf793e` |
| 3 | 回调永不触发（3s 超时） | `order_manager` 闭包变量 NameError | `d7b8295` |
| 4 | insert 仍超时 | SimNow 可能不发 `OnRspOrderInsert`，只发 `OnRtnOrder` | `a90b1ed` |
| 5 | "结算结果未确认" 拒单 | 登录后未调 `ReqSettlementInfoConfirm` | `ec631c2` |
| 6 | "无效的 ExchangeID" 拒单 | `CThostFtdcInputOrderField.ExchangeID` 为空 | `3455648` |
| 7 | OrderSubmitStatus 判断错误 | 把 "2"(ModifySubmitted) 当 InsertRejected | `a28ff81` |
| 8 | OrderStatus="a" 被判失败 | "a" = Unknown 是 CTP 初始态，不是错误 | `fd35195` |
| 9 | volumeCondition 被丢弃 | API 校验了但没传给 CTP | `1d71367` |
| 10 | FOK/FAK 约束未校验 | 非法组合被 CTP 静默拒绝 | `33e6d57` |
| 11 | cancel 无法定位报单 | orderSysID 未从 tracked order 提取透传 | `3be4063` |
| 12 | cancel_all 掩盖失败 | 只返回数量，不区分 attempted/succeeded/failed | `5a0de68` |
| 13 | login/logout 流程 | MD 非阻塞 + TD 凭证接管 + logout 只断 TD | `07a08d9` `a39e65a` |
| 14 | orderRef 跨重启碰撞 | order_ref 复位 + 不校验 SessionID | `660354c` |
| 15 | snapshots 返回 DBL_MAX | CTP ~1.8e308 哨兵未经过滤 | `6af36a3` `5eb781a` |
| 16 | cancel_all 漏登录检查 + 活单漏 "a"/"3" | 3 个端点不一致 + OrderStatus 枚举不完整 | `bf64fa0` |
| 17 | cancel_order 缺 FrontID/SessionID + OrderSysID 空格 | CTP 撤单比对的会话标识缺失 | `77fbe3b` |

### Commit 记录

| Commit | 内容 |
|--------|------|
| `b3fbec5` | feat(task-09): CombHedgeFlag, ContingentCondition, ForceCloseReason 枚举 — 15 tests |
| `5b7cae2` | feat(task-09): CTP 字段映射 — map_input_order, map_order, map_trade — 21 tests |
| `842e772` | feat(task-09): TraderApi 增强 — insert_order/cancel_order 新参数 — 9 tests |
| `cf26d85` | feat(task-09): OrderManager 服务 — 方案B 统一入口 — 16 tests |
| `79a1f3a` | feat(task-09): order API 路由 — 6 端点 + Pydantic 校验 — 11 tests |
| `869d358` | feat(task-09): TD 连接启动+回调接线+tdConnected — 4 tests |
| `c58651e` | fix(task-09): R1 审查修复 — TD login + cancel/cancel_all/status + reverse/lock 501 + broadcast 测试 |
| `fc12f66`~`fd35195` | fix(task-09): insert/cancel 回调同步 + 闭包修复 + 状态机修正（13 commits） |
| `660354c` | fix(task-09): orderRef 跨重启碰撞 — 双层防护 |
| `bf64fa0` | fix(task-09): R2 审查修复 — cancel_all 登录检查 + OrderStatus 枚举补全 |
| `6af36a3` `5eb781a` | fix(task-09): DBL_MAX 哨兵值过滤 |
| `77fbe3b` | fix(task-09): cancel_order FrontID/SessionID + OrderSysID 规范化 |
| `bc80cfd` | docs(task-09): 更新 progress.md — PR-9 已合并，32 commits 391 tests |

---

## PR-C3: 实现一键反向 / 一键锁仓接口

**分支**：`fix/consistency-c3-reverse-lock`
**依赖**：无
**状态**：✅ 开发完成，待自验证

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_order_api.py` | +8 | reverse/lock 端点（多头/空头/无持仓/TD未连接） |
| **合计** | **8**（新增） | |

### 实现进度

#### 循环1：reverse/lock 实现（8 tests）
- ✅ `api/order.py` — `reverse_position()` 替换 501 占位符，实现平仓+反向开仓
- ✅ `api/order.py` — `lock_position()` 替换 501 占位符，实现反向开仓（锁仓）
- ✅ `tests/test_order_api.py` — 新增 8 个测试覆盖多头/空头/无持仓/TD未连接场景
- 📦 Commit: `575812b`

### 关键设计决策

1. **CTP posiDirection 映射**：posiDirection "2"=多头(买), "3"=空头(卖)
   - 多头平仓 → direction="1"(卖), offset="1"(平仓)
   - 空头平仓 → direction="0"(买), offset="1"(平仓)
2. **reverse 逻辑**：先平仓（反方向+平仓标志），再开仓（同原方向+开仓标志）
3. **lock 逻辑**：仅反方向开仓（不平原有持仓）
4. **无持仓返回错误**：不抛异常，返回 `{success: false, message: "No position for ..."}`

### Commit 记录

| Commit | 类型 | 描述 |
|--------|------|------|
| `575812b` | feat(task-C3): 实现一键反向/一键锁仓接口 — 8 tests pass |

---

## PR-C2: VolatilityData 补充 updateTime 字段

**分支**：`fix/consistency-c2-volatility-updatetime`
**依赖**：无
**状态**：✅ 开发完成，待自验证

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_options_models.py` | +4 | VolatilityData updateTime 字段（to_dict 包含、默认空值、from_dict 读取、from_dict 默认） |
| **合计** | **4**（新增） | |

### 实现进度

#### 循环1：VolatilityData updateTime 字段（4 tests）
- ✅ `models/options.py` — VolatilityData dataclass 新增 `updateTime: str = ""`
- ✅ `models/options.py` — to_dict() 返回 updateTime
- ✅ `models/options.py` — from_dict() 读取 updateTime（默认空字符串）
- ✅ `services/options_service.py` — get_volatility() 返回字典补充 updateTime（datetime.now().strftime("%H:%M:%S")）
- 📦 Commit: `d58ac42`

### 关键设计决策

1. **updateTime 默认空字符串**：与 dataclass 其他字段保持一致的默认值模式
2. **get_volatility() 使用 datetime.now()**：每次计算时记录当前时间，格式 HH:MM:SS
3. **from_dict() 容错**：使用 `d.get("updateTime", "")` 处理缺少字段的情况

### Commit 记录

| Commit | 类型 | 描述 |
|--------|------|------|
| `d58ac42` | feat(task-C2): VolatilityData 补充 updateTime 字段 — 4 tests pass |

---

## PR-19: 后端合约查询API

**分支**：`feature/pr-19-instrument-query-api`
**依赖**：PR-9
**状态**：🔄 审查修复完成，待二次审查

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_trader_api.py` | +5 | query_instruments() 调用 ReqQryInstrument、BrokerID/InvestorID 设置、返回值处理 |
| `tests/test_callback.py` | +4 | OnRspQryInstrument 事件日志、handler 分发、默认不崩溃 |
| `tests/test_field_mapping.py` | +8 | map_instrument() CTP→camelCase 映射（核心字段、期权字段、默认值） |
| `tests/test_market_service.py` | +8 | refresh_instruments_from_ctp() 查询触发、状态校验、结果累积、文件保存、回调通知 |
| `tests/test_market_api.py` | +4 | POST /api/market/instruments/refresh 端点（成功、无trader、未登录、查询失败） |
| **合计** | **29**（新增） | |

### 实现进度

#### 循环1：TraderApi.query_instruments()（5 tests）
- ✅ `ctp_wrapper/trader_api.py` — query_instruments() 方法，调用 ReqQryInstrument
- 📦 Commit: `a4686a3`

#### 循环2：OnRspQryInstrument 回调（4 tests）
- ✅ `ctp_wrapper/callback.py` — _td_on_rsp_qry_instrument 事件日志+handler 分发
- 📦 Commit: `96df302`

#### 循环3：map_instrument() 字段映射（8 tests）
- ✅ `services/field_mapping.py` — map_instrument() CTP→camelCase，12 字段含期权字段
- 📦 Commit: `131aaf8`

#### 循环4：MarketService.refresh_instruments_from_ctp()（8 tests）
- ✅ `services/market_service.py` — refresh_instruments_from_ctp()、on_instruments_result()、set_instruments_callback()
- ✅ 支持增量累积（bIsLast=False 时暂存，bIsLast=True 时保存+回调）
- ✅ CTP 对象自动映射为 camelCase dict
- 📦 Commit: `b48555f`

#### 循环5：REST 端点 + CTP 回调接线（4 tests）
- ✅ `api/market.py` — POST /api/market/instruments/refresh 端点
- ✅ `services/ctp_startup.py` — OnRspQryInstrument → MarketService.on_instruments_result 接线
- ✅ `tests/conftest.py` — pytest-asyncio 配置
- 📦 Commit: `5d48258`

### 关键设计决策

1. **增量累积模式**：CTP 的 OnRspQryInstrument 会多次调用（bIsLast=False），最后一次 bIsLast=True。MarketService 在内存中累积，最后一次才写入文件
2. **字段映射复用**：map_instrument() 沿用 field_mapping.py 的 `[(ctp_attr, json_key, default)]` 表驱动模式
3. **回调接线统一**：OnRspQryInstrument 在 start_ctp_trading_connection() 和 connect_trading() 两处都接线，确保 startup 和 /login 两条路径都支持合约查询
4. **文件保存路径**：默认保存到 `server/data/instruments.json`，与 startup 加载路径一致

### 审查修复记录

**第 1 轮审查**（`review-feedback-a-pr19.md`）：1 🔴 + 6 🟡 + 2 🔵 → 全部修复
- 🔴 field_mapping.py 死代码（12行粘贴残余）→ 删除
- 🟡 hasattr 冗余 → 简化
- 🟡 类型注解冗余 → 移除
- 🟡 回调接线重复 → 提取 `_wire_instrument_query()` 辅助函数
- 🟡 OnRspQryInstrument 未检查 pRspInfo → 添加错误日志
- 🟡 import 位置不规范 → 移至文件顶部
- 🔵 回调签名不匹配 → 实际代码已匹配，无需修改
- 🔵 双重 callback 设置 → 删除冗余 `set_instruments_callback` 调用
- 📦 Commit: `99c8c06`

---

## PR-11: 后端查询API实现

**分支**：`feature/pr-11-query-api`
**依赖**：PR-9
**状态**：✅ 已完成

### TDD 循环记录

| 循环 | 功能点 | 测试文件 | 新增测试 | 状态 |
|------|--------|----------|----------|------|
| #1 | map_position() + map_account() 字段映射 | test_field_mapping.py | 26 | ✅ |
| #2 | TraderSpi 查询回调 | test_callback.py | 15 | ✅ |
| #3 | TraderApi 查询方法 | test_trader_api.py | 15 | ✅ |
| #4 | QueryService 查询服务层 | test_query_service.py | 22 | ✅ |
| #5 | 查询 API 端点 | test_query_api.py | 9 | ✅ |
| #6 | QueryService 接线（ctp_startup） | — | — | ✅ |

### Commit 记录

| Commit | 类型 | 描述 |
|--------|------|------|
| b883764 | test | map_position() + map_account() — 26 new tests |
| 69f1e7b | feat | TraderSpi query callbacks — OnRspQryOrder/Trade/Position/Account |
| 27b5b0a | feat | TraderApi query methods — query_orders/trades/positions/account |
| 93ea36a | feat | QueryService — query orchestration with CTP callback accumulation |
| 1e9e786 | feat | query API endpoints — GET + POST /refresh |
| 16172b5 | feat | wire QueryService into ctp_startup |

### 关键设计决策

1. **QueryService 同步等待模式**：CTP 回调在 CTP 线程，API 在 asyncio 线程。使用 `threading.Event` 做线程间同步，`run_in_executor` 在 API 层异步化
2. **字段映射复用**：map_position() 和 map_account() 沿用 field_mapping.py 的 `[(ctp_attr, json_key, default)]` 表驱动模式
3. **缓存 + 刷新分离**：GET 端点返回缓存数据（快速），POST /refresh 端点触发 CTP 查询（阻塞）
4. **回调接线统一**：`_wire_query_callbacks()` 在 start_ctp_trading_connection() 和 connect_trading() 两处都接线

### 审查修复记录

**第 1 轮审查**（`review-feedback-a-pr11.md`）：0 🔴 + 6 🟡 + 2 🔵 → 全部处理
- 🟡 GET 端点访问私有成员 → 添加公开属性（orders/trades/positions/account）
- 🟡 refresh 端点未检查登录状态 → 4 个端点添加 login_status 检查
- 🟡 import ctp 重复 → 保留（测试模式要求，与现有代码一致）
- 🟡 缺少 refresh 端点测试 → 新增 9 个测试
- 🟡 查询回调高度重复 → 提取 `_make_qry_callback()` 工厂函数

---

## PR-13: 后端止损单服务实现

**分支**：`feature/pr-13-stop-order`
**依赖**：PR-9
**状态**：✅ 已完成

### TDD 循环记录

| 循环 | 功能点 | 测试文件 | 新增测试 | 状态 |
|------|--------|----------|----------|------|
| #1 | StopOrder 模型 + StopOrderService 核心逻辑 | test_stop_order_service.py | 29 | ✅ |
| #2 | 止损单 API 端点 | test_stop_order_api.py | 10 | ✅ |
| #3 | StopOrderService 接线（main.py + ctp_startup） | test_stop_order_integration.py | 3 | ✅ |
| #4 | GFD 止损单过期逻辑 | test_stop_order_service.py | 2 | ✅ |

### Commit 记录

| Commit | 类型 | 描述 |
|--------|------|------|
| ef734ae | test | StopOrder model + StopOrderService core logic — 29 tests |
| 3f4a2d7 | feat | stop order API endpoints — 10 tests |
| fcb15b4 | feat | wire StopOrderService into main.py + ctp_startup — 42 tests |
| b0a69f7 | feat | GFD stop order expiry — skip previous day orders on startup — 44 tests |
| 09b256b | fix | review反馈 - S1月初测试+S2原子写入+S4移除未用参数+S5手动验证命令 |

### 关键设计决策

1. **StopOrderService 独立模块**：不依赖 OrderManager 内部实现，通过依赖注入获取 OrderManager
2. **触发条件**：多头止损（direction=buy）：lastPrice <= stopPrice；空头止损（direction=sell）：lastPrice >= stopPrice
3. **持久化策略**：每次状态变更原子写入 data/stop_orders.json（先写 .tmp 再 os.replace），启动时只加载 pending 状态的止损单
4. **GFD 过期**：启动时跳过 createdAt 非当日的止损单
5. **行情接线**：ctp_bridge.py 新增 stop_order_callback 参数，_wire_bridge() 使用懒查找（StopOrderService 可能晚于 MD 初始化）
6. **WebSocket 广播**：submit/cancel/trigger 都推送 stop_order_update 到 /ws/stop 端点

### 审查修复记录

**第 1 轮审查**（`review-feedback-a-pr13.md`）：0 🔴 + 7 🟡 → 4 采纳 + 3 保留
- 🟡 S1: GFD 测试月初崩溃 → 改用 `timedelta(days=1)`
- 🟡 S2: 非原子写入 → 先写 `.tmp` 再 `os.replace()`
- 🟡 S3: @dataclass → 保留（当前实现功能正确）
- 🟡 S4: market_service 未使用 → 改为可选参数
- 🟡 S5: 手动验证命令 → 更新 task.md
- 🟡 S6: 无数量上限 → 后续优化
- 🟡 S7: 锁获取模式 → 当前可接受
- 📦 Commit: `09b256b`
- 🟡 pending 列表线程安全 → 添加 docstring 标注线程模型
- 🔵 subscribe/unsubscribe 语义 → 有意为之（本地状态=用户意图，CTP 失败不回滚）
- 🔵 account 返回格式 → 有意为之（单一对象 vs 列表，与 CTP 数据模型一致）
- 📦 Commit: `d6eb313`

---

## PR-18: 后端期权API实现

**分支**：`feature/pr-18-options-api`
**依赖**：PR-5
**状态**：🔄 开发完成，待审查

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_options_models.py` | 11 | OptionQuote/OptionChain/VolatilityData 模型（创建、序列化、反序列化） |
| `tests/test_options_service.py` | 20 | OptionsService（期权筛选、期权链聚合、Black-Scholes IV计算） |
| `tests/test_options_api.py` | 11 | REST API 集成测试（/options、/option_chain、/volatility） |
| `tests/test_options_integration.py` | 2 | OptionsService 接入 app.state |
| **合计** | **44**（新增） | |

### 实现进度

#### 循环1：数据模型（11 tests）
- ✅ `models/options.py` — OptionQuote、OptionChain、VolatilityData 三个 dataclass
- ✅ to_dict() / from_dict() 序列化/反序列化
- 📦 Commit: `d9f9a9b`

#### 循环2：OptionsService 核心逻辑（20 tests）
- ✅ `services/options_service.py` — 期权筛选、期权链聚合、Black-Scholes 隐含波动率计算
- ✅ get_options() — 按 productClass='2' 筛选，可选 underlying 过滤
- ✅ get_option_chains() — 按 (underlyingInstrID, expireDate) 分组，calls/puts 分列，按 strikePrice 排序
- ✅ calculate_implied_volatility() — Newton-Raphson 迭代法求解 IV
- ✅ _black_scholes_price() — Black-Scholes 期权定价公式
- 📦 Commit: `6cfc4f7`

#### 循环3：API 端点（11 tests）
- ✅ `api/market.py` — 新增 3 个端点：
  - GET /api/market/options — 期权合约列表
  - GET /api/market/option_chain — 期权T型报价（按标的+到期日分组）
  - GET /api/market/volatility — 隐含波动率（Black-Scholes）
- 📦 Commit: `f1701aa`

#### 循环4：接入 main.py（2 tests）
- ✅ `main.py` — OptionsService 注入 app.state
- 📦 Commit: `14f9adc`

### 关键设计决策

1. **OptionsService 无状态设计**：不维护内部缓存，每次调用从 market_service 获取 instruments 和 snapshots，避免数据同步问题
2. **期权链聚合键**：(underlyingInstrID, expireDate) 二元组，同一标的+同一到期日的期权聚合为一个 OptionChain
3. **Black-Scholes Newton-Raphson**：标准 Newton-Raphson 迭代，初始猜测 sigma=0.3，最大 100 次迭代，容差 1e-6
4. **VolatilityData 完整参数**：返回 impliedVolatility, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType 六个字段
5. **期权类型映射**：OptionsType '1'=看涨(Call), '2'=看跌(Put)，与 CTP 官方定义一致

### Commit 记录

| Commit | 类型 | 描述 |
|--------|------|------|
| `d9f9a9b` | test | OptionQuote/OptionChain/VolatilityData models — 11 tests pass |
| `6cfc4f7` | feat | OptionsService — filtering, chain aggregation, Black-Scholes IV — 20 tests pass |
| `f1701aa` | feat | options API endpoints — /options, /option_chain, /volatility — 11 tests pass |
| `14f9adc` | feat | wire OptionsService into main.py — 88 tests pass |
