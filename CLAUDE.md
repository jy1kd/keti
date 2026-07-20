# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

上期所 Simnow 模拟交易终端 — 浏览器 Web 应用，对接 simnow 模拟柜台，实现行情接入、交易接入、手动报单等功能。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 | UI 框架、构建 |
| 表格 | @visactor/vtable | 高性能虚拟滚动，支持 1000+ 合约 |
| 图表 | ECharts 5 | K 线图、技术指标 |
| 状态管理 | Zustand | 轻量级状态管理，localStorage 持久化 |
| 后端 | Python FastAPI 0.100+ + websockets 11.x | REST API、WebSocket |
| CTP 绑定 | ctp-python 6.7.7.post1 | Python CTP 封装 |

## 项目结构

```
keti/
├── docs/                     # 项目文档
│   ├── prd.md                # 产品需求文档
│   ├── design.md             # 技术架构设计（接口、数据模型）
│   ├── dev.md                # 项目设计稿（代码结构、技术规范）
│   ├── task.md               # PR 任务拆分（21 个 PR，5 个阶段）
│   ├── task-dev-flow.md      # 开发流程指南
│   └── ctp-api-structure.txt # CTP 字段探测输出（类型定义参考）
├── snapshots/role-a/         # 角色A 快照文件
│   ├── progress.md           # 进度快照（验证通过/修复完成后更新）
│   ├── dev-record-a.md       # 开发记录（TDD 循环、commit 对应）
│   ├── review-feedback-a.md  # 审查反馈（审查窗口写入）
│   └── review-reply-a.md     # 反馈处理记录（开发窗口写入）
├── frontend/                 # 前端代码（角色B 负责）
├── server/                   # 后端代码（角色A 负责）
│   ├── ctp_wrapper/          # CTP API 封装层（注意：不能命名为 ctp/！）
│   │   ├── md_user_api.py    # 行情 API（连接、登录、订阅、退订）
│   │   ├── trader_api.py     # 交易 API（连接、登录、报单、撤单）
│   │   ├── callback.py       # 回调 SPI（BaseSpi → MdSpi / TraderSpi）
│   │   └── types.py          # CTP 常量枚举（Direction, OffsetFlag 等）
│   ├── config.py             # 配置管理（环境变量读取）
│   ├── main.py               # CTP 验证脚本（5 步：import → config → MD → TD → 市价单）
│   ├── requirements.txt      # Python 依赖
│   ├── .env                  # 实际配置（gitignore）
│   ├── .env.sample           # 配置模板（提交）
│   └── tests/                # 108 个单元测试（pytest）
├── md_demo.py                # CTP 字段结构探测脚本
└── ctp_realtime_demo.py      # CTP 实时行情显示脚本
```

## 常用命令

### 后端

```bash
# 安装依赖
cd server && pip install ctp-python python-dotenv pytest

# 运行测试（在 server/ 目录下）
cd server && python -m pytest tests/ -v

# 运行单个测试文件
python -m pytest tests/test_config.py -v

# 运行 CTP 连接验证（需交易时段 09:00-15:00 / 21:00-02:30）
python server/main.py

# 运行字段探测（无需连接，直接反射 CTP 字段定义）
python md_demo.py

# 运行实时行情（需交易时段）
python ctp_realtime_demo.py
```

### 前端

```bash
cd frontend
npm install
npm run dev       # 开发服务器 → http://localhost:5173
npm run build     # 构建
npm run lint      # ESLint
```

## ⚠️ 关键陷阱

### `server/ctp_wrapper/` 命名：绝对不能命名为 `ctp/`

Python 会把脚本所在目录加入 `sys.path[0]`。若本地包叫 `server/ctp/`，`import ctp` 会找到本地空包而非 site-packages 里的 `ctp-python` 库，导致 `ctp.CThostFtdcMdApi` 报 `AttributeError`。**已重命名为 `ctp_wrapper/`**，所有导入使用 `from ctp_wrapper.xxx import ...`。

### SubscribeMarketData 必须传字符串列表

ctp-python 的 SWIG 绑定有 bug：传 bytes 列表会导致堆损坏崩溃（`0xC0000374`）。

```python
# ✅ 正确
api.SubscribeMarketData(["IF2608"])

# ❌ 崩溃！
api.SubscribeMarketData([b"IF2608"])
```

`md_user_api.subscribe()` 已内置 `bytes → str` 防护（使用 `.decode()` 而非 `str()`，因为 `str(b"xxx")` 在 Python 3 中会得到 `"b'xxx'"`）。

## CTP 连接流程

### 行情连接（参考 `ctp_realtime_demo.py`）

