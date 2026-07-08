# Dev.md — 项目设计稿

## 1. 项目概述

### 1.1 项目背景
开发一个**简易桌面交易终端**（浏览器Web应用），对接上期所simnow模拟柜台，实现行情接入、交易接入、手动报单等功能。

### 1.2 技术栈
| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.x | UI框架 |
| 前端语言 | TypeScript | 5.x | 类型安全 |
| 构建工具 | Vite | 5.x | 开发和构建 |
| 表格组件 | @visactor/vtable | latest | 高性能表格（虚拟滚动、增量渲染） |
| 状态管理 | Zustand | latest | 轻量级状态管理 |
| HTTP客户端 | Axios | latest | REST API调用 |
| 图表库 | ECharts | latest | K线图、技术指标 |
| 后端框架 | FastAPI | 0.100+ | REST API服务 |
| WebSocket | websockets | 11.x | 实时推送 |
| CTP绑定 | openctp-ctp | latest | Python CTP封装库（开箱即用） |

### 1.3 角色分工
| 角色 | 职责 | 负责模块 |
|------|------|----------|
| **角色A** | 后端开发、API接口、CTP对接、系统架构 | server/目录 |
| **角色B** | 前端开发、UI组件、交互逻辑、性能优化 | frontend/目录 |

---

## 2. 代码目录结构

### 2.1 项目根目录

```
keti/
├── frontend/                # 前端代码（角色B）
├── server/                  # 后端代码（角色A）
├── trader/                  # simnow API文件（在.gitignore中）
│   ├── mduserapi/           # 行情API（DLL、头文件）
│   └── traderapi/           # 交易API（DLL、头文件）
├── prd.md                   # 产品需求文档
├── design.md                # 技术架构设计文档
├── dev.md                   # 项目设计稿（本文件）
├── task.md                  # PR任务拆分（待编写）
├── ai-log.md                # AI协作记录（在.gitignore中）
├── mis.md                   # 项目开发流程规范（在.gitignore中）
├── CLAUDE.md                # AI助手指南（在.gitignore中）
└── .gitignore               # Git忽略规则
```

### 2.2 前端目录结构

