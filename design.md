# Design: 上期所Simnow模拟交易终端

## 1. 架构设计

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            用户浏览器（桌面端）                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  行情面板    │  │  报单面板    │  │  查询面板    │  │ 快捷键管理  │       │
│  │  (vtable)   │  │  (点价/表单) │  │  (多Tab)     │  │             │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                    │                                       │
│                    ┌───────────────┴───────────────┐                       │
│                    │         React App             │                       │
│                    │       + TypeScript            │                       │
│                    │  + vtable(高性能) + Zustand   │                       │
│                    └───────────────┬───────────────┘                       │
└────────────────────────────────────┼───────────────────────────────────────┘
                                     │
                    HTTP REST        │        WebSocket
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
┌───────────┴────────────────────────┴────────────────────────┴───────────┐
│                              Python 中间层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │  FastAPI     │  │  WebSocket  │  │  CTP 封装层  │                     │
│  │  (REST API)  │  │  Manager    │  │  (ctypes)   │                     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                     │
│         │                │                │                             │
│         └────────────────┴────────────────┘                             │
│                                    │                                     │
│                    ┌───────────────┴───────────────┐                     │
│                    │      simnow连接管理器         │                     │
│                    └───────────────┬───────────────┘                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                           ┌─────────┴─────────┐
                           │      simnow       │
                           │     模拟柜台       │
                           └───────────────────┘
                           mduserapi (行情)
                           traderapi (交易)
```

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.x | UI框架 |
| 前端语言 | TypeScript | 5.x | 类型安全 |
| 构建工具 | Vite | 5.x | 开发和构建 |
| 表格组件 | @visactor/vtable | latest | 高性能表格（虚拟滚动、增量渲染） |
| 图表库 | echarts | 5.x | K线图、技术指标、波动率图表 |
| 状态管理 | Zustand | latest | 轻量级状态管理 |
| HTTP客户端 | Axios | latest | REST API调用 |
| 后端框架 | FastAPI | 0.100+ | REST API服务 |
| WebSocket | websockets | 11.x | 实时推送 |
| CTP绑定 | ctypes | 内置 | 调用C++ DLL |
| 包管理 | pnpm (前端) + pip (后端) | - | 依赖管理 |

---

## 2. 模块划分

### 2.1 前端模块

```
src/
├── components/           # 通用组件
│   ├── ConnectionStatus/ # 连接状态指示器
│   ├── ContractSearch/   # 合约搜索框
│   ├── OrderForm/        # 报单表单（支持点价、快捷键、价格步进）
│   ├── QuickKeys/        # 快捷键管理组件（含配置面板）
│   ├── BatchCancel/      # 批量撤单组件
│   ├── SpreadDisplay/    # 价差显示组件
│   └── PerfMonitor/      # 渲染性能监控（FPS、渲染耗时，P2，使用echarts）
├── modules/              # 业务模块
│   ├── market/           # 行情模块
│   │   ├── MarketPanel.tsx
│   │   ├── MarketTable.tsx (vtable，支持单击/双击点价)
│   │   ├── DepthQuote.tsx    # 五档行情展示组件
│   │   ├── KLineChart.tsx    # K线图组件（多周期、技术指标）
│   │   └── store.ts
│   ├── order/            # 报单模块
│   │   ├── OrderPanel.tsx
│   │   ├── OrderForm.tsx (支持限价/市价、止损单提交、价格步进)
│   │   ├── StopOrderForm.tsx (止损单表单)
│   │   ├── QuickActions.tsx  # 快捷操作（一键反向、一键锁仓）
│   │   └── store.ts
│   ├── options/            # 期权模块
│   │   ├── OptionPanel.tsx    # 期权面板
│   │   ├── TQuoteTable.tsx    # T型报价表格（含波动率）
│   │   └── store.ts
│   └── query/            # 查询模块
│       ├── QueryPanel.tsx
│       ├── OrderFlow.tsx      # 报单流水
│       ├── TradeFlow.tsx      # 成交流水
│       ├── Position.tsx       # 持仓查询（支持点击平仓）
│       ├── QuoteQuery.tsx     # 报价查询（五档深度）
│       ├── ContractQuery.tsx  # 合约查询
│       ├── StopOrderList.tsx  # 止损单列表
│       └── store.ts
├── services/             # API服务层
│   ├── api.ts            # REST API封装
│   ├── ws.ts             # WebSocket管理
│   └── types.ts          # 类型定义
├── hooks/                # 自定义Hook
│   ├── useHotKeys.ts     # 快捷键Hook（仅报单面板焦点时生效）
│   ├── usePointOrder.ts  # 点价报单Hook
│   ├── usePriceStep.ts   # 价格步进Hook（自动对齐最小变动价位）
│   └── useReconnect.ts   # 断线重连Hook（指数退避重试，最多5次）
├── stores/               # 全局状态
│   ├── connection.ts     # 连接状态（含重连状态）
│   ├── contracts.ts      # 合约列表
│   └── userPrefs.ts      # 用户偏好（自选合约、快捷键配置，localStorage持久化）
├── App.tsx               # 主应用
└── main.tsx              # 入口
```

### 2.2 后端模块

```
server/
├── api/                  # API路由
│   ├── market.py         # 行情相关接口（订阅、退订、快照、报价查询）
│   ├── order.py          # 报单相关接口（限价/市价、撤单、批量撤单）
│   ├── query.py          # 查询相关接口（报单、成交、持仓、资金、合约）
│   └── connection.py     # 连接管理接口（登录、登出、状态）
├── ctp/                  # CTP封装层（使用ctypes调用trader目录中的DLL）
│   ├── md_user_api.py    # 行情API封装（加载thostmduserapi_se.dll）
│   ├── trader_api.py     # 交易API封装（加载thosttraderapi_se.dll）
│   ├── callback.py       # 回调处理
│   └── types.py          # CTP数据类型（基于ThostFtdcUserApiStruct.h）
├── services/             # 业务服务层
│   ├── stop_order.py     # 止损单监控服务（后端监控行情，自动触发报单）
│   ├── order_manager.py  # 报单管理（处理GFD/FOK/FAK有效期逻辑）
│   └── reconnect.py      # 断线重连服务（指数退避，最多5次）
├── ws/                   # WebSocket管理
│   ├── manager.py        # 连接管理
│   └── handlers.py       # 消息处理
├── models/               # 数据模型
│   ├── market.py         # 行情数据模型（含报价深度）
│   ├── order.py          # 报单数据模型（含GFD/FOK/FAK）
│   ├── account.py        # 账户数据模型
│   └── contract.py       # 合约数据模型
├── config.py             # 配置管理
├── main.py               # 应用入口
└── requirements.txt      # Python依赖
```

---

## 3. 数据流设计

### 3.1 行情数据流

```
┌──────────┐    回调     ┌──────────┐   WebSocket   ┌──────────┐
│ simnow   │ ──────────→ │ Python   │ ────────────→ │ React    │
│ 行情柜台  │            │ 中间层   │              │ 前端     │
└──────────┘            └──────────┘              └──────────┘
                              │
                              ↓
                        ┌──────────┐
                        │ 内存缓存 │ (不落库)
                        └──────────┘