```
CreateFtdcMdApi() → RegisterSpi(spi) → RegisterFront("tcp://...") → Init()
  → OnFrontConnected 回调
    → ReqUserLogin(login_field, request_id)
      → OnRspUserLogin 回调（检查 pRspInfo.ErrorID == 0）
        → SubscribeMarketData(["IF2608"])  # 字符串列表！
          → OnRspSubMarketData 回调
          → OnRtnDepthMarketData 回调（持续推送）
```

### 交易连接（参考 `dev.md`）

```
CreateFtdcTraderApi() → RegisterSpi(spi) → RegisterFront("tcp://...")
  → SubscribePublicTopic/SubscribePrivateTopic(THOST_TERT_QUICK)
  → Init()
    → OnFrontConnected 回调
      → ReqAuthenticate  # 穿透式认证（部分环境需要）
        → OnRspAuthenticate 回调
          → ReqUserLogin
            → OnRspUserLogin 回调
              → ReqSettlementInfoConfirm  # 确认结算
```

### SimNow 7x24 测试环境

| 项目 | 地址 |
|------|------|
| 行情前置 | `tcp://182.254.243.31:40011` |
| 交易前置 | `tcp://182.254.243.31:40001` |
| BrokerID | `9999` |

配置文件：`server/.env`（gitignore），模板：`server/.env.sample`

## 架构关键设计

### 回调 SPI 设计（`callback.py`）

采用组合模式（非继承 CTP SPI 基类），通过 `BaseSpi` 基类提供事件日志 + 自定义 handler 注册：

```python
spi = MdSpi(api=self)
spi.on("OnFrontConnected", lambda: print("connected"))
# 每个回调自动记录到 spi.events 列表（含 timestamp）
```

**与真实 CTP SPI 的区别**：`ctp_realtime_demo.py` 使用继承方式（`class MarketDataSpi(ctp.CThostFtdcMdSpi)`），因为 CTP 直接调用 SPI 方法。当前 `callback.py` 采用组合模式是为了方便事件日志和 handler 注册，但**不能直接传给 `RegisterSpi()`**——需要 CTP 回调穿透时，参见 `dev.md` 中 `MdSpi(ctp.CThostFtdcMdSpi)` 的继承示例。

### 状态管理

- `connection_status`: `disconnected → connecting → connected → error`
- `login_status`: `not_logged_in → logging_in → logged_in → error`
- `subscribed_instruments`: 列表，subscribe 时追加，unsubscribe 时移除

### REST API 路由（`dev.md`）

| 前缀 | 职责 |
|------|------|
| `/api/connection` | 登录、登出、状态 |
| `/api/market` | 合约列表、订阅、快照、K 线、五档深度、期权链、波动率 |
| `/api/order` | 报单、撤单、批量撤单、一键反向/锁仓、止损单 |
| `/api/query` | 报单流水、成交、持仓、资金、合约 |

### WebSocket 分端点设计

| 端点 | 消息类型 |
|------|----------|
| `/ws/market` | `market_data` |
| `/ws/order` | `order_return`, `trade_return` |
| `/ws/position` | `position_update` |
| `/ws/stop` | `stop_order_update` |
| `/ws/system` | `connection_status`, `error` |

## CTP 字段参考

### 核心 CTP 数据结构（`md_demo.py` 探测结果，见 `docs/ctp-api-structure.txt`）

| CTP 类 | 用途 | 关键字段 |
|--------|------|----------|
| `CThostFtdcDepthMarketDataField` | 行情快照（50+ 字段） | `InstrumentID`, `LastPrice`, `BidPrice1-5`, `AskPrice1-5`, `Volume`, `OpenInterest`, `UpdateTime` |
| `CThostFtdcInputOrderField` | 报单请求（30+ 字段） | `InstrumentID`, `Direction`, `CombOffsetFlag`, `LimitPrice`, `VolumeTotalOriginal`, `OrderPriceType` |
| `CThostFtdcOrderField` | 报单回报（50+ 字段） | `OrderRef`, `OrderSysID`, `OrderStatus`, `VolumeTraded` |
| `CThostFtdcTradeField` | 成交回报（30+ 字段） | `TradeID`, `Price`, `Volume`, `TradeTime` |
| `CThostFtdcInvestorPositionField` | 持仓信息（40+ 字段） | `InstrumentID`, `Position`, `PositionProfit`, `OpenCost` |
| `CThostFtdcTradingAccountField` | 账户资金（40+ 字段） | `Balance`, `Available`, `FrozenMargin`, `CurrMargin` |
| `CThostFtdcInstrumentField` | 合约信息（30+ 字段） | `InstrumentID`, `VolumeMultiple`, `PriceTick`, `OptionsType`, `StrikePrice` |

### 字段映射规则