```
frontend/
├── public/                    # 静态资源
│   └── favicon.ico
├── src/
│   ├── assets/                # 资源文件
│   │   └── styles/            # 全局样式
│   ├── components/            # 通用组件
│   │   ├── ConnectionStatus/  # 连接状态指示器
│   │   │   └── index.tsx
│   │   ├── ContractSearch/    # 合约搜索框
│   │   │   └── index.tsx
│   │   ├── OrderForm/         # 报单表单（支持点价、快捷键、价格步进）
│   │   │   ├── index.tsx
│   │   │   └── hooks.ts       # 表单逻辑Hook
│   │   ├── QuickKeys/         # 快捷键管理组件（含配置面板）
│   │   │   └── index.tsx
│   │   ├── BatchCancel/       # 批量撤单组件
│   │   │   └── index.tsx
│   │   ├── SpreadDisplay/     # 价差显示组件
│   │   │   └── index.tsx
│   │   └── PerfMonitor/       # 渲染性能监控（FPS、渲染耗时，P2）
│   │       └── index.tsx
│   ├── hooks/                 # 自定义Hook
│   │   ├── useHotKeys.ts      # 快捷键Hook（仅报单面板焦点时生效）
│   │   ├── usePointOrder.ts   # 点价报单Hook
│   │   ├── usePriceStep.ts    # 价格步进Hook（自动对齐最小变动价位）
│   │   └── useReconnect.ts    # 断线重连Hook（指数退避重试，最多5次）
│   ├── modules/               # 业务模块
│   │   ├── market/            # 行情模块
│   │   │   ├── MarketPanel.tsx    # 行情面板主组件
│   │   │   ├── MarketTable.tsx    # 行情表格（vtable，支持单击/双击点价）
│   │   │   ├── DepthQuote.tsx     # 五档行情展示组件
│   │   │   ├── KLineChart.tsx     # K线图组件（多周期、技术指标）
│   │   │   └── store.ts           # 行情状态管理（Zustand）
│   │   ├── order/             # 报单模块
│   │   │   ├── OrderPanel.tsx     # 报单面板主组件
│   │   │   ├── OrderForm.tsx      # 报单表单（支持限价/市价、止损单提交、价格步进）
│   │   │   ├── StopOrderForm.tsx  # 止损单表单
│   │   │   ├── QuickActions.tsx   # 快捷操作（一键反向、一键锁仓）
│   │   │   └── store.ts           # 报单状态管理（Zustand）
│   │   ├── options/           # 期权模块
│   │   │   ├── OptionPanel.tsx    # 期权面板
│   │   │   ├── TQuoteTable.tsx    # T型报价表格（含波动率）
│   │   │   └── store.ts           # 期权状态管理（Zustand）
│   │   └── query/             # 查询模块
│   │       ├── QueryPanel.tsx     # 查询面板主组件（含暂停更新按钮）
│   │       ├── OrderFlow.tsx      # 报单流水（增量更新、新数据高亮）
│   │       ├── TradeFlow.tsx      # 成交流水（增量更新、新数据高亮）
│   │       ├── Position.tsx       # 持仓查询（支持点击平仓）
│   │       ├── QuoteQuery.tsx     # 报价查询（五档深度）
│   │       ├── ContractQuery.tsx  # 合约查询
│   │       ├── StopOrderList.tsx  # 止损单列表
│   │       └── store.ts           # 查询状态管理（Zustand）
│   ├── services/              # API服务层
│   │   ├── api.ts             # REST API封装（Axios）
│   │   ├── ws.ts              # WebSocket管理（分端点连接、重连、消息分发）
│   │   └── types.ts           # TypeScript类型定义
│   ├── stores/                # 全局状态
│   │   ├── connection.ts      # 连接状态（md_connected、td_connected）
│   │   ├── contracts.ts       # 合约列表
│   │   └── userPrefs.ts       # 用户偏好（自选合约、快捷键配置，localStorage持久化）
│   ├── utils/                 # 工具函数
│   │   ├── format.ts          # 格式化工具（价格、数量、时间）
│   │   └── validators.ts      # 表单校验工具
│   ├── App.tsx                # 主应用（多面板布局）
│   ├── main.tsx               # 入口文件
│   └── vite-env.d.ts          # Vite类型声明
├── index.html                 # HTML模板
├── package.json               # 依赖配置
├── tsconfig.json              # TypeScript配置
├── vite.config.ts             # Vite配置
└── .env                       # 环境变量（API地址）
```

### 2.3 后端目录结构

```
server/
├── api/                       # API路由
│   ├── __init__.py
│   ├── market.py              # 行情接口（订阅、退订、快照、K线、五档深度）
│   ├── order.py               # 报单接口（限价/市价、止损单、撤单、批量撤单、一键反向/锁仓）
│   ├── query.py               # 查询接口（报单、成交、持仓、资金、合约、报价）
│   └── connection.py          # 连接接口（登录、登出、状态）
├── ctp/                       # CTP封装层（使用openctp-ctp库）
│   ├── __init__.py
│   ├── md_user_api.py         # 行情API封装（基于openctp-ctp）
│   ├── trader_api.py          # 交易API封装（基于openctp-ctp）
│   ├── callback.py            # 回调处理（OnRtnOrder、OnRtnTrade等）
│   └── types.py               # CTP数据类型定义
├── services/                  # 业务服务层
│   ├── __init__.py
│   ├── stop_order.py          # 止损单监控服务（后端监控价格，触发后自动报单）
│   └── reconnect.py           # 断线重连服务（指数退避重试，最多5次）
├── ws/                        # WebSocket管理
│   ├── __init__.py
│   ├── manager.py             # 连接管理（连接池、消息广播）
│   └── handlers.py            # 消息处理（行情推送、报单回报、成交回报）
├── models/                    # 数据模型
│   ├── __init__.py
│   ├── market.py              # 行情数据模型（MarketSnapshot、KLineData、DepthData）
│   ├── order.py               # 报单数据模型（OrderRequest、OrderRecord、StopOrder）
│   ├── account.py             # 账户数据模型（AccountInfo、PositionRecord）
│   ├── contract.py            # 合约数据模型（ContractInfo）
│   └── options.py             # 期权数据模型（OptionContract、OptionChain）
├── data/                      # 数据持久化目录
│   └── stop_orders.json       # 止损单持久化文件
├── config.py                  # 配置管理（环境变量读取）
├── main.py                    # 应用入口（FastAPI应用）
├── requirements.txt           # Python依赖
└── .env                       # 环境变量（simnow账户、前置地址）
```