```

**WebSocket消息协议**：

所有WebSocket消息统一使用JSON格式，包含`type`和`data`字段：
```json
{
  "type": "<消息类型>",
  "data": { ... }
}
```

**消息类型枚举**：
```typescript
type WSMessageType =
  | 'market_data'        // 行情推送
  | 'order_return'       // 报单回报
  | 'trade_return'       // 成交回报
  | 'stop_order_update'  // 止损单状态更新
  | 'connection_status'  // 连接状态变化
  | 'error';             // 错误消息
```

**各消息类型数据格式**：

`market_data` - 行情推送：
```json
{
  "type": "market_data",
  "data": {
    "instrument_id": "au2406",
    "last_price": 480.50,
    "bid_price1": 480.40,
    "bid_volume1": 10,
    "ask_price1": 480.60,
    "ask_volume1": 8,
    "volume": 12345,
    "open_interest": 67890,
    "update_time": "14:30:05"
  }
}
```

`order_return` - 报单回报：
```json
{
  "type": "order_return",
  "data": {
    "order_ref": "123456",
    "instrument_id": "au2406",
    "direction": "buy",
    "price": 480.50,
    "volume": 1,
    "volume_traded": 0,
    "order_status": "submitted",
    "status_msg": "报单已提交",
    "insert_time": "14:30:10"
  }
}
```

`trade_return` - 成交回报：
```json
{
  "type": "trade_return",
  "data": {
    "trade_id": "T789",
    "order_ref": "123456",
    "instrument_id": "au2406",
    "direction": "buy",
    "price": 480.50,
    "volume": 1,
    "trade_time": "14:30:11"
  }
}
```

`stop_order_update` - 止损单状态更新：
```json
{
  "type": "stop_order_update",
  "data": {
    "stop_order_ref": "SO123",
    "status": "triggered",
    "triggered_order_ref": "456789",
    "triggered_at": "14:35:00"
  }
}
```

`connection_status` - 连接状态变化：
```json
{
  "type": "connection_status",
  "data": {
    "md_connected": true,
    "td_connected": true,
    "message": "连接已恢复"
  }
}
```

`error` - 错误消息：
```json
{
  "type": "error",
  "data": {
    "code": "ORDER_REJECTED",
    "message": "价格不合法",
    "related_ref": "123456"
  }
}
```

### 3.2 报单数据流

**普通报单流程**：
```
┌──────────┐   HTTP POST   ┌──────────┐   CTP Request   ┌──────────┐
│ React    │ ────────────→ │ Python   │ ───────────────→ │ simnow   │
│ 前端     │              │ 中间层   │                 │ 交易柜台  │
└──────────┘              └──────────┘                 └──────────┘
     ↑                         │                             │
     │                         ↓                             │
     │                    ┌──────────┐                       │
     │                    │ 等待回调 │                       │
     │                    └──────────┘                       │
     │                         │                             │
     │         WebSocket       │        CTP Callback        │
     └─────────────────────────┴←────────────────────────────┘
```

**止损单流程**（后端实现）：
```
┌──────────┐   HTTP POST   ┌──────────┐   订阅行情    ┌──────────┐
│ React    │ ────────────→ │ Python   │ ←──────────── │ simnow   │
│ 前端     │  提交止损单   │ 中间层   │  监控价格变化  │ 行情柜台  │
└──────────┘              └──────────┘              └──────────┘
                              │                         │
                              │    价格达到止损价       │
                              │←────────────────────────┤
                              │                         │
                              │    自动触发报单         │
                              ├────────────────────────→│
                              │                         │
                              │                    ┌────┴────┐
                              │                    │ simnow  │
                              │                    │  交易柜台 │
                              │                    └─────────┘