CTP 使用 PascalCase 字段名（如 `InstrumentID`, `LastPrice`, `BidPrice1`）。前后端之间传输使用 camelCase（如 `instrumentID`, `lastPrice`, `bidPrice1`）。`types.py` 中的枚举值使用 CTP 原生 char 值（字符串格式）。

## 角色A 开发流程

角色 A 使用两个窗口协作：**窗口1 = 开发模式**（写代码、TDD、commit），**窗口2 = 审查模式**（只读 diff、写反馈）。

详细的提示词模板和流程规范见 memory 文件（`memory/role-a-*.md`），核心要点：
- 开发前先诊断（读 docs + git status）
- 严格 TDD：红（写测试）→ 绿（写实现）→ commit
- 开发完成后先自验证，再切审查窗口
- 审查通过后需人工手动验证（交易时段运行 `main.py`），再合并

## 性能要求

- 行情推送延迟：≤100ms
- 表格渲染 FPS：≥60
- 支持合约数量：1000+（vtable 虚拟滚动）

## 注意事项

- 用户偏好使用 localStorage 持久化；业务数据不落库，仅内存展示
- 止损单由后端监控服务实现，复用行情订阅数据流
- GFD 报单依赖 simnow 柜台收盘自动撤销
- 项目依赖 `docs/ctp-api-structure.txt` 做前后端类型对齐，修改 CTP 字段时需同步更新

## 角色B 双窗口开发流程

角色 B 使用两个窗口协作：**开发模式**（写代码、TDD、commit）和 **审查模式**（只读 diff、写反馈）。

### 双窗口规则

| 项目 | 开发模式 | 审查模式 |
|------|----------|----------|
| 职责 | 写代码、跑测试、提交 | 读 diff、写审查反馈 |
| 产出 | `snapshots/role-b/dev-record-b.md` | `snapshots/role-b/review-feedback-b-prX.md` |
| 文档 | 可读全部、可改 `dev-record-b.md` | 只读、只写 `review-feedback-b-prX.md` |
| 操作 | 按 TDD 流程：红→绿→重构→提交 | 写完反馈后停，不改代码 |

### 文件命名规范

| 文件 | 用途 | 写入窗口 |
|------|------|----------|
| `dev-record-b.md` | 开发记录（所有PR共用） | 开发模式 |
| `progress.md` | 进度快照 | 开发模式 |
| `review-feedback-b-prX.md` | 审查反馈（每个PR单独一个） | 审查模式 |
| `review-reply-b-prX.md` | 反馈处理记录（每个PR单独一个） | 开发模式 |
| `verify-discussion-prX.md` | 人工验证讨论记录 | 开发模式 |

### 开发模式启动约束

**可操作范围**：读写 `frontend/`，读写 `snapshots/role-b/dev-record-b.md`，读 `docs/*.md` + `CLAUDE.md`。只改 Task N 对应文件。

**禁止事项**：禁止读写 `review-feedback-b-prX.md` / `review-reply-b-prX.md`，禁止改 `docs/*.md`，禁止提交 Task N+1。

### 诊断输出格式

```
📋 诊断结果

当前 PR：PR-X（标题）
当前阶段：阶段N - 模块名
任务描述：（一句话说明要做什么）
建议分支名：feature/pr-x-xxx
依赖检查：
  - PR-X1：✅ 已完成
  - PR-X2：✅ 已完成
工作区状态：干净 / 有未提交内容（列出）
```

### Commit 规范

- 测试红灯：`test(task-xx): failing tests for XXX`
- 测试绿灯：`feat(task-xx): implement XXX`
- 重构：`refactor(task-xx): optimize XXX`
- 修复审查反馈：`fix(task-xx): review反馈 - 简述修复内容`

### 文档更新时机

- **dev-record-b.md**：开发过程中同步更新
- **progress.md**：仅两处节点允许更新：①自验证全部确认通过；②审查反馈全部修复完成
- **task-dev-flow.md**：仅在整个阶段（开发+验证+审查+人工验证全部完成）结束后才更新状态

### 完整流程速查（9步）

```
第1步 窗口1 → 启动诊断（输出诊断结果+分支建议）
第2步 终端 → 手动创建分支（git checkout -b feature/pr-x-xxx）
第3步 窗口1 → TDD开发（/superpowers:test-driven-development）
第4步 窗口1 → 自验证（/superpowers:verification-before-completion）
第5步 窗口2 → 代码审查（/superpowers:requesting-code-review）
第6步 窗口1 → 处理审查意见（仅审查不通过时，/superpowers:receiving-code-review）
第7步 窗口2 → 二次审查（如需）
第8步 窗口1 → 人工验证（交互式讨论，记录到 verify-discussion-prX.md）
第9步 窗口1 → 收尾合并（生成PR描述，更新task.md状态）
```

详细流程说明见 `执行流程-a.md`。