---

## 3. 前端设计

### 3.1 组件结构

#### 3.1.1 组件层次结构

```
App.tsx
├── ConnectionStatus/          # 连接状态指示器（顶部状态栏）
├── MarketPanel/               # 行情面板（左侧70%）
│   ├── ContractSearch/        # 合约搜索框
│   ├── MarketTable/           # 行情表格（vtable）
│   ├── DepthQuote/            # 五档行情（点击合约后显示）
│   └── KLineChart/            # K线图（点击合约后显示）
├── OrderPanel/                # 报单面板（右侧30%）
│   ├── OrderForm/             # 报单表单
│   ├── StopOrderForm/         # 止损单表单
│   └── QuickActions/          # 快捷操作（一键反向、一键锁仓）
├── QueryPanel/                # 查询面板（底部）
│   ├── OrderFlow/             # 报单流水
│   ├── TradeFlow/             # 成交流水
│   ├── Position/              # 持仓查询
│   ├── QuoteQuery/            # 报价查询
│   ├── ContractQuery/         # 合约查询
│   └── StopOrderList/         # 止损单列表
└── PerfMonitor/               # 性能监控（P2，默认隐藏）
```

#### 3.1.2 组件职责说明

| 组件 | 职责 | 关键功能 |
|------|------|----------|
| **App.tsx** | 主应用容器 | 多面板布局、全局状态初始化 |
| **ConnectionStatus** | 连接状态指示 | 显示行情/交易连接状态 |
| **MarketPanel** | 行情面板容器 | 合约搜索、行情表格、K线图 |
| **MarketTable** | 行情表格（vtable） | 高性能渲染、单击/双击点价 |
| **DepthQuote** | 五档行情展示 | 买一到买五、卖一到卖五 |
| **KLineChart** | K线图展示 | 多周期切换、技术指标 |
| **OrderPanel** | 报单面板容器 | 报单表单、止损单、快捷操作 |
| **OrderForm** | 报单表单 | 限价/市价、价格步进、快捷键 |
| **StopOrderForm** | 止损单表单 | 止损价设置、提交止损单 |
| **QuickActions** | 快捷操作 | 一键反向、一键锁仓 |
| **QueryPanel** | 查询面板容器 | 多Tab切换、暂停更新 |
| **OrderFlow** | 报单流水 | 增量更新、新数据高亮、时间倒序 |
| **TradeFlow** | 成交流水 | 增量更新、新数据高亮、时间倒序 |
| **Position** | 持仓查询 | 点击持仓直接平仓 |
| **QuoteQuery** | 报价查询 | 五档行情深度展示 |
| **ContractQuery** | 合约查询 | 合约详细信息展示 |
| **StopOrderList** | 止损单列表 | 止损单状态展示、取消操作 |
| **PerfMonitor** | 性能监控 | FPS监控、渲染耗时统计 |

### 3.2 状态管理

#### 3.2.1 Zustand Store 设计

```typescript
// src/stores/connection.ts - 连接状态
interface ConnectionStore {
  md_connected: boolean;
  td_connected: boolean;
  setMdConnected: (connected: boolean) => void;
  setTdConnected: (connected: boolean) => void;
}

// src/stores/contracts.ts - 合约列表
interface ContractsStore {
  contracts: ContractInfo[];
  selectedContracts: string[];  // 自选合约
  addContract: (instrumentId: string) => void;
  removeContract: (instrumentId: string) => void;
}

// src/stores/userPrefs.ts - 用户偏好（localStorage持久化）
interface UserPrefsStore {
  hotKeys: Record<string, string>;  // 快捷键配置
  setHotKey: (action: string, key: string) => void;
}
```

#### 3.2.2 模块 Store 设计

