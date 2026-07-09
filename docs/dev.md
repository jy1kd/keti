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
import logging
from typing import Callable, Optional
from openctp_ctp import mdapi

logger = logging.getLogger(__name__)

class MdUserApi:
    """行情API封装"""

    def __init__(self, on_market_data: Optional[Callable] = None):
        self.api: Optional[mdapi.CThostFtdcMdApi] = None
        self.spi: Optional['MdSpi'] = None
        self.request_id: int = 0
        self.on_market_data = on_market_data  # 行情数据回调

    def connect(self, front_addr: str) -> bool:
        """连接行情前置"""
        try:
            # 创建API实例（flow_path为流文件目录，空字符串表示当前目录）
            self.api = mdapi.CThostFtdcMdApi.CreateFtdcMdApi()
            self.spi = MdSpi(self)
            self.api.RegisterSpi(self.spi)
            self.api.RegisterFront(front_addr)
            self.api.Init()
            logger.info(f"行情API初始化完成，前置地址: {front_addr}")
            return True
        except Exception as e:
            logger.error(f"行情API连接失败: {e}")
            return False

    def login(self, broker_id: str, user_id: str, password: str) -> bool:
        """登录行情服务器"""
        try:
            req = mdapi.CThostFtdcReqUserLoginField()
            req.BrokerID = broker_id
            req.UserID = user_id
            req.Password = password
            self.request_id += 1
            ret = self.api.ReqUserLogin(req, self.request_id)
            if ret == 0:
                logger.info(f"行情登录请求已发送，用户: {user_id}")
                return True
            else:
                logger.error(f"行情登录请求失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"行情登录异常: {e}")
            return False

    def subscribe(self, instruments: list[str]) -> bool:
        """订阅行情"""
        try:
            # 注意：合约代码需要转换为字节串
            ret = self.api.SubscribeMarketData(
                [i.encode('utf-8') for i in instruments],
                len(instruments)
            )
            if ret == 0:
                logger.info(f"行情订阅成功: {instruments}")
                return True
            else:
                logger.error(f"行情订阅失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"行情订阅异常: {e}")
            return False

    def unsubscribe(self, instruments: list[str]) -> bool:
        """退订行情"""
        try:
            ret = self.api.UnSubscribeMarketData(
                [i.encode('utf-8') for i in instruments],
                len(instruments)
            )
            if ret == 0:
                logger.info(f"行情退订成功: {instruments}")
                return True
            else:
                logger.error(f"行情退订失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"行情退订异常: {e}")
            return False

    def release(self):
        """释放API资源"""
        if self.api:
            self.api.Release()
            logger.info("行情API资源已释放")


class MdSpi(mdapi.CThostFtdcMdSpi):
    """行情SPI回调处理"""

    def __init__(self, api: MdUserApi):
        super().__init__()
        self.api = api

    def OnFrontConnected(self):
        """连接成功回调 - 触发登录"""
        logger.info("行情前置机连接成功")
        # 由上层调用login方法

    def OnFrontDisconnected(self, nReason: int):
        """连接断开回调"""
        logger.warning(f"行情前置机连接断开，原因: {nReason}")
        # 触发重连机制

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"行情登录失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        logger.info(f"行情登录成功，交易日: {pRspUserLogin.TradingDay}")

    def OnRspUserLogout(self, pUserLogout, pRspInfo, nRequestID, bIsLast):
        """登出响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"行情登出失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        logger.info("行情登出成功")

    def OnRspSubMarketData(self, pSpecificInstrument, pRspInfo, nRequestID, bIsLast):
        """订阅行情响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"订阅行情失败: {pRspInfo.ErrorMsg}")
            return
        logger.info(f"订阅行情成功: {pSpecificInstrument.InstrumentID}")

    def OnRspUnSubMarketData(self, pSpecificInstrument, pRspInfo, nRequestID, bIsLast):
        """退订行情响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"退订行情失败: {pRspInfo.ErrorMsg}")
            return
        logger.info(f"退订行情成功: {pSpecificInstrument.InstrumentID}")

    def OnRtnDepthMarketData(self, pDepthMarketData):
        """行情数据推送回调 - 核心回调"""
        if self.api.on_market_data:
            # 转换为统一格式并回调
            data = {
                'instrument_id': pDepthMarketData.InstrumentID,
                'last_price': pDepthMarketData.LastPrice,
                'bid_price1': pDepthMarketData.BidPrice1,
                'bid_volume1': pDepthMarketData.BidVolume1,
                'ask_price1': pDepthMarketData.AskPrice1,
                'ask_volume1': pDepthMarketData.AskVolume1,
                'volume': pDepthMarketData.Volume,
                'open_interest': pDepthMarketData.OpenInterest,
                'update_time': pDepthMarketData.UpdateTime,
            }
            self.api.on_market_data(data)

    def OnRspError(self, pRspInfo, nRequestID, bIsLast):
        """错误响应"""
        if pRspInfo:
            logger.error(f"行情API错误: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
```

#### 4.2.2 交易API封装

```python
# server/ctp/trader_api.py
import logging
from typing import Callable, Optional
from openctp_ctp import traderapi

logger = logging.getLogger(__name__)

class TraderApi:
    """交易API封装 - 包含穿透式认证流程"""

    def __init__(self, callbacks: Optional[dict] = None):
        self.api: Optional[traderapi.CThostFtdcTraderApi] = None
        self.spi: Optional['TraderSpi'] = None
        self.request_id: int = 0
        self.broker_id: str = ""
        self.user_id: str = ""
        self.password: str = ""
        self.app_id: str = ""
        self.auth_code: str = ""
        self.callbacks = callbacks or {}

    def connect(self, front_addr: str, app_id: str, auth_code: str) -> bool:
        """连接交易前置（穿透式认证）"""
        try:
            self.app_id = app_id
            self.auth_code = auth_code
            # 创建API实例
            self.api = traderapi.CThostFtdcTraderApi.CreateFtdcTraderApi()
            self.spi = TraderSpi(self)
            self.api.RegisterSpi(self.spi)
            self.api.RegisterFront(front_addr)
            # 订阅私有流和公有流（QUICK模式：只传送登录后产生的数据）
            self.api.SubscribePublicTopic(traderapi.THOST_TERT_QUICK)
            self.api.SubscribePrivateTopic(traderapi.THOST_TERT_QUICK)
            self.api.Init()
            logger.info(f"交易API初始化完成，前置地址: {front_addr}")
            return True
        except Exception as e:
            logger.error(f"交易API连接失败: {e}")
            return False

    def authenticate(self) -> bool:
        """客户端认证（穿透式监管）"""
        try:
            req = traderapi.CThostFtdcReqAuthenticateField()
            req.BrokerID = self.broker_id
            req.UserID = self.user_id
            req.AppID = self.app_id
            req.AuthCode = self.auth_code
            self.request_id += 1
            ret = self.api.ReqAuthenticate(req, self.request_id)
            if ret == 0:
                logger.info("客户端认证请求已发送")
                return True
            else:
                logger.error(f"客户端认证请求失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"客户端认证异常: {e}")
            return False

    def login(self, broker_id: str, user_id: str, password: str) -> bool:
        """登录交易服务器"""
        try:
            self.broker_id = broker_id
            self.user_id = user_id
            self.password = password
            req = traderapi.CThostFtdcReqUserLoginField()
            req.BrokerID = broker_id
            req.UserID = user_id
            req.Password = password
            self.request_id += 1
            ret = self.api.ReqUserLogin(req, self.request_id)
            if ret == 0:
                logger.info(f"交易登录请求已发送，用户: {user_id}")
                return True
            else:
                logger.error(f"交易登录请求失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"交易登录异常: {e}")
            return False

    def confirm_settlement(self) -> bool:
        """确认结算信息"""
        try:
            req = traderapi.CThostFtdcSettlementInfoConfirmField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            self.request_id += 1
            ret = self.api.ReqSettlementInfoConfirm(req, self.request_id)
            if ret == 0:
                logger.info("结算信息确认请求已发送")
                return True
            else:
                logger.error(f"结算信息确认失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"结算信息确认异常: {e}")
            return False

    def insert_order(self, order: OrderRequest) -> str:
        """报单"""
        try:
            req = traderapi.CThostFtdcInputOrderField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            req.InstrumentID = order.instrument_id
            req.Direction = order.direction  # '0'=买, '1'=卖
            req.CombOffsetFlag = order.offset  # '0'=开仓, '1'=平仓, '3'=平今
            req.LimitPrice = order.price
            req.VolumeTotalOriginal = order.volume
            req.OrderPriceType = order.order_type  # '1'=市价, '2'=限价
            req.TimeCondition = order.time_condition  # '1'=IOC, '3'=GFD
            req.VolumeCondition = '1'  # '1'=任何数量, '2'=最小数量, '3'=全部数量
            req.ContingentCondition = '1'  # '1'=立即
            req.ForceCloseReason = '0'  # '0'=非强平
            req.IsAutoSuspend = 0
            req.UserForceClose = 0
            self.request_id += 1
            ret = self.api.ReqOrderInsert(req, self.request_id)
            if ret == 0:
                logger.info(f"报单请求已发送: {order.instrument_id} {order.direction} {order.volume}@{order.price}")
                return req.OrderRef
            else:
                logger.error(f"报单请求失败，返回值: {ret}")
                return ""
        except Exception as e:
            logger.error(f"报单异常: {e}")
            return ""

    def cancel_order(self, order_ref: str, instrument_id: str, exchange_id: str) -> bool:
        """撤单"""
        try:
            req = traderapi.CThostFtdcInputOrderActionField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            req.OrderRef = order_ref
            req.InstrumentID = instrument_id
            req.ExchangeID = exchange_id
            req.ActionFlag = '0'  # '0'=删除
            self.request_id += 1
            ret = self.api.ReqOrderAction(req, self.request_id)
            if ret == 0:
                logger.info(f"撤单请求已发送: {order_ref}")
                return True
            else:
                logger.error(f"撤单请求失败，返回值: {ret}")
                return False
        except Exception as e:
            logger.error(f"撤单异常: {e}")
            return False

    def query_instruments(self) -> bool:
        """查询合约列表"""
        try:
            req = traderapi.CThostFtdcQryInstrumentField()
            # 空请求表示查询所有合约
            self.request_id += 1
            ret = self.api.ReqQryInstrument(req, self.request_id)
            return ret == 0
        except Exception as e:
            logger.error(f"查询合约异常: {e}")
            return False

    def query_orders(self) -> bool:
        """查询报单流水"""
        try:
            req = traderapi.CThostFtdcQryOrderField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            self.request_id += 1
            ret = self.api.ReqQryOrder(req, self.request_id)
            return ret == 0
        except Exception as e:
            logger.error(f"查询报单异常: {e}")
            return False

    def query_trades(self) -> bool:
        """查询成交流水"""
        try:
            req = traderapi.CThostFtdcQryTradeField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            self.request_id += 1
            ret = self.api.ReqQryTrade(req, self.request_id)
            return ret == 0
        except Exception as e:
            logger.error(f"查询成交异常: {e}")
            return False

    def query_positions(self) -> bool:
        """查询持仓"""
        try:
            req = traderapi.CThostFtdcQryInvestorPositionField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            self.request_id += 1
            ret = self.api.ReqQryInvestorPosition(req, self.request_id)
            return ret == 0
        except Exception as e:
            logger.error(f"查询持仓异常: {e}")
            return False

    def query_account(self) -> bool:
        """查询账户资金"""
        try:
            req = traderapi.CThostFtdcQryTradingAccountField()
            req.BrokerID = self.broker_id
            req.InvestorID = self.user_id
            self.request_id += 1
            ret = self.api.ReqQryTradingAccount(req, self.request_id)
            return ret == 0
        except Exception as e:
            logger.error(f"查询资金异常: {e}")
            return False

    def release(self):
        """释放API资源"""
        if self.api:
            self.api.Release()
            logger.info("交易API资源已释放")


class TraderSpi(traderapi.CThostFtdcTraderSpi):
    """交易SPI回调处理"""

    def __init__(self, api: TraderApi):
        super().__init__()
        self.api = api

    def OnFrontConnected(self):
        """连接成功回调 - 触发认证"""
        logger.info("交易前置机连接成功，开始客户端认证")
        # 穿透式认证流程：连接成功后先认证
        self.api.authenticate()

    def OnFrontDisconnected(self, nReason: int):
        """连接断开回调"""
        logger.warning(f"交易前置机连接断开，原因: {nReason}")
        # 触发重连机制

    def OnRspAuthenticate(self, pRspAuthenticateField, pRspInfo, nRequestID, bIsLast):
        """认证响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"客户端认证失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        logger.info("客户端认证成功，开始登录")
        # 认证成功后登录
        self.api.login(self.api.broker_id, self.api.user_id, self.api.password)

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"交易登录失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        logger.info(f"交易登录成功，交易日: {pRspUserLogin.TradingDay}")
        # 登录成功后确认结算信息
        self.api.confirm_settlement()

    def OnRspSettlementInfoConfirm(self, pSettlementInfoConfirm, pRspInfo, nRequestID, bIsLast):
        """结算信息确认响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"结算信息确认失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        logger.info("结算信息确认成功")
        # 触发登录完成回调
        if 'on_login' in self.api.callbacks:
            self.api.callbacks['on_login']()

    def OnRtnOrder(self, pOrder):
        """报单回报"""
        if pOrder:
            data = {
                'order_ref': pOrder.OrderRef,
                'instrument_id': pOrder.InstrumentID,
                'direction': pOrder.Direction,
                'offset': pCombOffsetFlag,
                'price': pOrder.LimitPrice,
                'volume': pOrder.VolumeTotalOriginal,
                'volume_traded': pOrder.VolumeTraded,
                'order_status': pOrder.OrderStatus,
                'status_msg': pOrder.StatusMsg,
                'insert_time': pOrder.InsertTime,
            }
            logger.info(f"报单回报: {data}")
            if 'on_order' in self.api.callbacks:
                self.api.callbacks['on_order'](data)

    def OnRtnTrade(self, pTrade):
        """成交回报"""
        if pTrade:
            data = {
                'trade_id': pTrade.TradeID,
                'order_ref': pTrade.OrderRef,
                'instrument_id': pTrade.InstrumentID,
                'direction': pTrade.Direction,
                'offset': pTrade.OffsetFlag,
                'price': pTrade.Price,
                'volume': pTrade.Volume,
                'trade_time': pTrade.TradeTime,
            }
            logger.info(f"成交回报: {data}")
            if 'on_trade' in self.api.callbacks:
                self.api.callbacks['on_trade'](data)

    def OnRspQryInstrument(self, pInstrument, pRspInfo, nRequestID, bIsLast):
        """合约查询响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"查询合约失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        if pInstrument:
            data = {
                'instrument_id': pInstrument.InstrumentID,
                'instrument_name': pInstrument.InstrumentName,
                'exchange_id': pInstrument.ExchangeID,
                'product_id': pInstrument.ProductID,
                'volume_multiple': pInstrument.VolumeMultiple,
                'price_tick': pInstrument.PriceTick,
                'expire_date': pInstrument.ExpireDate,
                'is_trading': pInstrument.IsTrading,
            }
            if 'on_instrument' in self.api.callbacks:
                self.api.callbacks['on_instrument'](data, bIsLast)

    def OnRspQryInvestorPosition(self, pInvestorPosition, pRspInfo, nRequestID, bIsLast):
        """持仓查询响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"查询持仓失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        if pInvestorPosition:
            data = {
                'instrument_id': pInvestorPosition.InstrumentID,
                'direction': pInvestorPosition.PosiDirection,
                'position': pInvestorPosition.Position,
                'today_position': pInvestorPosition.TodayPosition,
                'yd_position': pInvestorPosition.YdPosition,
                'position_cost': pInvestorPosition.PositionCost,
            }
            if 'on_position' in self.api.callbacks:
                self.api.callbacks['on_position'](data, bIsLast)

    def OnRspQryTradingAccount(self, pTradingAccount, pRspInfo, nRequestID, bIsLast):
        """资金查询响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            logger.error(f"查询资金失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return
        if pTradingAccount:
            data = {
                'account_id': pTradingAccount.AccountID,
                'balance': pTradingAccount.Balance,
                'available': pTradingAccount.Available,
                'frozen_margin': pTradingAccount.FrozenMargin,
                'commission': pTradingAccount.Commission,
                'close_profit': pTradingAccount.CloseProfit,
                'position_profit': pTradingAccount.PositionProfit,
            }
            if 'on_account' in self.api.callbacks:
                self.api.callbacks['on_account'](data)

    def OnRspError(self, pRspInfo, nRequestID, bIsLast):
        """错误响应"""
        if pRspInfo:
            logger.error(f"交易API错误: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")

    def OnErrRtnOrderInsert(self, pInputOrder, pRspInfo):
        """报单错误回报"""
        if pRspInfo:
            logger.error(f"报单错误: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            if 'on_error' in self.api.callbacks:
                self.api.callbacks['on_error']({
                    'code': pRspInfo.ErrorID,
                    'message': pRspInfo.ErrorMsg,
                })
```

#### 4.2.3 回调处理

```python
# server/ctp/callback.py
import logging
from ws.manager import ws_manager
from services.market_service import MarketService
from services.order_manager import OrderManager

logger = logging.getLogger(__name__)

class CallbackHandler:
    """CTP回调处理 - 将CTP回调转换为WebSocket消息"""

    def __init__(self, market_service: MarketService, order_manager: OrderManager):
        self.market_service = market_service
        self.order_manager = order_manager

    def on_market_data(self, data: dict):
        """行情回调"""
        instrument_id = data['instrument_id']
        # 1. 更新内存缓存
        self.market_service.update_snapshot(instrument_id, data)
        # 2. 通过WebSocket推送给前端
        ws_manager.broadcast("market", "market_data", data)

    def on_order(self, data: dict):
        """报单回报"""
        # 1. 更新报单管理器状态
        self.order_manager.update_order(data)
        # 2. 通过WebSocket推送给前端
        ws_manager.broadcast("order", "order_return", data)

    def on_trade(self, data: dict):
        """成交回报"""
        # 1. 更新报单管理器
        self.order_manager.update_trade(data)
        # 2. 通过WebSocket推送给前端
        ws_manager.broadcast("order", "trade_return", data)

    def on_position(self, data: dict):
        """持仓更新"""
        ws_manager.broadcast("position", "position_update", data)

    def on_account(self, data: dict):
        """账户资金更新"""
        ws_manager.broadcast("position", "account_update", data)

    def on_stop_order(self, data: dict):
        """止损单状态更新"""
        ws_manager.broadcast("stop", "stop_order_update", data)

    def on_connection_status(self, data: dict):
        """连接状态变化"""
        ws_manager.broadcast("system", "connection_status", data)

    def on_error(self, data: dict):
        """错误消息"""
        ws_manager.broadcast("system", "error", data)

    def on_login(self):
        """登录成功回调"""
        logger.info("交易登录成功，开始加载合约列表")
        # 触发合约列表加载
        self.market_service.load_instruments()
        # 通知前端连接状态
        self.on_connection_status({
            'td_connected': True,
            'message': '交易登录成功'
        })
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

## 10. 交付物

与prd.md保持一致，项目交付物包括：

| 序号 | 交付物 | 说明 |
|------|--------|------|
| 1 | 前端代码 | React + TypeScript + Vite，包含所有前端模块和组件 |
| 2 | Python中间层代码 | FastAPI + openctp-ctp，包含API接口、CTP封装、WebSocket管理 |
| 3 | 项目文档 | README.md（项目说明、环境搭建、启动方式）、API文档 |
| 4 | 测试用例文档 | 单元测试、集成测试、E2E测试用例 |

---

## 11. 开发日志

| 日期 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 2026-07-08 | v1.0 | 初始化dev.md：代码目录结构、前端设计、后端设计、技术规范 | ✅ 完成 |
| 2026-07-08 | v1.1 | CTP绑定改为openctp-ctp、错误码与design.md统一、WebSocket分端点设计、补充data目录和options.py | ✅ 完成 |
| 2026-07-08 | v1.2 | 后端目录CTP封装层描述更新为openctp-ctp | ✅ 完成 |
| 2026-07-08 | v1.3 | 补充QuoteQuery、ContractQuery、StopOrderList组件职责说明 | ✅ 完成 |
| 2026-07-08 | v1.4 | 回调处理代码更新为WebSocket分端点调用 | ✅ 完成 |
| 2026-07-08 | v1.5 | 补充stop_order_update、connection_status、error消息契约定义 | ✅ 完成 |
| 2026-07-08 | v1.6 | 错误处理代码更新为与错误码定义一致的字段名 | ✅ 完成 |