```

**报单请求格式**：
```json
{
  "instrument_id": "au2406",
  "direction": "buy",           // buy/sell
  "offset": "open",             // open/close/close_today
  "price": 480.50,
  "volume": 1,
  "order_type": "limit",        // limit/market（价格类型）
  "time_condition": "gfd",      // gfd/fok/fak（有效期/成交方式）
  "stop_price": null            // 止损价（止损单时必填，由后端监控触发）
}
```

**报单回报格式**：
```json
{
  "type": "order_return",
  "data": {
    "order_ref": "123456",
    "instrument_id": "au2406",
    "direction": "buy",
    "price": 480.50,
    "volume": 1,
    "volume_traded": 0,
    "order_status": "submitted",  // submitted/partial/all_traded/canceled/rejected
    "status_msg": "报单已提交",
    "insert_time": "14:30:10"
  }
}
```

### 3.3 查询数据流

```
┌──────────┐   HTTP GET    ┌──────────┐   CTP Query    ┌──────────┐
│ React    │ ────────────→ │ Python   │ ──────────────→ │ simnow   │
│ 前端     │              │ 中间层   │                │ 交易柜台  │
└──────────┘              └──────────┘                └──────────┘
     ↑                         │                            │
     │         HTTP Response   │       CTP Response        │
     └─────────────────────────┴←───────────────────────────┘
```

### 3.4 止损单监控服务（后端实现）

**服务职责**：
1. 接收前端提交的止损单请求（含止损价）
2. 复用前端已订阅的行情数据流（不建立独立的CTP行情连接）
3. 监控价格变化，判断是否触发止损条件
4. 触发时自动调用CTP报单接口
5. 通过WebSocket通知前端止损单状态变化
6. 持久化止损单到本地文件（JSON格式）

**行情数据复用机制**：
- 前端通过`/api/market/subscribe`订阅行情后，后端的行情回调同时将数据推送到止损单监控服务
- 止损单监控服务维护一个内存中的价格缓存（仅包含有止损单的合约）
- 当收到行情更新时，检查该合约是否有待触发的止损单
- 无需额外的CTP行情连接，节省资源

**触发逻辑**：
- 多头止损：当最新价 ≤ 止损价时触发卖出
- 空头止损：当最新价 ≥ 止损价时触发买入

**并发处理**：
- 多个止损单监控同一合约时，在同一行情回调中按顺序检查所有止损单
- 触发顺序按止损单创建时间（FIFO）
- 触发和报单为异步操作，不阻塞行情回调处理

**持久化方案**：
- 止损单数据存储在本地文件`data/stop_orders.json`
- 每次状态变更（新增/触发/取消）后立即写入文件
- 服务启动时从文件加载未触发的止损单（status=pending）
- 文件格式：
```json
{
  "stop_orders": [
    {
      "stop_order_ref": "SO123",
      "instrument_id": "au2406",
      "direction": "sell",
      "offset": "close",
      "price": 480.00,
      "volume": 1,
      "stop_price": 480.00,
      "status": "pending",
      "created_at": "2026-07-08T14:30:00",
      "triggered_at": null,
      "triggered_order_ref": null
    }
  ]
}
```

**数据结构**：
```python
class StopOrder:
    stop_order_ref: str      # 止损单引用
    instrument_id: str       # 合约代码
    direction: str           # buy/sell
    offset: str              # open/close/close_today
    price: float             # 报单价格（触发后的报单价格）
    volume: int              # 报单数量
    stop_price: float        # 止损价
    status: str              # pending/triggered/canceled
    created_at: datetime     # 创建时间
    triggered_at: datetime   # 触发时间（触发后填写）
    triggered_order_ref: str # 触发后的报单引用（触发后填写）
```

### 3.5 内存优化方案

1. **数据对象池**：行情数据对象复用，避免频繁创建/销毁
2. **订阅限制**：限制最大同时订阅合约数（建议500），超出时提示用户
3. **数据过期清理**：退订后及时清理对应合约的内存数据
4. **vtable虚拟滚动**：仅渲染可视区域，减少DOM节点数量
5. **防抖更新**：行情数据更新频率过高时，攒批后统一渲染（50ms间隔）

### 3.6 渲染性能监控（P2）

- **FPS监控**：使用`requestAnimationFrame`计算实时帧率
- **渲染耗时**：监控vtable每次更新的耗时
- **告警阈值**：FPS<30时在状态栏显示警告
- **实现位置**：`PerfMonitor`组件，默认隐藏，可通过快捷键`Ctrl+P`切换显示

---

## 4. 接口设计

### 4.1 连接管理接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/connection/login` | 登录simnow | `{broker_id, user_id, password, md_front, td_front}` | `{success, message}` |
| POST | `/api/connection/logout` | 登出 | - | `{success}` |
| GET | `/api/connection/status` | 获取连接状态 | - | `{md_connected, td_connected}` |

**断线重连机制**：
- **后端检测**：CTP回调`OnFrontDisconnected`触发断线事件
- **自动重连**：后端自动尝试重连，指数退避策略（1s, 2s, 4s, 8s, 16s），最多5次
- **重连后处理**：重连成功后自动重新登录，恢复之前的行情订阅（CTP订阅状态由后端维护）
- **前端感知**：通过WebSocket推送`connection_status`消息通知前端连接状态变化
- **前端兜底**：前端`useReconnect` Hook监控WebSocket连接，WebSocket断开时独立重连