```typescript
// src/modules/market/store.ts - 行情状态
interface MarketStore {
  snapshots: Map<string, MarketSnapshot>;  // 行情快照
  depthData: Map<string, DepthData>;       // 五档深度
  klineData: Map<string, KLineData[]>;     // K线数据
  updateSnapshot: (data: MarketSnapshot) => void;
  batchUpdate: (data: MarketSnapshot[]) => void;  // 批量更新
}

// src/modules/order/store.ts - 报单状态
interface OrderStore {
  orderForm: OrderRequest;
  stopOrderForm: StopOrderRequest;
  setOrderForm: (form: Partial<OrderRequest>) => void;
  submitOrder: () => Promise<void>;
  cancelOrder: (orderRef: string) => Promise<void>;
  cancelAllOrders: () => Promise<void>;
  reverseOrder: (orderRef: string) => Promise<void>;
  lockPosition: (instrumentId: string, volume: number) => Promise<void>;
}

// src/modules/query/store.ts - 查询状态
interface QueryStore {
  orders: OrderRecord[];
  trades: TradeRecord[];
  positions: PositionRecord[];
  account: AccountInfo | null;
  quotes: Map<string, QuoteDepth>;
  contracts: Map<string, ContractInfo>;
  stopOrders: StopOrder[];
  isPaused: boolean;  // 暂停更新
  setPaused: (paused: boolean) => void;
  addOrder: (order: OrderRecord) => void;  // 增量更新
  addTrade: (trade: TradeRecord) => void;  // 增量更新
  updatePosition: (position: PositionRecord) => void;
  updateAccount: (account: AccountInfo) => void;
  updateQuote: (quote: QuoteDepth) => void;
  updateContract: (contract: ContractInfo) => void;
  addStopOrder: (stopOrder: StopOrder) => void;
}
```

### 3.3 路由设计

本项目是单页面应用，不使用路由，采用多面板布局：

```
┌─────────────────────────────────────────────────────────────────┐
│ 顶部状态栏: [MD:●] [TD:●] [账户:123456] [余额:1,000,000]       │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│  行情面板（左侧70%）              │  报单面板（右侧30%）           │
│  - 合约搜索框                   │  - 合约选择                   │
│  - 行情表格（vtable）            │  - 报单表单                   │
│  - 五档行情                     │  - 快捷操作                   │
│  - K线图                        │                               │
│                                 │                               │
├─────────────────────────────────┴───────────────────────────────┤
│ 查询面板（底部）                                                 │
│ [报单流水] [成交流水] [持仓] [资金] [报价] [合约] [止损单]        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 后端设计

### 4.1 API结构

#### 4.1.1 FastAPI 应用结构

```python
# server/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import market, order, query, connection

