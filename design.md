# Design: 上期所Simnow模拟交易终端

## 1. 架构设计

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  行情面板    │  │  报单面板    │  │  查询面板    │             │
│  │  (vtable)   │  │  (表单)      │  │  (表格)      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                    ┌─────┴─────┐                                │
│                    │ React App │                                │
│                    │ + TypeScript│                              │
│                    └─────┬─────┘                                │
└──────────────────────────┼──────────────────────────────────────┘
                           │
              HTTP REST    │    WebSocket
            ┌──────────────┼──────────────┐
            │              │              │
┌───────────┴──────────────┴──────────────┴───────────┐
│                   Python 中间层                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  FastAPI     │  │  WebSocket  │  │  CTP 封装层  │ │
│  │  (REST API)  │  │  Manager    │  │  (ctypes)   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │         │
│         └────────────────┼────────────────┘         │
│                          │                          │
│                    ┌─────┴─────┐                    │
│                    │ CTP Connection│                │
│                    └─────┬─────┘                    │
└──────────────────────────┼──────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────┴───┐  ┌────┴────┐  ┌───┴─────┐
     │  mduserapi  │  │traderapi│  │  simnow │
     │  (行情API)   │  │(交易API) │  │  柜台    │
     └─────────────┘  └─────────┘  └─────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.x | UI框架 |
| 前端语言 | TypeScript | 5.x | 类型安全 |
| 构建工具 | Vite | 5.x | 开发和构建 |
| 表格组件 | @visactor/vtable | latest | 高性能表格 |
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
│   └── OrderForm/        # 报单表单
├── modules/              # 业务模块
│   ├── market/           # 行情模块
│   │   ├── MarketPanel.tsx
│   │   ├── MarketTable.tsx (vtable)
│   │   └── store.ts
│   ├── order/            # 报单模块
│   │   ├── OrderPanel.tsx
│   │   ├── OrderForm.tsx
│   │   └── store.ts
│   └── query/            # 查询模块
│       ├── QueryPanel.tsx
│       ├── OrderFlow.tsx
│       ├── TradeFlow.tsx
│       ├── Position.tsx
│       └── store.ts
├── services/             # API服务层
│   ├── api.ts            # REST API封装
│   ├── ws.ts             # WebSocket管理
│   └── types.ts          # 类型定义
├── stores/               # 全局状态
│   ├── connection.ts     # 连接状态
│   └── contracts.ts      # 合约列表
├── App.tsx               # 主应用
└── main.tsx              # 入口
```

### 2.2 后端模块

```
server/
├── api/                  # API路由
│   ├── market.py         # 行情相关接口
│   ├── order.py          # 报单相关接口
│   ├── query.py          # 查询相关接口
│   └── connection.py     # 连接管理接口
├── ctp/                  # CTP封装层
│   ├── md_user_api.py    # 行情API封装
│   ├── trader_api.py     # 交易API封装
│   ├── callback.py       # 回调处理
│   └── types.py          # CTP数据类型
├── ws/                   # WebSocket管理
│   ├── manager.py        # 连接管理
│   └── handlers.py       # 消息处理
├── models/               # 数据模型
│   ├── market.py         # 行情数据模型
│   ├── order.py          # 报单数据模型
│   └── account.py        # 账户数据模型
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

**数据格式**：
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

### 3.2 报单数据流

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

**报单请求格式**：
```json
{
  "instrument_id": "au2406",
  "direction": "buy",           // buy/sell
  "offset": "open",             // open/close/close_today
  "price": 480.50,
  "volume": 1,
  "order_type": "limit",        // limit/market/stop/fok/fak
  "stop_price": null            // 止损价（止损单时必填）
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

---

## 4. 接口设计

### 4.1 连接管理接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/connection/login` | 登录simnow | `{broker_id, user_id, password, md_front, td_front}` | `{success, message}` |
| POST | `/api/connection/logout` | 登出 | - | `{success}` |
| GET | `/api/connection/status` | 获取连接状态 | - | `{md_connected, td_connected}` |

### 4.2 行情接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/market/instruments` | 获取合约列表 | - | `[{instrument_id, instrument_name, exchange_id}]` |
| POST | `/api/market/subscribe` | 订阅行情 | `{instruments: ["au2406", "rb2406"]}` | `{success}` |
| POST | `/api/market/unsubscribe` | 退订行情 | `{instruments: ["au2406"]}` | `{success}` |
| GET | `/api/market/snapshots` | 获取行情快照 | `?instruments=au2406,rb2406` | `{[instrument_id]: MarketSnapshot}` |