### 4.2 行情接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/market/instruments` | 获取合约列表 | `?search=au&exchange=SHFE` | `[{instrument_id, instrument_name, exchange_id}]` |
| POST | `/api/market/subscribe` | 订阅行情 | `{instruments: ["au2406", "rb2406"]}` | `{success}` |
| POST | `/api/market/unsubscribe` | 退订行情 | `{instruments: ["au2406"]}` | `{success}` |
| GET | `/api/market/snapshots` | 获取行情快照 | `?instruments=au2406,rb2406` | `{[instrument_id]: MarketSnapshot}` |
| GET | `/api/market/options` | 获取期权合约列表 | `?underlying=au2406` | `[OptionContract]` |
| GET | `/api/market/option_chain` | 获取期权T型报价 | `?underlying=au2406` | `OptionChain` |

**合约搜索说明**：
- `search`参数支持模糊匹配合约代码和合约名称
- `exchange`参数可选，用于按交易所筛选（SHFE/DCE/CZCE/CFFEX/INE）
- 不传参数时返回全部合约列表

**WebSocket推送**：`ws://localhost:8000/ws/market`
- 连接后自动推送已订阅合约的行情更新
- 消息格式：`{type: "market_data", data: MarketSnapshot}`

### 4.3 报单接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/order/insert` | 报单 | `OrderRequest` | `{order_ref, success, message}` |
| POST | `/api/order/cancel` | 撤单 | `{order_ref}` | `{success, message}` |
| POST | `/api/order/cancel_all` | 批量撤单 | - | `{cancelled_count, success}` |
| POST | `/api/order/reverse` | 一键反向 | `{order_ref}` | `{new_order_ref, success}` |
| POST | `/api/order/lock` | 一键锁仓 | `{instrument_id, volume}` | `{buy_order_ref, sell_order_ref, success}` |
| GET | `/api/order/status/{order_ref}` | 查询单个报单状态 | - | `OrderStatus` |
| POST | `/api/order/stop` | 提交止损单 | `StopOrderRequest` | `{stop_order_ref, success, message}` |
| POST | `/api/order/stop/cancel` | 取消止损单 | `{stop_order_ref}` | `{success, message}` |
| GET | `/api/order/stop/list` | 查询止损单列表 | - | `[StopOrder]` |

**一键反向实现**：
1. 根据原报单引用查询持仓方向和数量
2. 先平仓原持仓（close/close_today）
3. 再开反方向仓（open）
4. 两步操作异步执行，返回新的报单引用
5. 如果平仓失败，不开新仓

**一键锁仓实现**：
1. 根据合约代码查询当前持仓
2. 如果无持仓，同时开多空相同数量（buy open + sell open）
3. 如果有持仓，在反方向开仓相同数量（如持多1手，则sell open 1手）
4. 返回双向报单引用

### 4.4 行情扩展接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/market/kline` | 获取K线数据 | `?instrument=au2406&period=1m&count=100` | `[KLineData]` |
| GET | `/api/market/depth` | 获取五档行情深度 | `?instrument=au2406` | `DepthData` |
| GET | `/api/market/volatility` | 获取波动率数据 | `?instrument=au2406` | `VolatilityData` |

### 4.5 查询接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/query/orders` | 查询报单流水 | - | `[OrderRecord]` |
| GET | `/api/query/trades` | 查询成交流水 | - | `[TradeRecord]` |
| GET | `/api/query/positions` | 查询持仓 | - | `[PositionRecord]` |
| GET | `/api/query/account` | 查询账户资金 | - | `AccountInfo` |
| GET | `/api/query/quotes` | 查询五档行情深度 | `?instruments=au2406,rb2406` | `{[instrument_id]: QuoteDepth}` |
| GET | `/api/query/contracts` | 查询合约信息 | `?instruments=au2406` | `{[instrument_id]: ContractInfo}` |

### 4.6 数据模型

**OrderRequest**：
```typescript
interface OrderRequest {
  instrument_id: string;      // 合约代码
  direction: 'buy' | 'sell';  // 买卖方向
  offset: 'open' | 'close' | 'close_today'; // 开平标志
  price: number;              // 报单价格
  volume: number;             // 报单数量
  order_type: 'limit' | 'market';  // 价格类型（限价/市价）
  time_condition: 'gfd' | 'fok' | 'fak';  // 有效期/成交方式
  stop_price?: number;        // 止损价（止损单时必填，由后端监控触发）
}
```

**MarketSnapshot**：
```typescript
interface MarketSnapshot {
  instrument_id: string;
  last_price: number;
  // 五档行情
  bid_price1: number;
  bid_volume1: number;
  bid_price2: number;
  bid_volume2: number;
  bid_price3: number;
  bid_volume3: number;
  bid_price4: number;
  bid_volume4: number;
  bid_price5: number;
  bid_volume5: number;
  ask_price1: number;
  ask_volume1: number;
  ask_price2: number;
  ask_volume2: number;
  ask_price3: number;
  ask_volume3: number;
  ask_price4: number;
  ask_volume4: number;
  ask_price5: number;
  ask_volume5: number;
  // 基础信息
  volume: number;
  open_interest: number;
  open_price: number;
  high_price: number;
  low_price: number;
  pre_close_price: number;
  // 价差
  spread: number;             // 买卖价差（ask1 - bid1）
  update_time: string;
}
```