app = FastAPI(title="Simnow Trader API", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite开发服务器
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(connection.router, prefix="/api/connection", tags=["connection"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(order.router, prefix="/api/order", tags=["order"])
app.include_router(query.router, prefix="/api/query", tags=["query"])
```

#### 4.1.2 API路由模块

| 模块 | 文件 | 路由前缀 | 职责 |
|------|------|----------|------|
| connection | connection.py | /api/connection | 登录、登出、状态查询 |
| market | market.py | /api/market | 合约列表、行情订阅、K线、五档深度 |
| order | order.py | /api/order | 报单、撤单、止损单、一键反向/锁仓 |
| query | query.py | /api/query | 报单流水、成交、持仓、资金、合约 |

### 4.2 CTP封装

#### 4.2.1 行情API封装

```python
# server/ctp/md_user_api.py
from openctp_ctp import mdapi

class MdUserApi:
    def __init__(self):
        self.api = None
        self.spi = None

    def connect(self, front_addr: str) -> bool:
        """连接行情前置"""
        self.api = mdapi.CThostFtdcMdApi.CreateFtdcMdApi()
        self.spi = MdSpi(self)
        self.api.RegisterSpi(self.spi)
        self.api.RegisterFront(front_addr)
        self.api.Init()
        return True

    def login(self, broker_id: str, user_id: str, password: str) -> bool:
        """登录"""
        req = mdapi.CThostFtdcReqUserLoginField()
        req.BrokerID = broker_id
        req.UserID = user_id
        req.Password = password
        return self.api.ReqUserLogin(req, 0) == 0

    def subscribe(self, instruments: list[str]) -> bool:
        """订阅行情"""
        return self.api.SubscribeMarketData(instruments, len(instruments)) == 0

    def unsubscribe(self, instruments: list[str]) -> bool:
        """退订行情"""
        return self.api.UnSubscribeMarketData(instruments, len(instruments)) == 0

class MdSpi(mdapi.CThostFtdcMdSpi):
    def __init__(self, api: MdUserApi):
        super().__init__()
        self.api = api

    def OnFrontConnected(self):
        """连接成功回调"""
        pass

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录响应"""
        pass

    def OnRtnDepthMarketData(self, pDepthMarketData):
        """行情数据回调"""
        pass
```

#### 4.2.2 交易API封装

```python
# server/ctp/trader_api.py
from openctp_ctp import traderapi

class TraderApi:
    def __init__(self):
        self.api = None
        self.spi = None

    def connect(self, front_addr: str) -> bool:
        """连接交易前置"""
        self.api = traderapi.CThostFtdcTraderApi.CreateFtdcTraderApi()
        self.spi = TraderSpi(self)
        self.api.RegisterSpi(self.spi)
        self.api.RegisterFront(front_addr)
        self.api.SubscribePublicTopic(traderapi.THOST_TERT_QUICK)
        self.api.SubscribePrivateTopic(traderapi.THOST_TERT_QUICK)
        self.api.Init()
        return True

    def login(self, broker_id: str, user_id: str, password: str) -> bool:
        """登录"""
        req = traderapi.CThostFtdcReqUserLoginField()
        req.BrokerID = broker_id
        req.UserID = user_id
        req.Password = password
        return self.api.ReqUserLogin(req, 0) == 0

    def insert_order(self, order: OrderRequest) -> str:
        """报单"""
        req = traderapi.CThostFtdcInputOrderField()
        req.InstrumentID = order.instrument_id
        req.Direction = order.direction
        req.CombOffsetFlag = order.offset
        req.LimitPrice = order.price
        req.VolumeTotalOriginal = order.volume
        req.OrderPriceType = order.order_type
        req.TimeCondition = order.time_condition
        self.api.ReqOrderInsert(req, 0)
        return req.OrderRef

    def cancel_order(self, order_ref: str) -> bool:
        """撤单"""
        req = traderapi.CThostFtdcInputOrderActionField()
        req.OrderRef = order_ref
        return self.api.ReqOrderAction(req, 0) == 0

    def query_orders(self) -> list[OrderRecord]:
        """查询报单流水"""
        req = traderapi.CThostFtdcQryOrderField()
        self.api.ReqQryOrder(req, 0)
        return []

    def query_trades(self) -> list[TradeRecord]:
        """查询成交流水"""
        req = traderapi.CThostFtdcQryTradeField()
        self.api.ReqQryTrade(req, 0)
        return []

    def query_positions(self) -> list[PositionRecord]:
        """查询持仓"""
        req = traderapi.CThostFtdcQryInvestorPositionField()
        self.api.ReqQryInvestorPosition(req, 0)
        return []

    def query_account(self) -> AccountInfo:
        """查询账户资金"""
        req = traderapi.CThostFtdcQryTradingAccountField()
        self.api.ReqQryTradingAccount(req, 0)
        return None

class TraderSpi(traderapi.CThostFtdcTraderSpi):
    def __init__(self, api: TraderApi):
        super().__init__()
        self.api = api

    def OnFrontConnected(self):
        """连接成功回调"""
        pass

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录响应"""
        pass

    def OnRtnOrder(self, pOrder):
        """报单回报"""
        pass

    def OnRtnTrade(self, pTrade):
        """成交回报"""
        pass
```

#### 4.2.3 回调处理

```python
# server/ctp/callback.py
from ws.manager import ws_manager

class CallbackHandler:
    def on_tick(self, data: MarketSnapshot):
        """行情回调"""
        # 1. 更新内存缓存
        # 2. 通过WebSocket推送给前端
        ws_manager.broadcast("market", "market_data", data)

    def on_order(self, data: OrderRecord):
        """报单回报"""
        ws_manager.broadcast("order", "order_return", data)

    def on_trade(self, data: TradeRecord):
        """成交回报"""
        ws_manager.broadcast("order", "trade_return", data)

    def on_position(self, data: PositionRecord):
        """持仓更新"""
        ws_manager.broadcast("position", "position_update", data)

    def on_stop_order(self, data: StopOrder):
        """止损单状态更新"""
        ws_manager.broadcast("stop", "stop_order_update", data)

    def on_connection_status(self, data: dict):
        """连接状态变化"""
        ws_manager.broadcast("system", "connection_status", data)

    def on_error(self, data: dict):
        """错误消息"""
        ws_manager.broadcast("system", "error", data)
```

### 4.3 WebSocket管理

#### 4.3.1 连接管理器

与design.md一致，采用分端点设计：

| 端点 | 消息类型 | 说明 |
|------|----------|------|
| `ws://localhost:8000/ws/market` | market_data | 行情推送 |
| `ws://localhost:8000/ws/order` | order_return, trade_return | 报单回报、成交回报 |
| `ws://localhost:8000/ws/position` | position_update | 持仓更新 |
| `ws://localhost:8000/ws/stop` | stop_order_update | 止损单状态更新 |
| `ws://localhost:8000/ws/system` | connection_status, error | 系统消息 |

```python
# server/ws/manager.py
from fastapi import WebSocket
from typing import Dict, List

class WebSocketManager:
    def __init__(self):
        # 按端点分组存储连接
        self.connections: Dict[str, List[WebSocket]] = {
            "market": [],
            "order": [],
            "position": [],
            "stop": [],
            "system": [],
        }

    async def connect(self, endpoint: str, websocket: WebSocket):
        """接受WebSocket连接"""
        await websocket.accept()
        if endpoint in self.connections:
            self.connections[endpoint].append(websocket)

    def disconnect(self, endpoint: str, websocket: WebSocket):
        """断开连接"""
        if endpoint in self.connections:
            self.connections[endpoint].remove(websocket)

    async def broadcast(self, endpoint: str, msg_type: str, data: dict):
        """广播消息给指定端点的所有连接"""
        message = {"type": msg_type, "data": data}
        if endpoint in self.connections:
            for connection in self.connections[endpoint]:
                try:
                    await connection.send_json(message)
                except:
                    self.connections[endpoint].remove(connection)

# 全局实例
ws_manager = WebSocketManager()
```

#### 4.3.2 WebSocket消息类型

```typescript
// 消息类型定义
type WSMessageType =
  | 'market_data'       // 行情推送
  | 'order_return'      // 报单回报
  | 'trade_return'      // 成交回报
  | 'position_update'   // 持仓更新
  | 'stop_order_update' // 止损单状态更新
  | 'connection_status' // 连接状态变化
  | 'error';            // 错误消息
```

---

## 5. 数据流设计

### 5.1 行情数据流

```
simnow柜台 → Python中间层(回调) → WebSocket推送 → 前端(缓冲区50ms) → vtable批量更新
```

### 5.2 报单数据流

```
前端(表单提交) → Python中间层(HTTP) → simnow柜台 → 回调通知 → WebSocket推送 → 前端(状态更新)
```

### 5.3 查询数据流

```
前端(查询请求) → Python中间层(HTTP) → simnow柜台 → 返回结果 → 前端(表格展示)
```

### 5.4 止损单数据流

```
前端(提交止损单) → Python中间层(HTTP) → 止损单监控服务 → 监控行情 → 触发报单 → WebSocket通知
```

---

## 6. 接口契约

### 6.1 REST API 契约

详细接口设计见design.md第4章。

### 6.2 WebSocket消息契约

```typescript
// 行情推送
interface MarketDataMessage {
  type: 'market_data';
  data: MarketSnapshot;
}

// 报单回报
interface OrderReturnMessage {
  type: 'order_return';
  data: OrderRecord;
}

// 成交回报
interface TradeReturnMessage {
  type: 'trade_return';
  data: TradeRecord;
}

// 持仓更新
interface PositionUpdateMessage {
  type: 'position_update';
  data: PositionRecord;
}

// 止损单状态更新
interface StopOrderUpdateMessage {
  type: 'stop_order_update';
  data: StopOrder;
}

// 连接状态变化
interface ConnectionStatusMessage {
  type: 'connection_status';
  data: {
    md_connected: boolean;
    td_connected: boolean;
    message: string;
  };
}

// 错误消息
interface ErrorMessage {
  type: 'error';
  data: {
    code: string;
    message: string;
    related_ref?: string;
  };
}
```

---

## 7. 错误处理策略

### 7.1 错误码定义

与design.md保持一致，使用字符串错误码：

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

错误响应格式：
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

### 7.2 前端错误处理

```typescript
// src/services/api.ts
axios.interceptors.response.use(
  response => response,
  error => {
    const errorCode = error.response?.data?.error?.code || 'INTERNAL_ERROR';
    const errorMsg = error.response?.data?.error?.message || '网络异常';
    // 显示错误提示
    showErrorToast(errorMsg);
    return Promise.reject(error);
  }
);
```

### 7.3 后端错误处理

```python
# server/main.py
from fastapi import HTTPException

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "系统异常"
            }
        }
    )
```

---

## 8. 性能优化策略

### 8.1 行情数据优化

| 策略 | 说明 | 实现位置 |
|------|------|----------|
| 批量更新 | 每50ms从缓冲区取出最新数据，批量更新vtable | market/store.ts |
| 增量渲染 | 只更新变化的单元格，不全行重绘 | MarketTable.tsx |
| 虚拟滚动 | 只渲染可视区域，减少DOM节点 | MarketTable.tsx |
| 数据对象池 | 行情数据对象复用，避免频繁创建/销毁 | market/store.ts |
| 订阅限制 | 限制最大同时订阅合约数（500个） | market/store.ts |

### 8.2 查询数据优化

| 策略 | 说明 | 实现位置 |
|------|------|----------|
| 增量更新 | 新数据插入顶部，不重新渲染整个列表 | query/store.ts |
| 新数据高亮 | 新数据背景色闪烁（持续2秒） | OrderFlow.tsx |
| 自动滚动 | 新数据自动滚动到可视区域 | QueryPanel.tsx |
| 暂停更新 | 用户可暂停自动更新 | QueryPanel.tsx |

### 8.3 内存优化

| 策略 | 说明 |
|------|------|
| 数据对象池 | 行情数据对象复用，避免频繁创建/销毁 |
| 订阅限制 | 限制最大同时订阅合约数（500个） |
| 数据过期清理 | 退订后及时清理对应合约的内存数据 |
| vtable虚拟滚动 | 仅渲染可视区域，减少DOM节点数量 |

---

## 9. 开发规范

### 9.1 代码风格

#### 前端（TypeScript）
- 使用ESLint + Prettier格式化代码
- 组件使用函数式组件 + Hooks
- 状态管理使用Zustand
- 类型定义使用TypeScript接口

#### 后端（Python）
- 使用Black格式化代码
- 使用isort整理导入
- 类型注解使用Python 3.10+语法
- 异步函数使用async/await

### 9.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | MarketTable.tsx |
| Hook | camelCase，use前缀 | useHotKeys.ts |
| Store | camelCase，Store后缀 | marketStore.ts |
| API路由 | snake_case | /api/market/subscribe |
| 数据模型 | PascalCase | MarketSnapshot |
| 常量 | UPPER_SNAKE_CASE | MAX_SUBSCRIBE_COUNT |

### 9.3 Git提交规范

```
<type>(<scope>): <subject>

类型(type):
- feat: 新功能
- fix: Bug修复
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- test: 测试相关
- chore: 构建/工具相关

示例:
feat(market): 添加五档行情展示
fix(order): 修复一键反向功能
docs(dev): 更新开发文档
```

### 9.4 分支命名规范

```
feature/pr-{编号}-{简短描述}

示例:
feature/pr-1-login
feature/pr-2-market-api
feature/pr-3-market-ui
```

---

## 10. 开发日志

| 日期 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 2026-07-08 | v1.0 | 初始化dev.md：代码目录结构、前端设计、后端设计、技术规范 | ✅ 完成 |
| 2026-07-08 | v1.1 | CTP绑定改为openctp-ctp、错误码与design.md统一、WebSocket分端点设计、补充data目录和options.py | ✅ 完成 |
| 2026-07-08 | v1.2 | 后端目录CTP封装层描述更新为openctp-ctp | ✅ 完成 |
| 2026-07-08 | v1.3 | 补充QuoteQuery、ContractQuery、StopOrderList组件职责说明 | ✅ 完成 |
| 2026-07-08 | v1.4 | 回调处理代码更新为WebSocket分端点调用 | ✅ 完成 |
| 2026-07-08 | v1.5 | 补充stop_order_update、connection_status、error消息契约定义 | ✅ 完成 |
| 2026-07-08 | v1.6 | 错误处理代码更新为与错误码定义一致的字段名 | ✅ 完成 |
