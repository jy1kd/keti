# 角色A 开发记录

**角色**：角色A（后端开发）
**负责目录**：server/

---

## PR-1: 后端CTP连接验证（技术Spike）

**分支**：`feature/pr-1-ctp-verify`
**依赖**：无
**状态**：✅ 开发完成，待审查

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
**状态**：✅ 开发完成，待审查

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
**状态**：✅ 二次审查修复完成，待合并

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_market_service.py` | 35 | MarketService 初始化、合约缓存(CRUD+模糊搜索)、订阅管理(500上限)、快照缓存、文件加载 |
| `tests/test_field_mapping.py` | 22 | CTP深度行情 PascalCase→camelCase 全字段映射、边界值、缺失属性 |
| `tests/test_market_api.py` | 20 | REST API 集成测试(instruments/subscribe/unsubscribe/snapshots/kline/depth) |
| `tests/test_ctp_bridge.py` | 8 | CTP回调桥接 (注册/快照/映射/广播/合并/容错) |
| `tests/test_*.py` (PR-1/PR-3 原有) | 150 | 回归 |
| **合计** | **235** | |

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

### 关键设计决策

1. **MarketService 纯同步设计**：所有数据操作方法均为同步，CTP 回调线程安全。WebSocket 推送由外部调用方处理
2. **字段映射表驱动**：`_DEPTH_MARKET_DATA_FIELDS` 列表定义 CTP→camelCase 映射，40 字段含默认值，`getattr` 兜底
3. **集成测试用独立 FastAPI app**：每个测试文件创建独立 app 实例，不依赖 `main.py` 的全局 `app`
4. **K线占位**：当前返回空 bars，需 CTP 历史数据查询接口支持
5. **订阅限制批处理原子性**：整批检查上限，不部分添加

### Commit 记录

| Commit | 内容 |
|--------|------|
| `6f19568` | feat(task-05): MarketService核心逻辑 — 合约缓存+订阅管理+快照缓存 — 30 tests pass |
| `f810499` | feat(task-05): CTP字段映射 — PascalCase→camelCase深度行情数据 — 22 tests pass |
| `77a8f9f` | feat(task-05): 行情API路由实现 — instruments/subscribe/unsubscribe/snapshots/kline/depth — 20 tests pass |
| `ef837a3` | feat(task-05): 合约列表缓存 — instruments.json文件加载+启动自加载 — 5 tests pass |

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