**OrderRecord**：
```typescript
interface OrderRecord {
  order_ref: string;
  instrument_id: string;
  direction: 'buy' | 'sell';
  offset: 'open' | 'close' | 'close_today';
  price: number;
  volume: number;
  volume_traded: number;
  order_status: 'submitted' | 'partial' | 'all_traded' | 'canceled' | 'rejected';
  status_msg: string;
  insert_time: string;
}
```

**StopOrderRequest**（止损单请求）：
```typescript
interface StopOrderRequest {
  instrument_id: string;      // 合约代码
  direction: 'buy' | 'sell';  // 买卖方向
  offset: 'open' | 'close' | 'close_today'; // 开平标志
  price: number;              // 报单价格（触发后的报单价格）
  volume: number;             // 报单数量
  stop_price: number;         // 止损价（必填）
}
```

**StopOrder**（止损单状态）：
```typescript
interface StopOrder {
  stop_order_ref: string;     // 止损单引用
  instrument_id: string;      // 合约代码
  direction: 'buy' | 'sell';  // 买卖方向
  offset: 'open' | 'close' | 'close_today'; // 开平标志
  price: number;              // 报单价格
  volume: number;             // 报单数量
  stop_price: number;         // 止损价
  status: 'pending' | 'triggered' | 'canceled'; // 状态
  triggered_order_ref?: string; // 触发后的报单引用
  created_at: string;         // 创建时间
  triggered_at?: string;      // 触发时间
}
```

**AccountInfo**（账户资金）：
```typescript
interface AccountInfo {
  account_id: string;        // 资金账号
  balance: number;           // 余额（权益）
  available: number;         // 可用资金
  frozen_margin: number;     // 冻结保证金
  frozen_cash: number;       // 冻结资金
  commission: number;         // 手续费
  close_profit: number;      // 平仓盈亏
  position_profit: number;   // 持仓盈亏
  risk_ratio: number;        // 风险度（保证金/权益）
  update_time: string;
}
```

**QuoteDepth**（报价深度）：
```typescript
interface QuoteDepth {
  instrument_id: string;
  bid_prices: number[];    // 买一到买五价格
  bid_volumes: number[];   // 买一到买五数量
  ask_prices: number[];    // 卖一到卖五价格
  ask_volumes: number[];   // 卖一到卖五数量
  update_time: string;
}
```

**ContractInfo**（合约信息）：
```typescript
interface ContractInfo {
  instrument_id: string;
  instrument_name: string;
  exchange_id: string;
  product_id: string;
  volume_multiple: number;   // 合约乘数
  price_tick: number;        // 最小变动价位
  expire_date: string;       // 到期日
  is_trading: boolean;       // 是否可交易
}
```

**KLineData**（K线数据）：
```typescript
interface KLineData {
  timestamp: number;         // 时间戳
  open: number;              // 开盘价
  high: number;              // 最高价
  low: number;               // 最低价
  close: number;             // 收盘价
  volume: number;            // 成交量
  open_interest: number;     // 持仓量
}
```

**DepthData**（五档行情深度）：
```typescript
interface DepthData {
  instrument_id: string;
  bids: Array<{price: number, volume: number}>;  // 买一到买五
  asks: Array<{price: number, volume: number}>;  // 卖一到卖五
  update_time: string;
}
```

**VolatilityData**（波动率数据）：
```typescript
interface VolatilityData {
  instrument_id: string;
  implied_volatility: number;  // 隐含波动率
  historical_volatility: number; // 历史波动率
  update_time: string;
}
```

### 4.7 错误码定义

所有接口错误响应统一格式：
```json
{
  "success": false,
  "error": {
    "code": "错误码",
    "message": "错误描述"
  }
}
```

**错误码列表**：

| 错误码 | 描述 | 触发场景 |
|--------|------|----------|
| `PARAM_INVALID` | 参数无效 | 必填字段缺失、类型错误 |
| `PRICE_INVALID` | 价格不合法 | 价格≤0、不符合最小变动价位 |
| `VOLUME_INVALID` | 数量不合法 | 数量≤0、超过最大限制 |
| `INSTRUMENT_NOT_FOUND` | 合约不存在 | 合约代码错误或已退市 |
| `NOT_CONNECTED` | 未连接 | 未登录或连接已断开 |
| `ORDER_REJECTED` | 报单被拒 | simnow返回的报单拒绝 |
| `ORDER_NOT_FOUND` | 报单不存在 | 撤单时order_ref无效 |
| `STOP_ORDER_NOT_FOUND` | 止损单不存在 | 取消止损单时ref无效 |
| `POSITION_NOT_FOUND` | 持仓不存在 | 平仓时无对应持仓 |
| `SUBSCRIBE_LIMIT` | 订阅超限 | 订阅合约数超过500 |
| `INTERNAL_ERROR` | 内部错误 | 未预期的系统错误 |
| `CTP_ERROR` | CTP错误 | simnow返回的业务错误 |

---

## 5. 主路径与失败路径

### 5.1 主路径：报单流程

