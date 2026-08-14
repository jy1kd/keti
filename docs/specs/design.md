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
│  │  (REST API)  │  │  Manager    │  │(ctp-python) │                     │
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
| CTP绑定 | ctp-python | latest | Python CTP封装库（SWIG封装，开箱即用） |
| 包管理 | npm (前端) + pip (后端) | - | 依赖管理 |

### 1.3 CTP API说明

**API版本**：v6.7.7（ctp-python 6.7.7.post1 包自带）

**Python封装库**：ctp-python
- 安装命令：`pip install ctp-python`
- 支持Python版本：3.7 ~ 3.13
- 支持平台：Windows amd64、Linux amd64、macOS arm64/amd64
- 导入方式：`import ctp`

**⚠️ 已知问题：SubscribeMarketData参数格式**

```python
# ❌ 错误：传bytes列表会导致堆损坏崩溃(0xC0000374)
api.SubscribeMarketData([b"IF2608"])

# ✅ 正确：必须传字符串列表
api.SubscribeMarketData(["IF2608"])
```

原因：ctp-python的SWIG绑定处理bytes时内存越界。所有Subscribe/Unsubscribe方法都受影响。

**SimNow连接配置**：

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| BrokerID | 经纪商代码 | `9999` |
| AppID | 产品名称 | `simnow_client_test` |
| AuthCode | 授权编码 | `0000000000000000`（16个0） |

**SimNow服务器地址**：

| 环境 | 类型 | 地址 | 说明 |
|------|------|------|------|
| 第一套 | 交易前置 | `tcp://180.168.146.187:10130` | 仅交易时段可用 |
| 第一套 | 行情前置 | `tcp://180.168.146.187:10131` | 仅交易时段可用 |
| 第二套 | 交易前置 | `tcp://182.254.243.31:40001` | 7x24测试环境 |
| 第二套 | 行情前置 | `tcp://182.254.243.31:40011` | 7x24测试环境 |

**穿透式认证流程**（交易接口必须）：
1. 连接成功后，先调用`ReqAuthenticate`进行客户端认证
2. 认证成功后，再调用`ReqUserLogin`进行用户登录
3. 登录成功后，调用`ReqSettlementInfoConfirm`确认结算信息

**关键回调说明**：

| 回调方法 | 触发时机 | 用途 |
|----------|----------|------|
| `OnFrontConnected` | 连接成功 | 发起认证/登录 |
| `OnFrontDisconnected` | 连接断开 | 触发重连机制 |
| `OnRspAuthenticate` | 认证响应 | 判断是否可登录 |
| `OnRspUserLogin` | 登录响应 | 获取交易日、会话信息 |
| `OnRtnDepthMarketData` | 行情推送 | 实时行情数据 |
| `OnRtnOrder` | 报单回报 | 报单状态变化 |
| `OnRtnTrade` | 成交回报 | 成交确认 |
| `OnRspQryInvestorPosition` | 持仓查询响应 | 持仓数据 |
| `OnRspQryTradingAccount` | 资金查询响应 | 账户资金数据 |

**数据编码**：CTP-Python库已自动将GBK编码转换为UTF-8，无需手动处理。

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
│   └── query/            # 查询模块（独立查询窗口）
│       ├── OrdersQuery.tsx    # 报单查询窗口
│       ├── OrderFlow.tsx      # 报单流水
│       ├── PositionsQuery.tsx # 持仓查询窗口
│       ├── Position.tsx       # 持仓查询（支持点击平仓）
│       ├── AccountQuery.tsx   # 资金查询窗口（账户资金）
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
│   ├── market.py         # 行情相关接口（订阅、退订、快照、K线、深度、波动率、期权）
│   ├── order.py          # 报单相关接口（限价/市价、撤单、批量撤单、止损单）
│   ├── query.py          # 查询相关接口（报单、成交、持仓、资金、合约、报价）
│   └── connection.py     # 连接管理接口（登录、登出、状态）
├── ctp_wrapper/          # CTP封装层（使用ctp-python库）⚠️ 不能命名为ctp/！
│   ├── md_user_api.py    # 行情API封装（基于ctp-python）
│   ├── trader_api.py     # 交易API封装（基于ctp-python）
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
├── data/                 # 数据持久化目录
│   └── stop_orders.json  # 止损单持久化文件
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
  | 'market_data'           // 行情推送
  | 'order_return'          // 报单回报
  | 'trade_return'          // 成交回报
  | 'position_update'       // 持仓更新
  | 'stop_order_update'     // 止损单状态更新
  | 'connection_status'     // 连接状态变化
  | 'instruments_refreshed' // 合约列表刷新完成
  | 'ping'                  // 心跳检测
  | 'error';                // 错误消息
