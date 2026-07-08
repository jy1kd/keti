# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

上期所Simnow模拟交易终端 - 一个简易桌面交易终端（浏览器Web应用），对接上期所simnow模拟柜台，实现行情接入、交易接入、手动报单等功能。

## 技术栈

- **前端**：React + TypeScript + Vite
- **表格组件**：字节@visactor/vtable（高性能渲染，支持1000+合约）
- **状态管理**：Zustand
- **后端**：Python FastAPI + WebSocket
- **CTP对接**：ctypes调用C++ DLL（thostmduserapi_se.dll、thosttraderapi_se.dll）

## 项目结构

```
├── prd.md              # 产品需求文档
├── design.md           # 技术架构设计文档
├── dev.md              # 项目设计稿（待编写）
├── task.md             # PR任务拆分（待编写）
├── ai-log.md           # AI协作记录（在.gitignore中）
├── mis.md              # 项目开发流程规范（在.gitignore中）
├── trader/             # simnow API文件（在.gitignore中）
│   ├── mduserapi/      # 行情API
│   └── traderapi/      # 交易API
├── frontend/           # 前端代码（待创建）
└── server/             # 后端代码（待创建）
```

## 开发流程

按照mis.md中的流程规范，文档编写顺序：
1. prd.md → 2. design.md → 3. dev.md → 4. task.md → 5. 任务实现

### 角色分工
- **角色A**：后端开发、API接口、CTP对接、系统架构
- **角色B**：前端开发、UI组件、交互逻辑、性能优化

### Git分支策略
- 分支命名：`feature/pr-{编号}-{简短描述}`
- 示例：`feature/pr-1-login`

## 核心模块

### F1: 行情模块
- 实时行情表格（vtable）
- 五档行情展示
- K线图展示（多周期、技术指标）
- 期权T型报价（含波动率）

### F2: 报单模块
- 报单类型：限价、市价、止损、FOK、FAK、GFD
- 点价报单：单击/双击行情表格直接报单
- 快捷操作：一键反向、一键锁仓、点击持仓平仓
- 快捷键：B=买，S=卖，C=撤单（仅报单面板焦点时生效）

### F3: 查询模块
- 报单流水、成交流水、持仓、资金、报价（五档深度）、合约查询

## 接口设计

### 行情接口
- `GET /api/market/instruments` - 获取合约列表
- `POST /api/market/subscribe` - 订阅行情
- `GET /api/market/snapshots` - 获取行情快照
- `GET /api/market/kline` - 获取K线数据
- `GET /api/market/depth` - 获取五档行情深度

### 报单接口
- `POST /api/order/insert` - 报单
- `POST /api/order/cancel` - 撤单
- `POST /api/order/cancel_all` - 批量撤单
- `POST /api/order/reverse` - 一键反向
- `POST /api/order/lock` - 一键锁仓
- `POST /api/order/stop` - 提交止损单

### 查询接口
- `GET /api/query/orders` - 查询报单流水
- `GET /api/query/trades` - 查询成交流水
- `GET /api/query/positions` - 查询持仓
- `GET /api/query/quotes` - 查询五档行情深度

## 数据模型

关键类型定义见design.md：
- `MarketSnapshot` - 行情快照（含五档行情）
- `OrderRequest` - 报单请求
- `KLineData` - K线数据
- `DepthData` - 五档行情深度
- `ContractInfo` - 合约信息

## WebSocket消息类型

```typescript
type WSMessageType = 
  | 'market_data'      // 行情推送
  | 'order_return'     // 报单回报
  | 'trade_return'     // 成交回报
  | 'position_update'  // 持仓更新
  | 'stop_order_update' // 止损单状态更新
  | 'connection_status' // 连接状态变化
```

## 性能要求

- 行情推送延迟：≤100ms
- 表格渲染FPS：≥60
- 支持合约数量：1000+

## 注意事项

- 用户偏好（自选合约、快捷键配置）使用localStorage持久化
- 业务数据（行情、报单、成交）不落库，仅内存展示
- 止损单由后端监控服务实现，复用行情订阅数据流
- GFD报单依赖simnow柜台收盘自动撤销