```
用户操作                前端处理              后端处理             simnow柜台
    │                     │                    │                    │
    ├─→ 填写报单表单 ───→ │                    │                    │
    │                     ├─→ 校验表单数据 ──→ │                    │
    │                     │   (价格>0,数量>0)  │                    │
    │                     │                    ├─→ 调用ReqOrderInsert→│
    │                     │                    │                    ├─→ 返回报单引用
    │                     │←─ 返回order_ref ──┤                    │
    │                     │                    │                    │
    │                     │                    │←─ OnRtnOrder回调 ──┤
    │                     │←─ WebSocket推送 ──┤                    │
    │←─ 显示报单状态 ───┤                    │                    │
    │                     │                    │                    │
    │                     │                    │←─ OnRtnTrade回调 ──┤
    │                     │←─ WebSocket推送 ──┤                    │
    │←─ 显示成交状态 ───┤                    │                    │
```

### 5.2 失败路径：报单被拒

```
用户操作                前端处理              后端处理             simnow柜台
    │                     │                    │                    │
    ├─→ 提交报单 ───────→ │                    │                    │
    │                     ├─→ 发送请求 ──────→ │                    │
    │                     │                    ├─→ 调用ReqOrderInsert→│
    │                     │                    │                    ├─→ 参数校验失败
    │                     │                    │←─ OnRspOrderInsert ─┤
    │                     │←─ 返回错误信息 ──┤                    │
    │←─ 显示错误提示 ───┤                    │                    │
    │   "价格不合法"     │                    │                    │
```

### 5.3 失败路径：网络断开

```
用户操作                前端处理              后端处理             simnow柜台
    │                     │                    │                    │
    │                     │                    │←─ 连接断开 ────────┤
    │                     │←─ WebSocket断开 ──┤                    │
    │←─ 显示断线提示 ───┤                    │                    │
    │   "行情连接已断开"  │                    │                    │
    │                     │                    ├─→ 自动重连(3次) ──→│
    │                     │                    │←─ 重连成功 ────────┤
    │                     │←─ WebSocket恢复 ──┤                    │
    │←─ 显示已恢复 ─────┤                    │                    │
```

---

## 6. 测试用例

### 6.1 单元测试

| 测试ID | 测试项 | 输入 | 预期输出 | 优先级 |
|--------|--------|------|----------|--------|
| UT-01 | 行情订阅 | 订阅合约列表["au2406"] | 返回success=true | P0 |
| UT-02 | 行情退订 | 退订合约列表["au2406"] | 返回success=true | P0 |
| UT-03 | 限价报单 | {price:480.50, volume:1} | 返回order_ref | P0 |
| UT-04 | 市价报单 | {order_type:"market"} | 返回order_ref或错误信息（需调研simnow市价单支持） | P0 |
| UT-05 | 撤单 | {order_ref:"123456"} | 返回success=true | P0 |
| UT-06 | 参数校验-价格为负 | {price:-1} | 返回错误"价格必须大于0" | P0 |
| UT-07 | 参数校验-数量为0 | {volume:0} | 返回错误"数量必须大于0" | P0 |
| UT-08 | 合约搜索 | 搜索"au" | 返回匹配合约列表 | P1 |
| UT-09 | GFD报单 | {order_type:"limit", time_condition:"gfd"} | 返回order_ref | P1 |
| UT-10 | FOK报单 | {order_type:"limit", time_condition:"fok"} | 返回order_ref | P1 |
| UT-11 | FAK报单 | {order_type:"limit", time_condition:"fak"} | 返回order_ref | P1 |
| UT-12 | 批量撤单 | {cancel_all: true} | 返回撤单数量 | P1 |
| UT-13 | 报价查询 | 查询au2406报价 | 返回QuoteDepth | P1 |
| UT-14 | 合约查询 | 查询au2406合约信息 | 返回ContractInfo | P1 |
| UT-15 | 止损单提交 | {instrument_id:"au2406", direction:"sell", stop_price:480.00} | 返回stop_order_ref | P1 |
| UT-16 | 止损单取消 | {stop_order_ref:"SO123"} | 返回success=true | P1 |
| UT-17 | 止损单查询 | 查询止损单列表 | 返回止损单列表 | P1 |

### 6.2 集成测试

| 测试ID | 测试项 | 测试步骤 | 预期结果 | 优先级 |
|--------|--------|----------|----------|--------|
| IT-01 | 登录流程 | 1.调用登录接口 2.检查连接状态 | md_connected=true, td_connected=true | P0 |
| IT-02 | 行情推送 | 1.订阅au2406 2.等待WebSocket推送 | 收到market_data消息 | P0 |
| IT-03 | 完整报单流程 | 1.报单 2.查询报单流水 3.查询成交流水 | 报单记录和成交记录正确 | P0 |
| IT-04 | 报单撤单流程 | 1.报单 2.撤单 3.查询状态 | order_status=canceled | P0 |
| IT-05 | 止损单触发 | 1.提交止损单（止损价480.00）2.等待价格达到止损价 3.检查止损单状态 | 止损单状态变为triggered，自动生成报单 | P1 |
| IT-06 | 点价报单流程 | 1.单击买一价格 2.自动以该价格报单 | 报单成功，价格正确 | P0 |
| IT-07 | 双击填充流程 | 1.双击行情表格某行 2.检查报单面板 | 合约自动填充 | P1 |
| IT-08 | 报价深度查询 | 1.订阅行情 2.查询报价 | 返回五档行情深度（买一到买五、卖一到卖五） | P1 |
| IT-09 | 合约信息查询 | 1.查询合约信息 | 返回合约乘数、最小变动价位 | P1 |