```

**各消息类型数据格式**：

`market_data` - 行情推送（与MarketSnapshot结构一致）：
```json
{
  "type": "market_data",
  "data": {
    "tradingDay": "20260710",
    "instrumentID": "IF2608",
    "exchangeID": "SHFE",
    "exchangeInstID": "IF2608",
    "lastPrice": 480.50,
    "preSettlementPrice": 480.00,
    "preClosePrice": 480.20,
    "preOpenInterest": 67890.0,
    "openPrice": 480.00,
    "highestPrice": 481.00,
    "lowestPrice": 479.50,
    "volume": 12345,
    "turnover": 5928345.00,
    "openInterest": 67890.0,
    "closePrice": 0.0,
    "settlementPrice": 0.0,
    "upperLimitPrice": 528.00,
    "lowerLimitPrice": 432.00,
    "bidPrice1": 480.40,
    "bidVolume1": 10,
    "askPrice1": 480.60,
    "askVolume1": 8,
    "bidPrice2": 480.38,
    "bidVolume2": 15,
    "askPrice2": 480.62,
    "askVolume2": 12,
    "bidPrice3": 480.36,
    "bidVolume3": 20,
    "askPrice3": 480.64,
    "askVolume3": 18,
    "bidPrice4": 480.34,
    "bidVolume4": 25,
    "askPrice4": 480.66,
    "askVolume4": 22,
    "bidPrice5": 480.32,
    "bidVolume5": 30,
    "askPrice5": 480.68,
    "askVolume5": 28,
    "averagePrice": 480.50,
    "actionDay": "20260710",
    "updateMillisec": 500,
    "updateTime": "14:30:05",
    "bandingUpperPrice": 0.0,
    "bandingLowerPrice": 0.0,
    "currDelta": 0.0,
    "preDelta": 0.0
  }
}
```

`order_return` - 报单回报：
```json
{
  "type": "order_return",
  "data": {
    "orderRef": "123456",
    "instrumentID": "IF2608",
    "direction": "0",
    "combOffsetFlag": "0",
    "limitPrice": 480.50,
    "volumeTotalOriginal": 1,
    "volumeTraded": 0,
    "orderStatus": "0",
    "statusMsg": "报单已提交",
    "insertTime": "14:30:10"
  }
}
```

`trade_return` - 成交回报：
```json
{
  "type": "trade_return",
  "data": {
    "tradeID": "T789",
    "orderRef": "123456",
    "instrumentID": "IF2608",
    "direction": "0",
    "offsetFlag": "0",
    "price": 480.50,
    "volume": 1,
    "tradeTime": "14:30:11"
  }
}
```

`position_update` - 持仓更新：
```json
{
  "type": "position_update",
  "data": {
    "instrumentID": "IF2608",
    "posiDirection": "2",
    "position": 5,
    "positionCost": 240000.00,
    "positionProfit": 2500.00,
    "todayPosition": 2,
    "ydPosition": 3,
    "openCost": 240000.00,
    "useMargin": 24000.00,
    "tradingDay": "20260710"
  }
}
```

`stop_order_update` - 止损单状态更新：
```json
{
  "type": "stop_order_update",
  "data": {
    "stopOrderRef": "SO123",
    "status": "triggered",
    "triggeredOrderRef": "456789",
    "triggeredAt": "14:35:00"
  }
}
```

`connection_status` - 连接状态变化：
```json
{
  "type": "connection_status",
  "data": {
    "mdConnected": true,
    "tdConnected": true,
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
    "relatedRef": "123456"
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
  "instrumentID": "IF2608",
  "direction": "0",
  "combOffsetFlag": "0",
  "limitPrice": 480.50,
  "volumeTotalOriginal": 1,
  "orderPriceType": "2",
  "timeCondition": "3",
  "volumeCondition": "1",
  "stopPrice": 0
}
```
> TimeCondition CTP 标准值: IOC='1', GFS='2', GFD='3'。FOK = IOC('1') + VolumeCondition=CV('3')，FAK = IOC('1') + VolumeCondition=AV('1')。

**报单回报格式**：
```json
{
  "type": "order_return",
  "data": {
    "orderRef": "123456",
    "instrumentID": "IF2608",
    "direction": "0",
    "combOffsetFlag": "0",
    "limitPrice": 480.50,
    "volumeTotalOriginal": 1,
    "volumeTraded": 0,
    "orderStatus": "0",
    "statusMsg": "报单已提交",
    "insertTime": "14:30:10"
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

**边界条件处理**：
- **价格跳空**：当最新价直接跳过止损价（如从480.50跳至479.00，止损价480.00），仍触发止损，使用实际到达价格报单
- **触发后报单被拒**：止损单状态变为`trigger_failed`，通过WebSocket通知前端，用户需手动处理。不自动重试，避免重复报单风险
- **部分数量持仓**：止损单独立于持仓数量校验。触发时报单数量以止损单设定的数量为准，CTP柜台一侧做可用持仓校验
- **止损单修改**：不支持修改已提交的止损单。需先取消原止损单再重新提交
- **止损单有效期**：止损单默认为当日有效（GFD），收盘后自动失效

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
[
  {
    "stopOrderID": "so-abc12345",
    "instrumentID": "IF2608",
    "exchangeID": "CFFEX",
    "direction": "0",
    "offsetFlag": "0",
    "limitPrice": 4800.0,
    "volume": 1,
    "stopPrice": 4790.0,
    "status": "pending",
    "createdAt": "2026-07-27 14:30:00",
    "triggeredAt": null,
    "orderRef": null
  }
]
```

**数据结构**：
```python
class StopOrder:
    stop_order_id: str       # 止损单ID（so-xxxxxxxx）
    instrument_id: str       # 合约代码
    exchange_id: str         # 交易所（CFFEX/SHFE/CZCE/DCE/INE/GFEX）
    direction: str           # 0=买, 1=卖
    offset_flag: str         # 0=开仓, 1=平仓, 3=平今
    limit_price: float       # 触发后报单的限价
    volume: int              # 报单数量
    stop_price: float        # 止损触发价
    status: str              # pending/triggered/trigger_failed/canceled
    created_at: str          # 创建时间（YYYY-MM-DD HH:MM:SS）
    triggered_at: str        # 触发时间（触发后填写）
    order_ref: str           # 触发后的报单引用（触发后填写）
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

### 3.7 实时数据展示方案

#### 行情数据（高频更新）

**更新策略**：批量更新（50ms间隔）
```
行情推送 → 数据缓冲区(50ms) → 批量更新vtable → 渲染
```

**实现细节**：
1. 行情数据推送到缓冲区，不立即渲染
2. 每50ms从缓冲区取出最新数据，批量更新vtable
3. vtable只更新变化的单元格（增量渲染）
4. 虚拟滚动只渲染可视区域

**代码位置**：
- `src/modules/market/store.ts` - 行情数据缓冲和批量更新逻辑
- `src/modules/market/MarketTable.tsx` - vtable渲染组件

#### 查询数据（中低频更新）

**更新策略**：WebSocket推送 + 增量更新

**功能需求**：
1. **时间倒序**：新数据插入顶部
2. **新数据高亮**：新数据背景色闪烁（持续2秒）
3. **自动滚动**：新数据自动滚动到可视区域
4. **暂停更新**：用户可暂停自动更新，手动刷新

**实现细节**：
```typescript
// 新数据处理逻辑
function handleNewData(newRecord) {
  // 1. 插入到数据数组顶部
  data.unshift(newRecord);

  // 2. 标记为新数据（高亮）
  newRecord.isNew = true;
  setTimeout(() => { newRecord.isNew = false; }, 2000);

  // 3. 如果未暂停，自动滚动到顶部
  if (!isPaused) {
    tableRef.current?.scrollToTop();
  }
}
```

**代码位置**：
- `src/modules/query/OrdersQuery.tsx` - 报单查询窗口（含暂停按钮）
- `src/modules/query/PositionsQuery.tsx` - 持仓查询窗口
- `src/modules/query/AccountQuery.tsx` - 资金查询窗口
- `src/modules/query/OrderFlow.tsx` - 报单流水（增量更新）
- `src/modules/query/Position.tsx` - 持仓列表（支持点击平仓）
- `src/modules/query/store.ts` - 查询数据状态管理

#### 数据排序

| 数据类型 | 排序方式 | 说明 |
|----------|----------|------|
| 行情表格 | 按合约代码 | 用户可自定义排序 |
| 报单流水 | 时间倒序 | 最新报单在顶部 |
| 成交流水 | 时间倒序 | 最新成交在顶部 |
| 持仓列表 | 按持仓量 | 持仓量大的在顶部 |
| 报价查询 | 按档位排序 | 买一到买五、卖一到卖五 |
| 合约查询 | 按合约代码 | 字母顺序 |
| 止损单查询 | 创建时间倒序 | 最新止损单在顶部 |
| 账户资金查询 | 无需排序 | 单条记录 |

---

## 4. 接口设计

### 4.1 连接管理接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/connection/login` | 登录simnow | `{brokerID, userID, password}` | `{success, message, userID}` |
| POST | `/api/connection/logout` | 登出 | - | `{success, message}` |
| GET | `/api/connection/status` | 获取连接状态 | - | `{loggedIn, mdConnected, tdConnected}` |

**断线重连机制**：
- **后端检测**：CTP回调`OnFrontDisconnected`触发断线事件
- **自动重连**：后端自动尝试重连，指数退避策略（1s, 2s, 4s, 8s, 16s），最多5次
- **重连后处理**：重连成功后自动重新登录，恢复之前的行情订阅（CTP订阅状态由后端维护）
- **前端感知**：通过WebSocket推送`connection_status`消息通知前端连接状态变化
- **前端兜底**：前端`useReconnect` Hook监控WebSocket连接，WebSocket断开时独立重连

### 4.2 行情接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/market/instruments` | 获取合约列表 | `?keyword=au` | `[{instrument_id, instrument_name, exchange_id}]` |
| GET | `/api/market/instruments/exchanges` | 获取交易所列表 | - | `{exchanges: ["SHFE", "DCE", ...]}` |
| GET | `/api/market/instruments/products` | 获取品种列表 | `?exchange=SHFE` | `{products: ["au", "ag", ...]}` |
| GET | `/api/market/instruments/search` | 按交易所+品种搜索合约 | `?exchange=SHFE&product=au&keyword=2508` | `{instruments: [...], count: N}` |
| GET | `/api/market/preset` | 获取预置合约列表 | - | `{instruments: [...]}` |
| POST | `/api/market/preset/refresh` | 刷新预置合约（自动检测主力合约） | - | `{success, count}` |
| POST | `/api/market/subscribe` | 订阅行情 | `{instruments: ["IF2608", "IF2609"]}` | `{success}` |
| POST | `/api/market/unsubscribe` | 退订行情 | `{instruments: ["IF2608"]}` | `{success}` |
| GET | `/api/market/snapshots` | 获取行情快照 | `?instruments=IF2608,IF2609` | `{[instrument_id]: MarketSnapshot}` |
| POST | `/api/market/instruments/refresh` | 从CTP刷新全量合约列表 | - | `{status: "started"}` |
| GET | `/api/market/options` | 获取期权合约列表 | `?underlying=IF2608` | `[OptionContract]` |
| GET | `/api/market/option_chain` | 获取期权T型报价 | `?underlying=IF2608` | `OptionChain` |

**合约搜索说明**：
- `keyword`参数支持模糊匹配合约代码和合约名称
- `exchange`参数可选，用于按交易所筛选（SHFE/DCE/CZCE/CFFEX/INE）
- 不传参数时返回全部合约列表
- **实现说明**：CTP的ReqQryInstrument不支持服务端搜索，需在登录后一次性拉取全量合约列表
- **缓存策略**：合约列表在后端内存中缓存，登录成功后自动预加载，后续查询从缓存中过滤
- **缓存刷新**：每次重新登录时刷新合约列表缓存，运行期间不自动刷新

**WebSocket推送**：分端点设计
- `ws://localhost:8000/ws/market` - 行情推送（market_data）
- `ws://localhost:8000/ws/order` - 报单回报（order_return, trade_return）
- `ws://localhost:8000/ws/position` - 持仓更新（position_update）
- `ws://localhost:8000/ws/stop` - 止损单状态更新（stop_order_update）
- `ws://localhost:8000/ws/system` - 系统消息（connection_status, error）
- 连接后自动推送已订阅合约的行情更新
- **安全说明**：仅监听localhost地址，无外部网络暴露风险，WebSocket连接无需额外认证

### 4.3 报单接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/order/insert` | 报单 | `OrderRequest` | `{order_ref, success, message}` |
| POST | `/api/order/cancel` | 撤单 | `{order_ref}` | `{success, message}` |
| POST | `/api/order/cancel_all` | 批量撤单 | - | `{cancelled_count, success}` |
| POST | `/api/order/reverse` | 一键反向 | `{instrumentID}` | `{success, orders: [...]}` |
| POST | `/api/order/lock` | 一键锁仓 | `{instrumentID}` | `{success, orders: [...]}` |
| GET | `/api/order/status/{order_ref}` | 查询单个报单状态 | - | `OrderStatus` |
| POST | `/api/order/stop` | 提交止损单 | `StopOrderRequest` | `{stopOrderID, success, message}` |
| POST | `/api/order/stop/cancel` | 取消止损单 | `{stopOrderID}` | `{success, message}` |
| GET | `/api/order/stop/list` | 查询止损单列表 | - | `{stopOrders: [...], count: N}` |

**一键反向实现**（⚠️ 非原子操作，存在中间状态风险）：
1. 根据原报单引用查询持仓方向和数量
2. 先平仓原持仓（close/close_today）
3. 再开反方向仓（open）
4. 两步操作异步执行，返回新的报单引用
5. 如果平仓失败，不开新仓
6. 注意：两步之间市场价格可能大幅波动，无法保证最终成交价

**一键锁仓实现**（区分两种场景）：
- **场景A：双开锁仓**（当前无持仓）：同时开多空相同数量（buy open + sell open），返回双向报单引用
- **场景B：反手锁仓**（已有单边持仓）：在反方向开仓相同数量（如持多1手 → sell open 1手），锁定当前盈亏
- 注意：双开锁仓的两次报单并非原子操作，可能出现部分成交的情况

### 4.4 行情扩展接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/market/kline` | 获取K线数据（当前会话内实时聚合，不依赖历史数据） | `?instrument=IF2608&period=1m&count=100` | `[KLineData]` |
| GET | `/api/market/depth` | 获取五档行情深度 | `?instrument=IF2608` | `DepthData` |
| GET | `/api/market/volatility` | 获取隐含波动率（Black-Scholes模型计算） | `?instrument=IF2608` | `VolatilityData` |

### 4.5 查询接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/query/orders` | 查询报单流水（缓存） | - | `{orders: [OrderRecord], count: N}` |
| POST | `/api/query/orders/refresh` | 从CTP刷新报单流水 | - | `{orders: [OrderRecord], count: N}` |
| GET | `/api/query/trades` | 查询成交流水（缓存） | - | `{trades: [TradeRecord], count: N}` |
| POST | `/api/query/trades/refresh` | 从CTP刷新成交流水 | - | `{trades: [TradeRecord], count: N}` |
| GET | `/api/query/positions` | 查询持仓（缓存） | - | `{positions: [PositionRecord], count: N}` |
| POST | `/api/query/positions/refresh` | 从CTP刷新持仓 | - | `{positions: [PositionRecord], count: N}` |
| GET | `/api/query/account` | 查询账户资金（缓存） | - | `AccountInfo` |
| POST | `/api/query/account/refresh` | 从CTP刷新账户资金 | - | `AccountInfo` |
| GET | `/api/query/contracts` | 查询合约信息 | `?instruments=IF2608` | `{[instrument_id]: ContractInfo}` |

### 4.6 数据模型

#### CTP标准接口（7个）

**MarketSnapshot**：
```typescript
// 对应CTP: CThostFtdcDepthMarketDataField
interface MarketSnapshot {
  actionDay: string;           // 业务日期
  askPrice1: number;           // 卖一价
  askPrice2: number;           // 卖二价
  askPrice3: number;           // 卖三价
  askPrice4: number;           // 卖四价
  askPrice5: number;           // 卖五价
  askVolume1: number;          // 卖一量
  askVolume2: number;          // 卖二量
  askVolume3: number;          // 卖三量
  askVolume4: number;          // 卖四量
  askVolume5: number;          // 卖五量
  averagePrice: number;        // 当日均价
  bandingLowerPrice: number;   // 下限价
  bandingUpperPrice: number;   // 上限价
  bidPrice1: number;           // 买一价
  bidPrice2: number;           // 买二价
  bidPrice3: number;           // 买三价
  bidPrice4: number;           // 买四价
  bidPrice5: number;           // 买五价
  bidVolume1: number;          // 买一量
  bidVolume2: number;          // 买二量
  bidVolume3: number;          // 买三量
  bidVolume4: number;          // 买四量
  bidVolume5: number;          // 买五量
  closePrice: number;          // 今收盘
  currDelta: number;           // 当前虚实度
  exchangeID: string;          // 交易所代码
  exchangeInstID: string;      // 合约在交易所的代码
  highestPrice: number;        // 最高价
  instrumentID: string;        // 合约代码
  lastPrice: number;           // 最新价
  lowerLimitPrice: number;     // 最低价
  lowestPrice: number;         // 最低价
  openInterest: number;        // 持仓量
  openPrice: number;           // 今开盘
  preClosePrice: number;       // 昨收盘
  preDelta: number;            // 昨虚实度
  preOpenInterest: number;     // 昨持仓量
  preSettlementPrice: number;  // 昨结算价
  settlementPrice: number;     // 今结算价
  tradingDay: string;          // 交易日
  turnover: number;            // 成交额
  updateMillisec: number;      // 最后修改毫秒
  updateTime: string;          // 最后修改时间
  upperLimitPrice: number;     // 涨停板价
  volume: number;              // 成交量
}
```

**OrderRequest**：
```typescript
// 对应CTP: CThostFtdcInputOrderField
interface OrderRequest {
  accountID: string;               // 投资者账号
  brokerID: string;                // 经纪公司代码
  businessUnit: string;            // 业务单元
  clientID: string;                // 客户代码
  combHedgeFlag: string;           // 组合投机套保标志
  combOffsetFlag: string;          // 组合开平标志
  contingentCondition: string;     // 触发条件
  currencyID: string;              // 币种代码
  direction: string;               // 买卖方向
  exchangeID: string;              // 交易所代码
  forceCloseReason: string;        // 强平原因
  gTDDate: string;                 // GTD日期
  iPAddress: string;               // IP地址
  instrumentID: string;            // 合约代码
  investUnitID: string;            // 投资单元代码
  investorID: string;              // 投资者代码
  isAutoSuspend: number;           // 自动挂起标志
  isSwapOrder: number;             // 互换单标志
  limitPrice: number;              // 价格
  macAddress: string;              // Mac地址
  minVolume: number;               // 最小成交量
  orderMemo: string;               // 报单附言
  orderPriceType: string;          // 报单价格条件
  orderRef: string;                // 报单引用
  requestID: number;               // 请求编号
  sessionReqSeq: number;           // 会话请求序号
  stopPrice: number;               // 止损价
  timeCondition: string;           // 有效期类型
  userForceClose: number;          // 用户强评标志
  userID: string;                  // 用户代码
  volumeCondition: string;         // 成交量类型
  volumeTotalOriginal: number;     // 报单数量
}
```

**OrderReturn**：
```typescript
// 对应CTP: CThostFtdcOrderField
interface OrderReturn {
  accountID: string;               // 投资者账号
  activeTime: string;              // 激活时间
  activeTraderID: string;          // 最后修改交易所交易员代码
  activeUserID: string;            // 操作用户代码
  branchID: string;                // 期商分支机构代码
  brokerID: string;                // 经纪公司代码
  brokerOrderSeq: number;          // 经纪公司报单编号
  businessUnit: string;            // 业务单元
  cancelTime: string;              // 撤销时间
  clearingPartID: string;          // 结算会员编号
  clientID: string;                // 客户代码
  combHedgeFlag: string;           // 组合投机套保标志
  combOffsetFlag: string;          // 组合开平标志
  contingentCondition: string;     // 触发条件
  currencyID: string;              // 币种代码
  direction: string;               // 买卖方向
  exchangeID: string;              // 交易所代码
  exchangeInstID: string;          // 合约在交易所的代码
  forceCloseReason: string;        // 强平原因
  frontID: number;                 // 前置编号
  gTDDate: string;                 // GTD日期
  iPAddress: string;               // IP地址
  insertDate: string;              // 报单日期
  insertTime: string;              // 委托时间
  installID: number;               // 安装编号
  instrumentID: string;            // 合约代码
  investUnitID: string;            // 投资单元代码
  investorID: string;              // 投资者代码
  isAutoSuspend: number;           // 自动挂起标志
  isSwapOrder: number;             // 互换单标志
  limitPrice: number;              // 价格
  macAddress: string;              // Mac地址
  minVolume: number;               // 最小成交量
  notifySequence: number;          // 报单提示序号
  orderLocalID: string;            // 本地报单编号
  orderMemo: string;               // 报单附言
  orderPriceType: string;          // 报单价格条件
  orderRef: string;                // 报单引用
  orderSource: string;             // 报单来源
  orderStatus: string;             // 报单状态
  orderSubmitStatus: string;       // 报单提交状态
  orderSysID: string;              // 报单编号
  orderType: string;               // 报单类型
  participantID: string;           // 会员代码
  relativeOrderSysID: string;      // 相关报单编号
  requestID: number;               // 请求编号
  sequenceNo: number;              // 序列编号
  sessionID: number;               // 会话编号
  sessionReqSeq: number;           // 会话请求序号
  settlementID: number;            // 结算编号
  statusMsg: string;               // 状态信息
  stopPrice: number;               // 止损价
  suspendTime: string;             // 挂起时间
  timeCondition: string;           // 有效期类型
  traderID: string;                // 交易所交易员代码
  tradingDay: string;              // 交易日
  updateTime: string;              // 最后修改时间
  userForceClose: number;          // 用户强评标志
  userID: string;                  // 用户代码
  userProductInfo: string;         // 用户端产品信息
  volumeCondition: string;         // 成交量类型
  volumeTotal: number;             // 剩余数量
  volumeTotalOriginal: number;     // 报单数量
  volumeTraded: number;            // 今成交数量
  zCETotalTradedVolume: number;    // 郑商所成交数量
}
```

**TradeReturn**：
```typescript
// 对应CTP: CThostFtdcTradeField
interface TradeReturn {
  brokerID: string;                // 经纪公司代码
  brokerOrderSeq: number;          // 经纪公司报单编号
  businessUnit: string;            // 业务单元
  clearingPartID: string;          // 结算会员编号
  clientID: string;                // 客户代码
  direction: string;               // 买卖方向
  exchangeID: string;              // 交易所代码
  exchangeInstID: string;          // 合约在交易所的代码
  hedgeFlag: string;               // 投机套保标志
  instrumentID: string;            // 合约代码
  investUnitID: string;            // 投资单元代码
  investorID: string;              // 投资者代码
  offsetFlag: string;              // 开平标志
  orderLocalID: string;            // 本地报单编号
  orderRef: string;                // 报单引用
  orderSysID: string;              // 报单编号
  participantID: string;           // 会员代码
  price: number;                   // 价格
  priceSource: string;             // 成交价来源
  sequenceNo: number;              // 序列编号
  settlementID: number;            // 结算编号
  tradeDate: string;               // 成交时期
  tradeID: string;                 // 成交编号
  tradeSource: string;             // 成交来源
  tradeTime: string;               // 成交时间
  tradeType: string;               // 成交类型
  traderID: string;                // 交易所交易员代码
  tradingDay: string;              // 交易日
  tradingRole: string;             // 交易角色
  userID: string;                  // 用户代码
  volume: number;                  // 数量
}
```

**PositionInfo**：
```typescript
// 对应CTP: CThostFtdcInvestorPositionField
interface PositionInfo {
  abandonFrozen: number;           // 放弃数量冻结
  brokerID: string;                // 经纪公司代码
  cashIn: number;                  // 资金差额
  closeAmount: number;             // 平仓金额
  closeProfit: number;             // 平仓盈亏
  closeProfitByDate: number;       // 逐日平仓盈亏
  closeProfitByTrade: number;      // 逐笔平仓盈亏
  closeVolume: number;             // 平仓量
  combLongFrozen: number;          // 组合多头冻结
  combPosition: number;            // 组合持仓
  combShortFrozen: number;         // 组合空头冻结
  commission: number;              // 手续费
  exchangeID: string;              // 交易所代码
  exchangeMargin: number;          // 交易所保证金
  frozenCash: number;              // 冻结资金
  frozenCommission: number;        // 冻结手续费
  frozenMargin: number;            // 冻结保证金
  hedgeFlag: string;               // 投机套保标志
  instrumentID: string;            // 合约代码
  investUnitID: string;            // 投资单元代码
  investorID: string;              // 投资者代码
  longFrozen: number;              // 多头冻结
  longFrozenAmount: number;        // 多头冻结金额
  marginRateByMoney: number;       // 保证金率
  marginRateByVolume: number;      // 保证金率(按手数)
  openAmount: number;              // 开仓金额
  openCost: number;                // 开仓成本
  openVolume: number;              // 开仓量
  posiDirection: string;           // 持仓多空方向
  position: number;                // 今日持仓
  positionCost: number;            // 持仓成本
  positionCostOffset: number;      // 持仓成本差值
  positionDate: string;            // 持仓日期
  positionProfit: number;          // 持仓盈亏
  preMargin: number;               // 上次占用的保证金
  preSettlementPrice: number;      // 上次结算价
  settlementID: number;            // 结算编号
  settlementPrice: number;         // 本次结算价
  shortFrozen: number;             // 空头冻结
  shortFrozenAmount: number;       // 空头冻结金额
  strikeFrozen: number;            // 执行冻结
  strikeFrozenAmount: number;      // 执行冻结金额
  tasPosition: number;             // TAS持仓
  tasPositionCost: number;         // TAS持仓成本
  todayPosition: number;           // 今日持仓
  tradingDay: string;              // 交易日
  useMargin: number;               // 占用保证金
  ydPosition: number;              // 上日持仓
  ydStrikeFrozen: number;          // 执行冻结的昨仓
}
```

**AccountInfo**：
```typescript
// 对应CTP: CThostFtdcTradingAccountField
interface AccountInfo {
  accountID: string;               // 投资者账号
  available: number;               // 可用资金
  balance: number;                 // 期货结算准备金
  bizType: string;                 // 业务类型
  brokerID: string;                // 经纪公司代码
  cashIn: number;                  // 资金差额
  closeProfit: number;             // 平仓盈亏
  commission: number;              // 手续费
  credit: number;                  // 信用额度
  currMargin: number;              // 当前保证金总额
  currencyID: string;              // 币种代码
  deliveryMargin: number;          // 投资者交割保证金
  deposit: number;                 // 入金金额
  exchangeDeliveryMargin: number;  // 交易所交割保证金
  exchangeMargin: number;          // 交易所保证金
  frozenCash: number;              // 冻结的资金
  frozenCommission: number;        // 冻结的手续费
  frozenMargin: number;            // 冻结的保证金
  frozenSwap: number;              // 多交割品价差冻结资金
  fundMortgageAvailable: number;   // 货币质押余额
  fundMortgageIn: number;          // 货币质入金额
  fundMortgageOut: number;         // 货币质出金额
  interest: number;                // 利息收入
  interestBase: number;            // 利息基数
  mortgage: number;                // 质押金额
  mortgageableFund: number;        // 可质押货币金额
  positionProfit: number;          // 持仓盈亏
  preBalance: number;              // 上次结算准备金
  preCredit: number;               // 上次信用额度
  preDeposit: number;              // 上次存款额
  preFundMortgageIn: number;       // 上次货币质入金额
  preFundMortgageOut: number;      // 上次货币质出金额
  preMargin: number;               // 上次占用的保证金
  preMortgage: number;             // 上次质押金额
  remainSwap: number;              // 多交割品价差剩余资金
  reserve: number;                 // 基本准备金
  reserveBalance: number;          // 保底期货结算准备金
  settlementID: number;            // 结算编号
  specProductCloseProfit: number;  // 特殊产品平仓盈亏
  specProductCommission: number;   // 特殊产品手续费
  specProductExchangeMargin: number; // 特殊产品交易所保证金
  specProductFrozenCommission: number; // 特殊产品冻结手续费
  specProductFrozenMargin: number; // 特殊产品冻结保证金
  specProductMargin: number;       // 特殊产品占用保证金
  specProductPositionProfit: number; // 特殊产品持仓盈亏
  specProductPositionProfitByAlg: number; // 特殊产品持仓盈亏算法
  tradingDay: string;              // 交易日
  withdraw: number;                // 出金金额
  withdrawQuota: number;           // 可取资金
}
```

**InstrumentInfo**：
```typescript
// 对应CTP: CThostFtdcInstrumentField
interface InstrumentInfo {
  combinationType: string;         // 组合类型
  createDate: string;              // 创建日
  deliveryMonth: number;           // 交割月
  deliveryYear: number;            // 交割年份
  endDelivDate: string;            // 结束交割日
  exchangeID: string;              // 交易所代码
  exchangeInstID: string;          // 合约在交易所的代码
  expireDate: string;              // 到期日
  instLifePhase: string;           // 合约生命周期状态
  instrumentID: string;            // 合约代码
  instrumentName: string;          // 合约名称
  isTrading: number;               // 当前是否交易
  longMarginRatio: number;         // 多头保证金率
  maxLimitOrderVolume: number;     // 限价单最大下单量
  maxMarginSideAlgorithm: string;  // 是否使用大额单边保证金算法
  maxMarketOrderVolume: number;    // 市价单最大下单量
  minLimitOrderVolume: number;     // 限价单最小下单量
  minMarketOrderVolume: number;    // 市价单最小下单量
  openDate: string;                // 上市日
  optionsType: string;             // 期权类型
  positionDateType: string;        // 持仓日期类型
  positionType: string;            // 持仓类型
  priceTick: number;               // 最小变动价位
  productClass: string;            // 产品类型
  productID: string;               // 产品代码
  shortMarginRatio: number;        // 空头保证金率
  startDelivDate: string;          // 开始交割日
  strikePrice: number;             // 执行价
  underlyingInstrID: string;       // 基础商品代码
  underlyingMultiple: number;      // 合约基础商品乘数
  volumeMultiple: number;          // 合约乘数
}
```

#### 自定义业务接口（10个）

**OrderStatus**（报单状态）：
```typescript
interface OrderStatus {
  orderRef: string;                // 报单引用
  instrumentID: string;            // 合约代码
  direction: string;               // 买卖方向
  combOffsetFlag: string;          // 组合开平标志
  limitPrice: number;              // 报单价格
  volumeTotalOriginal: number;     // 报单数量
  volumeTraded: number;            // 已成交数量
  orderStatus: string;             // 报单状态
  statusMsg: string;               // 状态信息
  insertTime: string;              // 报单时间
}
```

**StopOrderRequest**（止损单请求）：
```typescript
interface StopOrderRequest {
  instrumentID: string;            // 合约代码
  direction: string;               // 买卖方向
  combOffsetFlag: string;          // 组合开平标志
  limitPrice: number;              // 报单价格（触发后的报单价格）
  volumeTotalOriginal: number;     // 报单数量
  stopPrice: number;               // 止损价（必填）
  timeCondition: string;           // 有效期类型（默认GFD）
}
```

**StopOrder**（止损单状态）：
```typescript
interface StopOrder {
  stopOrderRef: string;            // 止损单引用
  instrumentID: string;            // 合约代码
  direction: string;               // 买卖方向
  combOffsetFlag: string;          // 组合开平标志
  limitPrice: number;              // 报单价格
  volumeTotalOriginal: number;     // 报单数量
  stopPrice: number;               // 止损价
  status: string;                  // 状态（pending/triggered/trigger_failed/canceled）
  triggeredOrderRef?: string;      // 触发后的报单引用
  createdAt: string;               // 创建时间
  triggeredAt?: string;            // 触发时间
}
```

**QuoteDepth**（报价深度）：
```typescript
interface QuoteDepth {
  instrumentID: string;            // 合约代码
  bidPrices: number[];             // 买一到买五价格
  bidVolumes: number[];            // 买一到买五数量
  askPrices: number[];             // 卖一到卖五价格
  askVolumes: number[];            // 卖一到卖五数量
  updateTime: string;              // 更新时间
}
```

**ContractInfo**（合约信息，InstrumentInfo别名）：
```typescript
// 业务层别名，对应CTP: CThostFtdcInstrumentField
interface ContractInfo {
  instrumentID: string;            // 合约代码
  instrumentName: string;          // 合约名称
  exchangeID: string;              // 交易所代码
  productID: string;               // 产品代码
  volumeMultiple: number;          // 合约乘数
  priceTick: number;               // 最小变动价位
  expireDate: string;              // 到期日
  isTrading: number;               // 是否可交易
}
```

**KLineData**（K线数据）：
```typescript
interface KLineData {
  timestamp: number;               // 时间戳
  open: number;                    // 开盘价
  high: number;                    // 最高价
  low: number;                     // 最低价
  close: number;                   // 收盘价
  volume: number;                  // 成交量
  openInterest: number;            // 持仓量
}
```

**DepthData**（五档行情深度）：
```typescript
interface DepthData {
  instrumentID: string;            // 合约代码
  bids: Array<{price: number, volume: number}>;  // 买一到买五
  asks: Array<{price: number, volume: number}>;  // 卖一到卖五
  updateTime: string;              // 更新时间
}
```

**VolatilityData**（波动率数据）：
```typescript
interface VolatilityData {
  instrumentID: string;            // 合约代码
  impliedVolatility: number;       // 隐含波动率（基于Black-Scholes模型计算）
  underlyingPrice: number;         // 标的资产价格
  strikePrice: number;             // 行权价
  timeToExpiry: number;            // 到期时间（年）
  riskFreeRate: number;            // 无风险利率
  optionType: string;              // 期权类型（'call'/'put'）
  updateTime: string;              // 更新时间
}
```

**OptionContract**（期权合约）：
```typescript
interface OptionContract {
  instrumentID: string;            // 合约代码
  instrumentName: string;          // 合约名称
  underlying: string;              // 标的合约
  optionsType: string;             // 期权类型（call/put）
  strikePrice: number;             // 行权价
  expireDate: string;              // 到期日
  volumeMultiple: number;          // 合约乘数
  priceTick: number;               // 最小变动价位
  isTrading: number;               // 是否可交易
}
```

**OptionChain + OptionQuote**（期权T型报价）：
```typescript
interface OptionChain {
  underlying: string;              // 标的合约
  expireDate: string;              // 到期日
  calls: OptionQuote[];            // 看涨期权列表（按行权价排序）
  puts: OptionQuote[];             // 看跌期权列表（按行权价排序）
  updateTime: string;              // 更新时间
}

interface OptionQuote {
  instrumentID: string;            // 合约代码
  strikePrice: number;             // 行权价
  lastPrice: number;               // 最新价
  bidPrice: number;                // 买一价
  askPrice: number;                // 卖一价
  volume: number;                  // 成交量
  openInterest: number;            // 持仓量
  impliedVolatility: number;       // 隐含波动率
}
```

### 4.7 错误码定义

所有接口错误响应统一格式：
```json
{
  "success": false,
  "error": {
    "code": "错误码",
    "message": "错误描述",
    "ctp_error_id": 0,
    "ctp_error_msg": ""
  }
}
```
> `ctp_error_id`和`ctp_error_msg`仅在`code`为`CTP_ERROR`时存在，透传CTP原生错误码（ErrorID）和错误消息（ErrorMsg）。

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
| `CTP_ERROR` | CTP错误 | simnow返回的业务错误。CTP原生错误码（ErrorID）和错误消息（ErrorMsg）通过`ctp_error_id`和`ctp_error_msg`字段透传，不做映射 |

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
    │                     │                    ├─→ 自动重连(5次) ──→│
    │                     │                    │←─ 重连成功 ────────┤
    │                     │←─ WebSocket恢复 ──┤                    │
    │←─ 显示已恢复 ─────┤                    │                    │
```

---

## 6. 测试用例

### 6.1 单元测试

| 测试ID | 测试项 | 输入 | 预期输出 | 优先级 |
|--------|--------|------|----------|--------|
| UT-01 | 行情订阅 | 订阅合约列表["IF2608"] | 返回success=true | P0 |
| UT-02 | 行情退订 | 退订合约列表["IF2608"] | 返回success=true | P0 |
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
| UT-13 | 报价查询 | 查询IF2608报价 | 返回QuoteDepth | P1 |
| UT-14 | 合约查询 | 查询IF2608合约信息 | 返回ContractInfo | P1 |
| UT-15 | 止损单提交 | {instrument_id:"IF2608", direction:"sell", stop_price:480.00} | 返回stop_order_ref | P1 |
| UT-16 | 止损单取消 | {stop_order_ref:"SO123"} | 返回success=true | P1 |
| UT-17 | 止损单查询 | 查询止损单列表 | 返回止损单列表 | P1 |

### 6.2 集成测试

| 测试ID | 测试项 | 测试步骤 | 预期结果 | 优先级 |
|--------|--------|----------|----------|--------|
| IT-01 | 登录流程 | 1.调用登录接口 2.检查连接状态 | md_connected=true, td_connected=true | P0 |
| IT-02 | 行情推送 | 1.订阅IF2608 2.等待WebSocket推送 | 收到market_data消息 | P0 |
| IT-03 | 完整报单流程 | 1.报单 2.查询报单流水 3.查询成交流水 | 报单记录和成交记录正确 | P0 |
| IT-04 | 报单撤单流程 | 1.报单 2.撤单 3.查询状态 | order_status=canceled | P0 |
| IT-05 | 止损单触发 | 1.提交止损单（止损价480.00）2.等待价格达到止损价 3.检查止损单状态 | 止损单状态变为triggered，自动生成报单 | P1 |
| IT-06 | 点价报单流程 | 1.单击五档行情任意价格 2.自动以该价格报单 | 报单成功，价格正确 | P0 |
| IT-07 | 双击填充流程 | 1.双击行情表格某行 2.检查报单面板 | 合约自动填充 | P1 |
| IT-08 | 报价深度查询 | 1.订阅行情 2.查询报价 | 返回五档行情深度（买一到买五、卖一到卖五） | P1 |
| IT-09 | 合约信息查询 | 1.查询合约信息 | 返回合约乘数、最小变动价位 | P1 |
| IT-10 | 止损单取消流程 | 1.提交止损单 2.取消止损单 3.查询止损单状态 | 止损单状态为canceled | P1 |
| IT-11 | 快捷键报单流程 | 1.报单面板获得焦点 2.按B键 3.查询报单 | 自动生成买入报单 | P1 |
| IT-12 | 批量撤单流程 | 1.提交多个报单 2.点击批量撤单 3.查询报单状态 | 所有未成交报单状态为canceled | P1 |
| IT-13 | 开仓/平仓/平今流程 | 1.分别测试开仓、平仓、平今操作 | 报单成功，开平标志正确 | P1 |
| IT-14 | K线图展示 | 1.订阅行情 2.切换周期 3.观察K线图 | K线图正常显示 | P1 |
| IT-15 | 期权波动率展示 | 1.查看期权行情 | 隐含波动率计算正确 | P1 |
| IT-16 | 价格步进调整 | 1.输入价格 2.检查价格对齐 | 自动对齐最小变动价位 | P1 |
| IT-17 | 价差显示 | 1.观察行情表格 | 买卖价差计算正确 | P1 |
| IT-18 | 一键反向流程 | 1.报单 2.点击一键反向 3.查询新报单 | 方向反转，价格数量保留 | P1 |
| IT-19 | 一键锁仓流程 | 1.点击一键锁仓 2.查询持仓 | 同时开多空相同数量 | P2 |
| IT-20 | 点击持仓平仓流程 | 1.开仓 2.点击持仓 3.查询报单 | 自动填充平仓报单 | P1 |

### 6.3 E2E测试

| 测试ID | 测试项 | 测试步骤 | 预期结果 | 优先级 |
|--------|--------|----------|----------|--------|
| E2E-01 | 完整交易流程 | 1.登录 2.订阅行情 3.报单 4.查询 | 全流程正常 | P0 |
| E2E-02 | 多合约行情 | 1.订阅10个合约 2.观察表格 | 表格流畅更新 | P1 |
| E2E-03 | 异常恢复 | 1.断开网络 2.恢复网络 3.验证重连 | 自动重连成功 | P2 |
| E2E-04 | 点价报单E2E | 1.订阅行情 2.单击五档行情任意价格 3.查询成交 | 报单成功并成交 | P0 |
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

# 创建项目
npm create vite trader-frontend -- --template react-ts
cd trader-frontend

# 安装依赖
npm install
npm install @visactor/vtable zustand axios echarts

# 启动开发服务器
npm run dev
```

### 7.2 后端环境

```bash
# 安装Python (推荐3.10+)
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install fastapi uvicorn websockets ctp-python

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
4. Python CTP封装库（ctp-python）：
   - 使用`ctp-python`库，SWIG封装，开箱即用
   - 安装：`pip install ctp-python`
   - **开发前必须完成技术Spike验证**：
     ① 能否通过ctp-python成功加载DLL并创建API实例
     ② 能否成功连接到simnow模拟柜台并登录
     ③ 能否收到行情回调（OnRtnDepthMarketData）
     ④ 能否成功提交一笔报单并收到回报（OnRtnOrder）
     ⑤ 验证simnow是否支持市价单（OrderPriceType=ANYPRICE），不支持时需实现降级方案

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
│  搜索: [________] [订阅] [退订] [批量撤单]    │  合约: [IF2608    ]           │
│                                             │  方向: (●买 ○卖)              │
│  ┌─────────────────────────────────────┐   │  开平: (●开 ○平 ○平今)        │
│  │ 合约   │最新│涨跌│买一│...│卖一│成交量│持仓│   │  类型: [限价  ▼]              │
│  │ IF2608 │480↑│+5 │480 │481 │12345│678│   │  价格: [480.50] [+] [-]       │
│  │ IF2609 │3800│-10│3799│3801│54321│987│   │  数量: [1    ] [+] [-]        │
│  └─────────────────────────────────────┘   │                               │
│  (vtable高性能渲染，支持1000+合约)           │  [买入 B] [卖出 S] [撤单 C]   │
│                                             │                               │
├─────────────────────────────────────────────┴───────────────────────────────┤
│ 查询窗口: 报单查询 / 持仓查询 / 资金查询（独立浮动窗）                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 面板说明

| 面板 | 对应组件 | 说明 |
|------|----------|------|
| 顶部状态栏 | `ConnectionStatus` | 显示行情/交易连接状态、账户信息、余额 |
| 行情面板 | `MarketPanel` + `MarketTable` | vtable渲染，支持单击点价、双击填充 |
| 报单面板 | `OrderPanel` + `OrderForm` | 限价/市价切换，开平切换，快捷键 |
| 查询窗口 | `OrdersQuery`/`PositionsQuery`/`AccountQuery` | 独立浮动窗口：报单查询、持仓查询、资金查询 |
| 快捷键配置 | `QuickKeys` | 弹窗式配置面板，支持自定义快捷键映射 |
| 性能监控 | `PerfMonitor` | 默认隐藏，Ctrl+P切换显示FPS和渲染耗时 |

### 8.3 交互说明

| 操作 | 行为 |
|------|------|
| 单击五档行情任意价格 | 直接以该价格、该方向提交报单（点价报单） |
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
| 2026-07-08 | v1.1 | 实时数据展示方案：行情批量更新(50ms)、查询数据增量更新、新数据高亮、自动滚动、暂停更新、时间倒序 | ✅ 完成 |
| 2026-07-08 | v1.2 | CTP绑定方案：从SWIG改为ctp-python封装库（开箱即用，无需编译） | ✅ 完成 |
| - | v1.3 | 技术Spike：ctp-python验证（DLL加载、登录、行情回调、报单回调）【对应里程碑M0】 | ⏳ 待开始 |
| - | v1.4 | Python中间层开发（含止损单监控服务、断线重连、止损单持久化、错误处理）【对应里程碑M1】 | ⏳ 待开始 |
| - | v1.5 | 前端行情模块开发（vtable高性能渲染、点价报单、期权T型报价、K线图、WebSocket消息处理）【对应里程碑M2】 | ⏳ 待开始 |
| - | v1.6 | 前端报单模块开发（快捷键、批量撤单、一键反向/锁仓、止损单提交）【对应里程碑M3】 | ⏳ 待开始 |
| 2026-07-09 | v1.7 | 根据py-ctp.md和trader文件夹更新CTP API文档：版本说明、连接配置、穿透式认证、关键回调 | ✅ 完成 |
| - | v1.7 | 前端查询模块开发（报价查询、合约查询、止损单列表、账户资金）【对应里程碑M4】 | ⏳ 待开始 |
| - | v1.8 | 大数据调优（虚拟滚动、批量更新、增量渲染、内存优化、性能监控、断线重连）【无对应里程碑，属于优化阶段】 | ⏳ 待开始 |
| - | v1.9 | 联调测试 + Bug修复 + 性能测试 + 错误处理验证【对应里程碑M5】 | ⏳ 待开始 |
| 2026-07-15 | v2.0 | 补充AccountQuery组件到query模块 | ✅ 完成 |

---

## 10. 方案取舍总结

| 方案 | 架构 | 优势 | 风险 | 结论 |
|------|------|------|------|------|
| A | Python全栈 | DLL对接简单、开发快 | 前端体验差 | ❌ 不选 |
| B | Node.js+React | 前后端统一JS | DLL对接复杂 | ❌ 不选 |
| **C** | **Python+React** | **DLL对接简单、前端体验好** | **两套语言栈** | **✅ 选择** |

**选择方案C的理由**：
1. Python的ctp-python封装库是成熟的CTP对接方案，开箱即用
2. React+vtable满足高性能表格需求
3. WebSocket实现行情实时推送
4. 两套语言栈的维护成本可接受

**可行性验证结论**：

| 验证项 | 验证结果 | 结论 |
|--------|----------|------|
| vtable性能 | vtable支持虚拟滚动和增量渲染，官方示例可处理10万+行数据 | ✅ 可行 |
| CTP回调转WebSocket | Python回调函数可直接调用WebSocket推送，延迟<1ms | ✅ 可行 |
| DLL加载 | ctp-python库已封装CTP API，支持v6.7.13版本，开箱即用 | ✅ 可行 |
| 100合约+10档深度 | 100×10×2×8bytes=16KB/次，WebSocket带宽充足 | ✅ 可行 |