**WebSocket推送**：`ws://localhost:8000/ws/market`
- 连接后自动推送已订阅合约的行情更新
- 消息格式：`{type: "market_data", data: MarketSnapshot}`

### 4.3 报单接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/order/insert` | 报单 | `OrderRequest` | `{order_ref, success, message}` |
| POST | `/api/order/cancel` | 撤单 | `{order_ref}` | `{success, message}` |
| GET | `/api/order/status/{order_ref}` | 查询单个报单状态 | - | `OrderStatus` |

### 4.4 查询接口

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/query/orders` | 查询报单流水 | - | `[OrderRecord]` |
| GET | `/api/query/trades` | 查询成交流水 | - | `[TradeRecord]` |
| GET | `/api/query/positions` | 查询持仓 | - | `[PositionRecord]` |
| GET | `/api/query/account` | 查询账户资金 | - | `AccountInfo` |

### 4.5 数据模型

**OrderRequest**：
```typescript
interface OrderRequest {
  instrument_id: string;      // 合约代码
  direction: 'buy' | 'sell';  // 买卖方向
  offset: 'open' | 'close' | 'close_today'; // 开平标志
  price: number;              // 报单价格
  volume: number;             // 报单数量
  order_type: 'limit' | 'market' | 'stop' | 'fok' | 'fak';
  stop_price?: number;        // 止损价（止损单时必填）
}
```

**MarketSnapshot**：
```typescript
interface MarketSnapshot {
  instrument_id: string;
  last_price: number;
  bid_price1: number;
  bid_volume1: number;
  ask_price1: number;
  ask_volume1: number;
  volume: number;
  open_interest: number;
  open_price: number;
  high_price: number;
  low_price: number;
  pre_close_price: number;
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
| UT-04 | 市价报单 | {order_type:"market"} | 返回order_ref | P0 |
| UT-05 | 撤单 | {order_ref:"123456"} | 返回success=true | P0 |
| UT-06 | 参数校验-价格为负 | {price:-1} | 返回错误"价格必须大于0" | P0 |
| UT-07 | 参数校验-数量为0 | {volume:0} | 返回错误"数量必须大于0" | P0 |
| UT-08 | 合约搜索 | 搜索"au" | 返回匹配合约列表 | P1 |

### 6.2 集成测试

| 测试ID | 测试项 | 测试步骤 | 预期结果 | 优先级 |
|--------|--------|----------|----------|--------|
| IT-01 | 登录流程 | 1.调用登录接口 2.检查连接状态 | md_connected=true, td_connected=true | P0 |
| IT-02 | 行情推送 | 1.订阅au2406 2.等待WebSocket推送 | 收到market_data消息 | P0 |
| IT-03 | 完整报单流程 | 1.报单 2.查询报单流水 3.查询成交流水 | 报单记录和成交记录正确 | P0 |
| IT-04 | 报单撤单流程 | 1.报单 2.撤单 3.查询状态 | order_status=canceled | P0 |
| IT-05 | 止损单触发 | 1.设置止损单 2.等待价格触发 | 自动触发报单 | P1 |

### 6.3 E2E测试

| 测试ID | 测试项 | 测试步骤 | 预期结果 | 优先级 |
|--------|--------|----------|----------|--------|
| E2E-01 | 完整交易流程 | 1.登录 2.订阅行情 3.报单 4.查询 | 全流程正常 | P0 |
| E2E-02 | 多合约行情 | 1.订阅10个合约 2.观察表格 | 表格流畅更新 | P1 |
| E2E-03 | 异常恢复 | 1.断开网络 2.恢复网络 3.验证重连 | 自动重连成功 | P2 |

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
pnpm add @visactor/vtable zustand axios

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
2. 下载API：https://www.simnow.com.cn/static/apiDownload.action
3. 将DLL文件放到项目目录：
   - `thostmduserapi_se.dll`（行情API）
   - `thosttraderapi_se.dll`（交易API）

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

## 8. 开发日志

| 日期 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 2026-07-07 | v0.1 | 架构设计、接口设计、数据模型 | ✅ 完成 |
| - | v0.2 | Python中间层开发 | ⏳ 待开始 |
| - | v0.3 | 前端行情模块开发 | ⏳ 待开始 |
| - | v0.4 | 前端报单模块开发 | ⏳ 待开始 |
| - | v0.5 | 前端查询模块开发 | ⏳ 待开始 |
| - | v0.6 | 联调测试 | ⏳ 待开始 |

---

## 9. 方案取舍总结

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