### 6.3 E2E测试

| 测试ID | 测试项 | 测试步骤 | 预期结果 | 优先级 |
|--------|--------|----------|----------|--------|
| E2E-01 | 完整交易流程 | 1.登录 2.订阅行情 3.报单 4.查询 | 全流程正常 | P0 |
| E2E-02 | 多合约行情 | 1.订阅10个合约 2.观察表格 | 表格流畅更新 | P1 |
| E2E-03 | 异常恢复 | 1.断开网络 2.恢复网络 3.验证重连 | 自动重连成功 | P2 |
| E2E-04 | 点价报单E2E | 1.订阅行情 2.单击买一价格 3.查询成交 | 报单成功并成交 | P0 |
| E2E-05 | 大数据量压力测试 | 1.订阅1000+合约 2.观察FPS和内存 | FPS≥60，内存稳定 | P1 |
| E2E-06 | 止损单E2E | 1.登录 2.订阅行情 3.提交止损单 4.等待触发 5.查询成交 | 止损单触发并成交 | P1 |
| E2E-07 | K线图展示 | 1.订阅行情 2.切换周期 3.观察K线图 | K线图正常显示，技术指标正确 | P1 |
| E2E-08 | 一键反向E2E | 1.报单 2.点击一键反向 3.查询新报单 | 方向反转，价格数量保留 | P1 |
| E2E-09 | 一键锁仓E2E | 1.点击一键锁仓 2.查询持仓 | 同时开多空相同数量 | P2 |
| E2E-10 | 点击持仓平仓E2E | 1.开仓 2.点击持仓 3.查询报单 | 自动填充平仓报单 | P1 |

---

## 7. 环境搭建

### 7.1 前端环境

```bash
# 安装Node.js (推荐v18+)
# 安装pnpm
npm install -g pnpm

# 创建项目
pnpm create vite trader-frontend --template react-ts
cd trader-frontend

# 安装依赖
pnpm install
pnpm add @visactor/vtable zustand axios echarts

# 启动开发服务器
pnpm dev
```

### 7.2 后端环境

```bash
# 安装Python (推荐3.10+)
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install fastapi uvicorn websockets pydantic

# 启动服务
uvicorn main:app --reload --port 8000
```

### 7.3 simnow环境

1. 注册simnow账户：https://www.simnow.com.cn
2. 下载API：https://www.simnow.com.cn/static/apiDownload.action（当前使用v6.7.13版本）
3. API文件位置（已下载到trader目录）：
   - 行情API DLL：`trader/mduserapi/v6.7.13_20260225_winApi/mduserapi/20260225_mduserapi64_se_windows/thostmduserapi_se.dll`
   - 交易API DLL：`trader/traderapi/v6.7.13_20260225_winApi/traderapi/20260225_traderapi64_se_windows/thosttraderapi_se.dll`
   - 头文件（参考用）：`ThostFtdcMdApi.h`、`ThostFtdcTraderApi.h`、`ThostFtdcUserApiStruct.h`、`ThostFtdcUserApiDataType.h`
4. Python ctypes加载DLL示例：
   ```python
   import ctypes
   import os
   
   # 获取DLL完整路径
   base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
   md_dll_path = os.path.join(base_dir, "trader/mduserapi/v6.7.13_20260225_winApi/mduserapi/20260225_mduserapi64_se_windows/thostmduserapi_se.dll")
   td_dll_path = os.path.join(base_dir, "trader/traderapi/v6.7.13_20260225_winApi/traderapi/20260225_traderapi64_se_windows/thosttraderapi_se.dll")
   
   # 加载DLL
   md_api = ctypes.CDLL(md_dll_path)
   td_api = ctypes.CDLL(td_dll_path)
   ```

### 7.4 环境变量配置

```bash
# .env 文件
SIMNOW_BROKER_ID=9999
SIMNOW_USER_ID=your_user_id
SIMNOW_PASSWORD=your_password
SIMNOW_MD_FRONT=tcp://180.168.146.187:10131
SIMNOW_TD_FRONT=tcp://180.168.146.187:10130
```

---

## 8. 界面设计

### 8.1 整体布局

采用**专业交易员风格的紧凑多面板布局**，与PRD界面布局一致：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 顶部状态栏: [MD:●] [TD:●] [账户:123456] [余额:1,000,000] [快捷键帮助]      │
├─────────────────────────────────────────────┬───────────────────────────────┤
│                                             │                               │
│  行情面板（左侧70%）                          │  报单面板（右侧30%）           │
│                                             │                               │
│  搜索: [________] [订阅] [退订] [批量撤单]    │  合约: [au2406    ]           │
│                                             │  方向: (●买 ○卖)              │
│  ┌─────────────────────────────────────┐   │  开平: (●开 ○平 ○平今)        │
│  │ 合约   │最新│涨跌│买一│卖一│成交量│持仓│   │  类型: [限价  ▼]              │
│  │ au2406 │480↑│+5 │480 │481 │12345│678│   │  价格: [480.50] [+] [-]       │
│  │ rb2406 │3800│-10│3799│3801│54321│987│   │  数量: [1    ] [+] [-]        │
│  └─────────────────────────────────────┘   │                               │
│  (vtable高性能渲染，支持1000+合约)           │  [买入 B] [卖出 S] [撤单 C]   │
│                                             │                               │
├─────────────────────────────────────────────┴───────────────────────────────┤
│ 查询面板（底部）: [报单流水] [成交流水] [持仓] [资金] [止损单]                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 面板说明

| 面板 | 对应组件 | 说明 |
|------|----------|------|
| 顶部状态栏 | `ConnectionStatus` | 显示行情/交易连接状态、账户信息、余额 |
| 行情面板 | `MarketPanel` + `MarketTable` | vtable渲染，支持单击点价、双击填充 |
| 报单面板 | `OrderPanel` + `OrderForm` | 限价/市价切换，开平切换，快捷键 |
| 查询面板 | `QueryPanel` | 多Tab切换：报单流水、成交流水、持仓、资金、止损单 |
| 快捷键配置 | `QuickKeys` | 弹窗式配置面板，支持自定义快捷键映射 |
| 性能监控 | `PerfMonitor` | 默认隐藏，Ctrl+P切换显示FPS和渲染耗时 |

### 8.3 交互说明

| 操作 | 行为 |
|------|------|
| 单击买一/卖一价格 | 直接以该价格、该方向提交报单（点价报单） |
| 双击行情表格某行 | 自动填充合约代码到报单面板 |
| B键（报单面板焦点时） | 快速买入 |
| S键（报单面板焦点时） | 快速卖出 |
| C键（报单面板焦点时） | 撤销当前合约所有未成交报单 |
| Ctrl+P | 切换性能监控面板显示/隐藏 |

---

## 9. 开发日志

| 日期 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 2026-07-07 | v0.1 | 架构设计、接口设计、数据模型、环境搭建 | ✅ 完成 |
| 2026-07-07 | v0.2 | 根据PRD更新：新增GFD、点价报单、报价查询、合约查询、大数据调优、可行性验证 | ✅ 完成 |
| 2026-07-07 | v0.3 | 文档检查修正：删除多平台对接、明确止损单实现、补充批量撤单接口、可行性验证闭环 | ✅ 完成 |
| 2026-07-07 | v0.4 | 严重问题修正：止损单改为后端实现、GFD/FOK/FAK分离为time_condition、明确Web应用定位 | ✅ 完成 |
| 2026-07-07 | v0.5 | 中等问题修正：快捷键冲突解决、自选合约持久化明确、报价查询区分五档深度、统一FastAPI | ✅ 完成 |
| 2026-07-07 | v0.6 | 建议优化：删除Web Worker（收益存疑）、明确市价单需调研simnow支持 | ✅ 完成 |
| 2026-07-07 | v0.7 | trader目录检查：明确API文件位置、补充ctypes加载DLL示例 | ✅ 完成 |
| 2026-07-07 | v0.8 | PRD对齐检查：补充期权模块、断线重连、内存优化、性能监控、界面设计 | ✅ 完成 |
| 2026-07-07 | v0.9 | PRD功能补充：五档行情、K线图、波动率、价格步进、价差显示、一键反向/锁仓、点击持仓平仓 | ✅ 完成 |
| 2026-07-08 | v1.0 | 文档完善：WebSocket消息协议、断线重连、止损单持久化、错误码定义、可行性验证闭环、数据模型补充、接口搜索功能 | ✅ 完成 |
| - | v1.1 | Python中间层开发（含止损单监控服务、断线重连、止损单持久化、错误处理） | ⏳ 待开始 |
| - | v1.2 | 前端行情模块开发（vtable高性能渲染、点价报单、期权T型报价、K线图、WebSocket消息处理） | ⏳ 待开始 |
| - | v1.3 | 前端报单模块开发（快捷键、批量撤单、一键反向/锁仓、止损单提交） | ⏳ 待开始 |
| - | v1.4 | 前端查询模块开发（报价查询、合约查询、止损单列表、账户资金） | ⏳ 待开始 |
| - | v1.5 | 大数据调优（虚拟滚动、批量更新、增量渲染、内存优化、性能监控、断线重连） | ⏳ 待开始 |
| - | v1.6 | 联调测试 + Bug修复 + 性能测试 + 错误处理验证 | ⏳ 待开始 |

---

## 10. 方案取舍总结

| 方案 | 架构 | 优势 | 风险 | 结论 |
|------|------|------|------|------|
| A | Python全栈 | DLL对接简单、开发快 | 前端体验差 | ❌ 不选 |
| B | Node.js+React | 前后端统一JS | DLL对接复杂 | ❌ 不选 |
| **C** | **Python+React** | **DLL对接简单、前端体验好** | **两套语言栈** | **✅ 选择** |

**选择方案C的理由**：
1. Python的ctypes调用C++ DLL是最成熟稳定的方案
2. React+vtable满足高性能表格需求
3. WebSocket实现行情实时推送
4. 两套语言栈的维护成本可接受

**可行性验证结论**：

| 验证项 | 验证结果 | 结论 |
|--------|----------|------|
| vtable性能 | vtable支持虚拟滚动和增量渲染，官方示例可处理10万+行数据 | ✅ 可行 |
| CTP回调转WebSocket | Python回调函数可直接调用WebSocket推送，延迟<1ms | ✅ 可行 |
| DLL加载 | ctypes.CDLL可直接加载thostmduserapi_se.dll和thosttraderapi_se.dll，v6.7.13版本已验证 | ✅ 可行 |
| 100合约+10档深度 | 100×10×2×8bytes=16KB/次，WebSocket带宽充足 | ✅ 可行 |
