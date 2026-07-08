# Task: 上期所Simnow模拟交易终端 - PR任务拆分

## 1. 概述

本文档按照PR进行任务拆分，每个PR聚焦一个功能点，便于代码审查和并行开发。

**拆分原则**：
- 每个PR 2-3小时工作量
- 前后端交替排列，支持并行开发
- PR依赖关系清晰，可独立测试验证

**角色分工**：
- **角色A**：后端开发（server/目录）
- **角色B**：前端开发（frontend/目录）

---

## 2. PR列表

### 阶段1：基础框架

---

#### PR-1: 后端CTP连接验证

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-1 |
| **PR标题** | 后端CTP连接验证（技术Spike） |
| **PR分支名** | `feature/pr-1-ctp-verify` |
| **负责角色** | 角色A |
| **依赖PR** | 无 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── ctp/
│   ├── __init__.py
│   ├── md_user_api.py         # 行情API封装
│   ├── trader_api.py          # 交易API封装
│   ├── types.py               # CTP数据类型
│   └── callback.py            # 回调处理（基础框架）
├── config.py                  # 配置管理
├── main.py                    # 简化版入口（仅CTP验证）
└── requirements.txt           # Python依赖
```

**PR描述**：
验证openctp-ctp库的可行性，完成CTP连接、登录、行情订阅、报单提交的基础流程验证。

**实现方式**：
1. 安装openctp-ctp库：`pip install openctp-ctp`
2. 封装行情API（MdUserApi）：连接、登录、订阅行情
3. 封装交易API（TraderApi）：连接、登录、报单、撤单
4. 实现回调处理（MdSpi、TraderSpi）
5. 配置管理（读取.env环境变量）
6. 编写验证脚本，测试完整流程

**验证方法**：
1. 运行验证脚本，成功连接simnow行情前置
2. 成功登录simnow账户
3. 成功订阅1个合约行情，收到OnRtnDepthMarketData回调
4. 成功提交1笔报单，收到OnRtnOrder回调
5. 验证simnow市价单支持情况

**验收标准**：
- [ ] 能通过openctp-ctp成功加载并创建API实例
- [ ] 能成功连接到simnow模拟柜台并登录
- [ ] 能收到行情回调（OnRtnDepthMarketData）
- [ ] 能成功提交一笔报单并收到回报（OnRtnOrder）
- [ ] 验证simnow是否支持市价单（OrderPriceType=ANYPRICE）

---

#### PR-2: 前端项目初始化

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-2 |
| **PR标题** | 前端项目初始化 |
| **PR分支名** | `feature/pr-2-frontend-init` |
| **负责角色** | 角色B |
| **依赖PR** | 无 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   │   └── styles/
│   │       └── global.css      # 全局样式
│   ├── services/
│   │   ├── types.ts            # TypeScript类型定义
│   │   ├── api.ts              # REST API封装（Axios）
│   │   └── ws.ts               # WebSocket管理（基础框架）
│   ├── stores/
│   │   ├── connection.ts       # 连接状态Store
│   │   ├── contracts.ts        # 合约列表Store
│   │   └── userPrefs.ts        # 用户偏好Store（localStorage）
│   ├── utils/
│   │   ├── format.ts           # 格式化工具
│   │   └── validators.ts       # 表单校验工具
│   ├── App.tsx                 # 主应用（基础布局）
│   ├── main.tsx                # 入口文件
│   └── vite-env.d.ts           # Vite类型声明
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env                        # 环境变量
```

**PR描述**：
初始化前端项目，搭建基础框架，配置开发环境，实现通用服务层。

**实现方式**：
1. 使用Vite创建React+TypeScript项目
2. 安装依赖：`@visactor/vtable`, `zustand`, `axios`, `echarts`
3. 配置ESLint + Prettier
4. 实现TypeScript类型定义（与design.md数据模型一致）
5. 封装Axios HTTP客户端（拦截器、错误处理）
6. 实现WebSocket管理器（基础框架，支持分端点连接）
7. 实现全局状态Store（连接状态、合约列表、用户偏好）
8. 实现工具函数（格式化、校验）
9. 配置环境变量（API地址）

**验证方法**：
1. 运行`pnpm dev`，项目正常启动
2. TypeScript编译无错误
3. ESLint检查通过
4. Store状态管理正常工作
5. API封装可正常调用（mock数据）

**验收标准**：
- [ ] 项目正常启动，访问http://localhost:5173
- [ ] TypeScript类型定义完整（与design.md一致）
- [ ] Axios封装支持请求/响应拦截
- [ ] WebSocket管理器支持分端点连接
- [ ] Zustand Store正常工作
- [ ] localStorage持久化正常

---

#### PR-3: 后端FastAPI框架

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-3 |
| **PR标题** | 后端FastAPI框架搭建 |
| **PR分支名** | `feature/pr-3-fastapi-framework` |
| **负责角色** | 角色A |
| **依赖PR** | PR-1 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── api/
│   ├── __init__.py
│   ├── connection.py           # 连接管理接口
│   ├── market.py               # 行情接口（基础框架）
│   ├── order.py                # 报单接口（基础框架）
│   └── query.py                # 查询接口（基础框架）
├── ws/
│   ├── __init__.py
│   ├── manager.py              # WebSocket连接管理器
│   └── handlers.py             # 消息处理器（基础框架）
├── models/
│   ├── __init__.py
│   ├── market.py               # 行情数据模型
│   ├── order.py                # 报单数据模型
│   ├── account.py              # 账户数据模型
│   └── contract.py             # 合约数据模型
├── main.py                     # FastAPI应用入口（完善）
└── config.py                   # 配置管理（完善）
```

**PR描述**：
搭建FastAPI应用框架，实现连接管理接口、WebSocket分端点框架、数据模型定义。本PR只实现基础框架，消息分发、断线重连、回调处理在PR-7实现。

**实现方式**：
1. 完善FastAPI应用结构（CORS、路由注册）
2. 实现连接管理接口（/api/connection/login, logout, status）
3. 实现WebSocket分端点框架（ws/market, ws/order, ws/position, ws/stop, ws/system）
4. 实现WebSocket连接管理器基础框架（连接池、连接/断开处理）
5. 定义数据模型（Pydantic模型，与design.md一致）
6. 实现全局异常处理
7. 实现基础API路由框架（占位符）

**不包含**（在PR-7实现）：
- 消息广播功能
- 断线重连机制
- CTP回调处理
- 消息处理器完善

**验证方法**：
1. 启动FastAPI服务：`uvicorn main:app --reload`
2. 访问http://localhost:8000/docs，API文档正常显示
3. 测试连接管理接口（登录、登出、状态查询）
4. 测试WebSocket连接（使用wscat或浏览器）
5. 验证CORS配置正确

**验收标准**：
- [ ] FastAPI服务正常启动
- [ ] API文档自动生成
- [ ] 连接管理接口可用
- [ ] WebSocket分端点设计实现
- [ ] 数据模型定义完整
- [ ] CORS配置正确

---

#### PR-4: 前端布局框架

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-4 |
| **PR标题** | 前端多面板布局框架 |
| **PR分支名** | `feature/pr-4-layout-framework` |
| **负责角色** | 角色B |
| **依赖PR** | PR-2 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── components/
│   ├── ConnectionStatus/
│   │   └── index.tsx           # 连接状态指示器
│   └── ContractSearch/
│       └── index.tsx           # 合约搜索框（基础框架）
├── modules/
│   ├── market/
│   │   ├── MarketPanel.tsx     # 行情面板容器
│   │   └── store.ts            # 行情Store（基础框架）
│   ├── order/
│   │   ├── OrderPanel.tsx      # 报单面板容器
│   │   └── store.ts            # 报单Store（基础框架）
│   └── query/
│       ├── QueryPanel.tsx      # 查询面板容器
│       └── store.ts            # 查询Store（基础框架）
└── App.tsx                     # 主应用（完善布局）
```

**PR描述**：
实现前端多面板布局，包括顶部状态栏、行情面板、报单面板、查询面板的基础框架。

**实现方式**：
1. 实现ConnectionStatus组件（显示MD/TD连接状态）
2. 实现ContractSearch组件（合约搜索框，基础框架）
3. 实现MarketPanel容器（左侧70%）
4. 实现OrderPanel容器（右侧30%）
5. 实现QueryPanel容器（底部Tab切换）
6. 实现各模块Store（基础框架，状态定义）
7. 使用CSS Grid/Flex实现响应式布局
8. 实现面板间的通信机制（通过全局Store）

**验证方法**：
1. 页面正常显示三栏布局
2. 连接状态指示器正常显示
3. Tab切换正常工作
4. 响应式布局适配不同屏幕尺寸
5. Store状态管理正常

**验收标准**：
- [ ] 三栏布局正确显示（行情70%、报单30%、查询底部）
- [ ] 连接状态指示器显示正确
- [ ] Tab切换正常工作
- [ ] 响应式布局适配
- [ ] 组件间通信正常

---

### 阶段2：行情模块

---

#### PR-5: 后端行情API

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-5 |
| **PR标题** | 后端行情API实现 |
| **PR分支名** | `feature/pr-5-market-api` |
| **负责角色** | 角色A |
| **依赖PR** | PR-3 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── api/
│   └── market.py               # 行情接口（完善）
├── ctp/
│   └── md_user_api.py          # 行情API封装（完善）
├── services/
│   ├── __init__.py
│   └── market_service.py       # 行情服务层（新增）
└── data/
    └── instruments.json        # 合约列表缓存（新增）
```

**PR描述**：
实现行情相关API接口，包括合约列表查询、行情订阅/退订、行情快照获取。

**实现方式**：
1. 完善行情API封装（MdUserApi）
   - 连接、登录、订阅、退订
   - 行情回调处理（OnRtnDepthMarketData）
2. 实现行情服务层（MarketService）
   - 合约列表缓存（登录后预加载）
   - 行情数据缓存（内存）
   - 订阅状态管理
3. 实现行情API接口
   - GET /api/market/instruments（合约列表查询，支持搜索）
   - POST /api/market/subscribe（订阅行情）
   - POST /api/market/unsubscribe（退订行情）
   - GET /api/market/snapshots（行情快照）
   - GET /api/market/kline（K线数据，支持多周期）
   - GET /api/market/depth（五档行情深度）
   - GET /api/market/options（期权合约列表）
   - GET /api/market/option_chain（期权T型报价数据）
   - GET /api/market/volatility（隐含波动率，Black-Scholes模型）
4. 实现WebSocket行情推送
   - 行情回调 → WebSocket广播（market_data）
5. 实现订阅限制（最大500个合约）

**验证方法**：
1. 调用登录接口，成功登录
2. 调用合约列表接口，返回合约数据
3. 调用订阅接口，成功订阅行情
4. 通过WebSocket接收行情推送
5. 调用快照接口，获取当前行情数据
6. 调用K线接口，返回K线数据
7. 调用五档深度接口，返回深度数据
8. 调用期权接口，返回期权数据
9. 验证订阅限制（超过500个返回错误）

**验收标准**：
- [ ] 合约列表查询正常（支持模糊搜索）
- [ ] 行情订阅/退订正常
- [ ] 行情快照获取正常
- [ ] K线数据获取正常（多周期）
- [ ] 五档深度数据获取正常
- [ ] 期权合约列表获取正常
- [ ] 期权T型报价数据获取正常
- [ ] 隐含波动率计算正常
- [ ] WebSocket行情推送正常
- [ ] 订阅限制生效（500个）
- [ ] 合约列表缓存正常

---

#### PR-6: 前端行情表格

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-6 |
| **PR标题** | 前端行情表格（vtable） |
| **PR分支名** | `feature/pr-6-market-table` |
| **负责角色** | 角色B |
| **依赖PR** | PR-4 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── market/
│       ├── MarketTable.tsx     # 行情表格组件（vtable）
│       ├── store.ts            # 行情Store（完善）
│       └── MarketPanel.tsx     # 行情面板（完善）
├── hooks/
│   └── usePointOrder.ts        # 点价报单Hook（基础框架）
└── components/
    └── ContractSearch/
        └── index.tsx           # 合约搜索框（完善）
```

**PR描述**：
实现高性能行情表格，使用vtable渲染，支持虚拟滚动、增量渲染、单击/双击点价。

**实现方式**：
1. 实现MarketTable组件（基于@visactor/vtable）
   - 列定义：合约代码、最新价、涨跌、买一、卖一、成交量、持仓量
   - 虚拟滚动：支持1000+合约
   - 增量渲染：只更新变化的单元格
2. 实现行情Store（Zustand）
   - snapshots: Map<string, MarketSnapshot>
   - updateSnapshot: 更新单个合约
   - batchUpdate: 批量更新（50ms间隔）
3. 实现批量更新机制
   - 行情数据推送到缓冲区
   - 每50ms从缓冲区取出最新数据
   - 批量更新vtable
4. 实现点价报单Hook（基础框架）
   - 单击行情表格：直接报单
   - 双击行情表格：填充报单面板
5. 实现合约搜索框
   - 支持模糊搜索
   - 显示搜索结果列表
   - 点击添加到自选合约

**验证方法**：
1. 行情表格正常显示
2. 虚拟滚动流畅（1000+合约）
3. 行情数据实时更新
4. 单击/双击事件正常触发
5. 合约搜索功能正常
6. FPS监控显示≥60

**验收标准**：
- [ ] 行情表格正常渲染
- [ ] 虚拟滚动支持1000+合约
- [ ] 增量渲染正常（只更新变化单元格）
- [ ] 批量更新机制正常（50ms间隔）
- [ ] 单击点价功能正常
- [ ] 双击填充功能正常
- [ ] 合约搜索功能正常

---

#### PR-7: 后端WebSocket管理

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-7 |
| **PR标题** | 后端WebSocket管理完善 |
| **PR分支名** | `feature/pr-7-websocket-manager` |
| **负责角色** | 角色A |
| **依赖PR** | PR-5 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── ws/
│   ├── manager.py              # WebSocket管理器（完善）
│   └── handlers.py             # 消息处理器（完善）
├── ctp/
│   └── callback.py             # 回调处理（完善）
└── services/
    └── reconnect.py            # 断线重连服务
```

**PR描述**：
在PR-3框架基础上，实现WebSocket消息广播、断线重连、CTP回调处理的完整流程。

**实现方式**：
1. 完善WebSocket管理器
   - 连接池管理（按端点分组）
   - 消息广播（支持指定端点）
   - 连接状态监控
2. 实现消息处理器
   - 行情推送处理（ws/market端点）
   - 报单回报处理（ws/order端点）
   - 成交回报处理（ws/order端点）
   - 持仓更新处理（ws/position端点）
   - 止损单状态处理（ws/stop端点）
   - 系统消息处理（ws/system端点）
3. 实现回调处理（CallbackHandler）
   - 行情回调 → ws/market广播
   - 报单回报 → ws/order广播
   - 成交回报 → ws/order广播
   - 持仓更新 → ws/position广播
4. 实现断线重连服务（ReconnectService）
   - 指数退避策略（1s, 2s, 4s, 8s, 16s）
   - 最多重试5次
   - 重连后自动恢复订阅
5. 实现连接状态推送
   - 断线时推送connection_status消息（ws/system端点）
   - 重连成功后推送connection_status消息（ws/system端点）

**验证方法**：
1. WebSocket连接正常建立
2. 消息广播正常工作
3. 断线重连机制正常（模拟断线）
4. 回调处理正常（行情、报单、成交）
5. 连接状态推送正常

**验收标准**：
- [ ] WebSocket分端点连接正常
- [ ] 消息广播功能正常
- [ ] 断线重连机制正常（5次重试）
- [ ] 回调处理正常（行情、报单、成交）
- [ ] 连接状态推送正常

---

#### PR-8: 前端五档行情

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-8 |
| **PR标题** | 前端五档行情展示 |
| **PR分支名** | `feature/pr-8-depth-quote` |
| **负责角色** | 角色B |
| **依赖PR** | PR-6 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── market/
│       ├── DepthQuote.tsx      # 五档行情组件
│       └── store.ts            # 行情Store（完善depthData）
├── hooks/
│   └── usePointOrder.ts        # 点价报单Hook（完善）
└── components/
    └── SpreadDisplay/
        └── index.tsx           # 价差显示组件
```

**PR描述**：
实现五档行情展示组件，显示买一到买五、卖一到卖五的价格和数量，支持点价报单。

**实现方式**：
1. 实现DepthQuote组件
   - 买一到买五价格和数量（左侧）
   - 卖一到卖五价格和数量（右侧）
   - 当前合约代码和最新价（顶部）
2. 实现行情Store扩展
   - depthData: Map<string, DepthData>
   - updateDepth: 更新五档深度
3. 实现点价报单Hook完善
   - 单击五档行情任意价格：直接以该价格报单
   - 自动识别买卖方向（买价=sell，卖价=buy）
4. 实现价差显示组件
   - 显示买卖价差（ask1 - bid1）
   - 实时更新

**验证方法**：
1. 五档行情正常显示
2. 点击买价：自动以该价格卖出
3. 点击卖价：自动以该价格买入
4. 价差显示正确
5. 数据实时更新

**验收标准**：
- [ ] 五档行情正确显示（买一到买五、卖一到卖五）
- [ ] 点价报单功能正常
- [ ] 价差计算正确
- [ ] 数据实时更新
- [ ] 样式美观，易于阅读

---

### 阶段3：交易模块

---

#### PR-9: 后端交易API

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-9 |
| **PR标题** | 后端交易API实现 |
| **PR分支名** | `feature/pr-9-trader-api` |
| **负责角色** | 角色A |
| **依赖PR** | PR-7 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── api/
│   └── order.py                # 报单接口（完善）
├── ctp/
│   ├── trader_api.py           # 交易API封装（完善）
│   └── callback.py             # 回调处理（完善报单/成交）
├── services/
│   ├── __init__.py
│   └── order_manager.py        # 报单管理服务
└── models/
    └── order.py                # 报单数据模型（完善）
```

**PR描述**：
实现交易相关API接口，包括报单、撤单、批量撤单、一键反向、一键锁仓。

**实现方式**：
1. 完善交易API封装（TraderApi）
   - 连接、登录、报单、撤单
   - 报单回调处理（OnRtnOrder）
   - 成交回调处理（OnRtnTrade）
2. 实现报单管理服务（OrderManager）
   - 报单状态跟踪（维护活动报单表）
   - GFD有效期处理（当日有效，依赖simnow柜台自动撤销）
   - FOK成交方式处理（全部成交或全部撤销）
   - FAK成交方式处理（部分成交，剩余撤销）
   - 报单引用管理（order_ref映射）
3. 实现报单API接口
   - POST /api/order/insert（报单）
   - POST /api/order/cancel（撤单）
   - POST /api/order/cancel_all（批量撤单）
   - POST /api/order/reverse（一键反向）
   - POST /api/order/lock（一键锁仓）
   - GET /api/order/status/{order_ref}（查询报单状态）
4. 实现报单参数校验
   - 价格校验（>0，符合最小变动价位）
   - 数量校验（>0，不超过最大限制）
   - 合约校验（存在且可交易）
5. 实现WebSocket报单推送
   - 报单回报 → WebSocket推送（order_return）
   - 成交回报 → WebSocket推送（trade_return）

**验证方法**：
1. 调用报单接口，成功提交报单
2. 调用撤单接口，成功撤销报单
3. 调用批量撤单接口，成功撤销所有未成交报单
4. 调用一键反向接口，成功反向报单
5. 调用一键锁仓接口，成功锁仓
6. 通过WebSocket接收报单回报和成交回报
7. 参数校验正常（错误参数返回错误信息）

**验收标准**：
- [ ] 报单功能正常（限价单、市价单）
- [ ] 撤单功能正常
- [ ] 批量撤单功能正常
- [ ] 一键反向功能正常
- [ ] 一键锁仓功能正常
- [ ] 参数校验正常
- [ ] WebSocket推送正常

---

#### PR-10: 前端报单表单

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-10 |
| **PR标题** | 前端报单表单实现 |
| **PR分支名** | `feature/pr-10-order-form` |
| **负责角色** | 角色B |
| **依赖PR** | PR-8 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── order/
│       ├── OrderForm.tsx       # 报单表单组件
│       ├── StopOrderForm.tsx   # 止损单表单组件（基础框架）
│       ├── OrderPanel.tsx      # 报单面板（完善）
│       └── store.ts            # 报单Store（完善）
├── components/
│   └── OrderForm/
│       ├── index.tsx           # 报单表单通用组件
│       └── hooks.ts            # 表单逻辑Hook
└── hooks/
    ├── usePriceStep.ts         # 价格步进Hook
    └── useHotKeys.ts           # 快捷键Hook（基础框架）
```

**PR描述**：
实现报单表单组件，支持限价/市价切换、开平切换、价格步进、快捷键操作。

**实现方式**：
1. 实现OrderForm组件
   - 合约代码输入（自动填充）
   - 买卖方向选择（买/卖）
   - 开平标志选择（开/平/平今）
   - 价格类型选择（限价/市价）
   - 价格输入（支持步进调整）
   - 数量输入（支持步进调整）
   - 提交按钮（买入/卖出/撤单）
2. 实现价格步进Hook（usePriceStep）
   - 根据合约最小变动价位自动对齐
   - 支持+/-按钮调整
3. 实现快捷键Hook（基础框架）
   - B键：快速买入
   - S键：快速卖出
   - C键：撤销当前合约所有未成交报单
   - 仅报单面板焦点时生效
4. 实现报单Store（完善）
   - orderForm: OrderRequest
   - setOrderForm: 更新表单数据
   - submitOrder: 提交报单
   - cancelOrder: 撤单
5. 实现止损单表单（基础框架）
   - 止损价输入
   - 提交止损单按钮

**验证方法**：
1. 报单表单正常显示
2. 限价/市价切换正常
3. 开平切换正常
4. 价格步进调整正常
5. 快捷键操作正常（B/S/C）
6. 提交报单正常
7. 表单校验正常

**验收标准**：
- [ ] 报单表单完整显示
- [ ] 限价/市价切换正常
- [ ] 开平切换正常
- [ ] 价格步进功能正常
- [ ] 快捷键功能正常（B/S/C）
- [ ] 提交报单功能正常
- [ ] 表单校验正常

---

#### PR-11: 后端查询API

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-11 |
| **PR标题** | 后端查询API实现 |
| **PR分支名** | `feature/pr-11-query-api` |
| **负责角色** | 角色A |
| **依赖PR** | PR-9 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── api/
│   └── query.py                # 查询接口（完善）
├── ctp/
│   └── trader_api.py           # 交易API封装（完善查询功能）
└── models/
    ├── account.py              # 账户数据模型（完善）
    └── contract.py             # 合约数据模型（完善）
```

**PR描述**：
实现查询相关API接口，包括报单流水、成交流水、持仓、账户资金、合约信息查询。

**实现方式**：
1. 完善交易API封装（查询功能）
   - query_orders: 查询报单流水
   - query_trades: 查询成交流水
   - query_positions: 查询持仓
   - query_account: 查询账户资金
   - query_contracts: 查询合约信息
2. 实现查询API接口
   - GET /api/query/orders（报单流水）
   - GET /api/query/trades（成交流水）
   - GET /api/query/positions（持仓）
   - GET /api/query/account（账户资金）
   - GET /api/query/contracts（合约信息）
3. 实现查询结果缓存
   - 合约信息缓存（登录后预加载）
   - 其他数据实时查询
4. 实现WebSocket持仓推送
   - 持仓变化 → WebSocket推送（position_update）

**验证方法**：
1. 调用报单流水接口，返回报单记录
2. 调用成交流水接口，返回成交记录
3. 调用持仓接口，返回持仓数据
4. 调用账户资金接口，返回资金数据
5. 调用合约信息接口，返回合约数据
6. 通过WebSocket接收持仓更新

**验收标准**：
- [ ] 报单流水查询正常
- [ ] 成交流水查询正常
- [ ] 持仓查询正常
- [ ] 账户资金查询正常
- [ ] 合约信息查询正常
- [ ] WebSocket持仓推送正常

---

#### PR-12: 前端K线图

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-12 |
| **PR标题** | 前端K线图实现 |
| **PR分支名** | `feature/pr-12-kline-chart` |
| **负责角色** | 角色B |
| **依赖PR** | PR-6 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── market/
│       ├── KLineChart.tsx      # K线图组件
│       └── store.ts            # 行情Store（完善klineData）
└── services/
    └── api.ts                  # API封装（完善K线接口）
```

**PR描述**：
实现K线图组件，支持多周期切换、技术指标显示。

**实现方式**：
1. 实现KLineChart组件（基于ECharts）
   - K线图渲染（蜡烛图）
   - 成交量柱状图
   - 技术指标（MA、MACD等）
   - 多周期切换（1m、5m、15m、30m、1h、日线）
2. 实现行情Store扩展
   - klineData: Map<string, KLineData[]>
   - updateKline: 更新K线数据
3. 实现K线数据接口
   - GET /api/market/kline（获取K线数据）
   - 支持参数：instrument、period、count
4. 实现实时K线更新
   - 行情推送 → 实时更新当前K线
   - 周期切换 → 重新加载历史数据

**验证方法**：
1. K线图正常显示
2. 多周期切换正常
3. 技术指标显示正常
4. 实时更新正常
5. 缩放、拖拽操作正常

**验收标准**：
- [ ] K线图正常渲染
- [ ] 多周期切换正常
- [ ] 技术指标显示正常
- [ ] 实时更新正常
- [ ] 交互操作正常（缩放、拖拽）

---

### 阶段4：高级功能

---

#### PR-13: 后端止损单服务

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-13 |
| **PR标题** | 后端止损单服务实现 |
| **PR分支名** | `feature/pr-13-stop-order` |
| **负责角色** | 角色A |
| **依赖PR** | PR-9 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── api/
│   └── order.py                # 报单接口（完善止损单）
├── services/
│   └── stop_order.py           # 止损单监控服务
├── data/
│   └── stop_orders.json        # 止损单持久化文件
└── models/
    └── order.py                # 报单数据模型（完善StopOrder）
```

**PR描述**：
实现止损单监控服务，支持止损单提交、取消、查询、自动触发。

**实现方式**：
1. 实现止损单监控服务（StopOrderService）
   - 接收止损单请求
   - 监控行情数据（复用已有行情订阅）
   - 判断触发条件（多头止损：最新价≤止损价；空头止损：最新价≥止损价）
   - 触发时自动报单
   - 通知前端止损单状态变化
2. 实现止损单API接口
   - POST /api/order/stop（提交止损单）
   - POST /api/order/stop/cancel（取消止损单）
   - GET /api/order/stop/list（查询止损单列表）
3. 实现止损单持久化
   - 存储到data/stop_orders.json
   - 每次状态变更后立即写入
   - 服务启动时加载未触发的止损单
4. 实现WebSocket止损单推送
   - 止损单状态变化 → WebSocket推送（stop_order_update）
5. 实现边界条件处理
   - 价格跳空：仍触发止损
   - 触发后报单被拒：状态变为trigger_failed
   - 止损单有效期：当日有效（GFD）

**验证方法**：
1. 提交止损单正常
2. 取消止损单正常
3. 查询止损单列表正常
4. 止损单触发正常（模拟价格变化）
5. 触发后自动报单正常
6. WebSocket推送正常
7. 持久化正常（重启后恢复）

**验收标准**：
- [ ] 止损单提交正常
- [ ] 止损单取消正常
- [ ] 止损单查询正常
- [ ] 止损单触发逻辑正确
- [ ] 触发后自动报单正常
- [ ] WebSocket推送正常
- [ ] 持久化正常

---

#### PR-14: 前端期权T型报价

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-14 |
| **PR标题** | 前端期权T型报价实现 |
| **PR分支名** | `feature/pr-14-option-tquote` |
| **负责角色** | 角色B |
| **依赖PR** | PR-6 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── options/
│       ├── OptionPanel.tsx     # 期权面板
│       ├── TQuoteTable.tsx     # T型报价表格
│       └── store.ts            # 期权Store
└── services/
    └── api.ts                  # API封装（完善期权接口）
```

**PR描述**：
实现期权T型报价组件，显示看涨/看跌期权、行权价、隐含波动率。

**实现方式**：
1. 实现TQuoteTable组件（基于vtable）
   - T型布局：左侧看涨、中间行权价、右侧看跌
   - 显示字段：最新价、买一、卖一、成交量、持仓量、隐含波动率
   - 支持点击行权价高亮
2. 实现OptionPanel组件
   - 标的合约选择
   - 到期日选择
   - T型报价表格
3. 实现期权Store
   - optionChain: OptionChain
   - updateOptionChain: 更新期权链
4. 调用期权API接口（已在PR-5后端实现）
   - GET /api/market/options（获取期权合约列表）
   - GET /api/market/option_chain（获取期权T型报价数据）
   - GET /api/market/volatility（获取隐含波动率，由后端Black-Scholes模型计算）

**验证方法**：
1. 期权面板正常显示
2. T型报价表格正常渲染
3. 看涨/看跌期权正确显示
4. 隐含波动率计算正确
5. 点击行权价高亮正常

**验收标准**：
- [ ] 期权面板正常显示
- [ ] T型报价表格正常渲染
- [ ] 看涨/看跌期权正确显示
- [ ] 隐含波动率计算正确
- [ ] 交互操作正常

---

#### PR-15: 前端快捷功能

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-15 |
| **PR标题** | 前端快捷功能实现 |
| **PR分支名** | `feature/pr-15-quick-actions` |
| **负责角色** | 角色B |
| **依赖PR** | PR-9, PR-10 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── order/
│       ├── QuickActions.tsx    # 快捷操作组件
│       └── OrderPanel.tsx      # 报单面板（完善）
├── components/
│   ├── BatchCancel/
│   │   └── index.tsx           # 批量撤单组件
│   └── QuickKeys/
│       └── index.tsx           # 快捷键配置组件
└── hooks/
    └── useHotKeys.ts           # 快捷键Hook（完善）
```

**PR描述**：
实现快捷操作功能，包括一键反向、一键锁仓、批量撤单、快捷键配置。

**实现方式**：
1. 实现QuickActions组件
   - 一键反向按钮
   - 一键锁仓按钮
   - 批量撤单按钮
2. 实现BatchCancel组件
   - 显示当前所有未成交报单
   - 支持全选/取消全选
   - 一键撤销选中报单
3. 实现QuickKeys组件
   - 快捷键配置面板
   - 支持自定义快捷键映射
   - localStorage持久化
4. 完善快捷键Hook（useHotKeys）
   - B键：快速买入
   - S键：快速卖出
   - C键：撤销当前合约所有未成交报单
   - 仅报单面板焦点时生效
   - 支持自定义快捷键
5. 实现一键反向逻辑
   - 查询原报单持仓方向和数量
   - 先平仓原持仓
   - 再开反方向仓
6. 实现一键锁仓逻辑
   - 场景A：双开锁仓（无持仓）
   - 场景B：反手锁仓（有持仓）

**验证方法**：
1. 一键反向功能正常
2. 一键锁仓功能正常
3. 批量撤单功能正常
4. 快捷键配置正常
5. 快捷键操作正常
6. localStorage持久化正常

**验收标准**：
- [ ] 一键反向功能正常
- [ ] 一键锁仓功能正常
- [ ] 批量撤单功能正常
- [ ] 快捷键配置正常
- [ ] 快捷键操作正常
- [ ] localStorage持久化正常

---

#### PR-16: 前端查询面板

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-16 |
| **PR标题** | 前端查询面板实现 |
| **PR分支名** | `feature/pr-16-query-panel` |
| **负责角色** | 角色B |
| **依赖PR** | PR-11, PR-13 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── query/
│       ├── QueryPanel.tsx      # 查询面板（完善）
│       ├── OrderFlow.tsx       # 报单流水组件
│       ├── TradeFlow.tsx       # 成交流水组件
│       ├── Position.tsx        # 持仓查询组件
│       ├── AccountQuery.tsx    # 账户资金查询组件（新增）
│       ├── QuoteQuery.tsx      # 报价查询组件
│       ├── ContractQuery.tsx   # 合约查询组件
│       ├── StopOrderList.tsx   # 止损单列表组件
│       └── store.ts            # 查询Store（完善）
└── services/
    └── api.ts                  # API封装（完善查询接口）
```

**PR描述**：
实现查询面板，包括报单流水、成交流水、持仓、报价查询、合约查询、止损单列表。

**实现方式**：
1. 完善QueryPanel组件
   - Tab切换：报单流水、成交流水、持仓、资金、止损单、报价、合约
   - 暂停更新按钮
   - 手动刷新按钮
2. 实现OrderFlow组件
   - 报单流水表格
   - 增量更新（新数据插入顶部）
   - 新数据高亮（2秒）
   - 时间倒序
3. 实现TradeFlow组件
   - 成交流水表格
   - 增量更新
   - 新数据高亮
   - 时间倒序
4. 实现Position组件
   - 持仓表格
   - 点击持仓直接平仓
   - 持仓盈亏显示
5. 实现AccountQuery组件
   - 账户资金信息展示
   - 可用余额、冻结资金、持仓盈亏
   - 实时更新
6. 实现QuoteQuery组件
   - 五档行情深度展示
   - 支持多合约切换
7. 实现ContractQuery组件
   - 合约详细信息展示
   - 合约乘数、最小变动价位
8. 实现StopOrderList组件
   - 止损单列表
   - 止损单状态显示（pending/triggered/canceled/trigger_failed）
   - 取消止损单操作
9. 实现查询Store完善
   - orders, trades, positions, account, quotes, contracts, stopOrders
   - isPaused: 暂停更新
   - 增量更新方法

**验证方法**：
1. 查询面板Tab切换正常
2. 报单流水正常显示
3. 成交流水正常显示
4. 持仓查询正常
5. 账户资金查询正常
6. 报价查询正常
7. 合约查询正常
8. 止损单列表正常
9. 增量更新正常
10. 新数据高亮正常
11. 暂停更新功能正常

**验收标准**：
- [ ] 查询面板Tab切换正常
- [ ] 报单流水显示正常
- [ ] 成交流水显示正常
- [ ] 持仓查询正常
- [ ] 账户资金查询正常（可用余额、冻结资金、持仓盈亏）
- [ ] 报价查询正常
- [ ] 合约查询正常
- [ ] 止损单列表正常（含状态显示和取消操作）
- [ ] 增量更新正常
- [ ] 新数据高亮正常
- [ ] 暂停更新功能正常

---

### 阶段5：联调优化

---

#### PR-17: 联调测试与Bug修复

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-17 |
| **PR标题** | 联调测试与Bug修复 |
| **PR分支名** | `feature/pr-17-integration-test` |
| **负责角色** | 角色A + 角色B |
| **依赖PR** | PR-1 到 PR-16 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
# 测试相关文件
test-record.md                # 测试记录
bug-fixes/                    # Bug修复记录

# 可能修改的文件
frontend/src/                 # 前端Bug修复
server/                       # 后端Bug修复
```

**PR描述**：
进行前后端联调测试，修复发现的Bug，优化性能，完善错误处理。

**实现方式**：
1. 联调测试（参考design.md测试用例）
   - 集成测试（IT-01~IT-20）
     - IT-01: CTP连接与登录
     - IT-02: 行情订阅与推送
     - IT-03: 限价报单提交
     - IT-04: 市价报单提交
     - IT-05: 报单撤销
     - IT-06: 批量撤单
     - IT-07: 一键反向
     - IT-08: 一键锁仓
     - IT-09: 止损单触发
     - IT-10: 五档行情查询
     - IT-11: K线数据查询
     - IT-12: 期权T型报价
     - IT-13: 报单流水查询
     - IT-14: 成交流水查询
     - IT-15: 持仓查询
     - IT-16: 账户资金查询
     - IT-17: 合约信息查询
     - IT-18: 断线重连
     - IT-19: WebSocket消息分发
     - IT-20: 错误处理
   - E2E测试（E2E-01~E2E-10）
     - E2E-01: 完整交易流程（登录→订阅→报单→查询）
     - E2E-02: 多合约行情（100+合约）
     - E2E-03: 点价报单流程
     - E2E-04: 止损单完整流程
     - E2E-05: 断线重连流程
     - E2E-06: 批量操作流程
     - E2E-07: 期权交易流程
     - E2E-08: 性能压力测试（1000+合约）
     - E2E-09: 异常场景测试
     - E2E-10: 用户偏好持久化
2. Bug修复
   - 记录发现的Bug
   - 分析根因
   - 修复并验证
3. 性能优化
   - 行情推送延迟优化（≤100ms）
   - 表格渲染FPS优化（≥60）
   - 内存使用优化
4. 错误处理完善
   - 统一错误码处理（12个错误码）
   - 用户友好的错误提示
   - 异常情况处理
5. 文档完善
   - 更新README.md
   - 补充API文档
   - 记录测试结果

**验证方法**：
1. 集成测试IT-01~IT-20全部通过
2. E2E测试E2E-01~E2E-10全部通过
3. 性能测试通过（FPS≥60，延迟≤100ms）
4. 所有Bug修复完成
5. 错误处理完善

**验收标准**：
- [ ] 集成测试IT-01~IT-20全部通过
- [ ] E2E测试E2E-01~E2E-10全部通过
- [ ] 性能测试通过（FPS≥60，延迟≤100ms）
- [ ] 所有Bug修复完成
- [ ] 错误处理完善（12个错误码）
- [ ] 文档完善

---

## 3. PR依赖关系图

```
PR-1 (CTP验证) ──────────────────────────────────────┐
    │                                                  │
    ▼                                                  │
PR-3 (FastAPI框架) ───────────────────────────────────┤
    │                                                  │
    ▼                                                  │
PR-5 (行情API) ──────────────────────────────────────┤
    │                                                  │
    ├──►PR-7 (WebSocket) ─────────────────────────────┤
    │       │                                          │
    │       ▼                                          │
    │   PR-9 (交易API) ───────────────────────────────┤
    │       │                                          │
    │       ├──►PR-11 (查询API) ──────────────────────┤
    │       │                                          │
    │       ├──►PR-13 (止损单) ───────────────────────┤
    │       │       │                                  │
    │       │       ▼                                  │
    │       │   PR-16 (查询面板) ◄──── PR-11 ─────────┤
    │       │                                          │
    │       ▼                                          │
    │   PR-10 (报单表单) ─────────────────────────────┤
    │       │                                          │
    │       ▼                                          │
    │   PR-15 (快捷功能) ◄──── PR-9 ─────────────────┤
    │                                                  │
    ▼                                                  │
PR-2 (前端初始化) ───────────────────────────────────┤
    │                                                  │
    ▼                                                  │
PR-4 (布局框架) ─────────────────────────────────────┤
    │                                                  │
    ▼                                                  │
PR-6 (行情表格) ─────────────────────────────────────┤
    │                                                  │
    ├──►PR-8 (五档行情) ──────────────────────────────┤
    │                                                  │
    ├──►PR-12 (K线图) ───────────────────────────────┤
    │                                                  │
    └──►PR-14 (期权T型报价) ─────────────────────────┘
                                                    │
                                                    ▼
                                              PR-17 (联调测试)
```

**并行开发建议**：
- PR-1 和 PR-2 可以并行开发（无依赖）
- PR-3 和 PR-4 可以并行开发（分别依赖PR-1和PR-2）
- PR-5 和 PR-6 可以并行开发（分别依赖PR-3和PR-4）
- PR-7 和 PR-8 可以并行开发（分别依赖PR-5和PR-6）
- PR-9 和 PR-12 可以并行开发（分别依赖PR-7和PR-6）
- PR-10 和 PR-14 可以并行开发（分别依赖PR-8和PR-6）
- PR-11 和 PR-13 可以并行开发（都依赖PR-9）
- PR-15 依赖PR-9和PR-10（一键反向/锁仓需要后端支持）
- PR-16 依赖PR-11和PR-13（查询面板需要查询API和止损单服务）

---

## 4. 里程碑对应

| 里程碑 | PR范围 | 说明 |
|--------|--------|------|
| **M0** | PR-1 | 技术Spike：openctp-ctp验证 |
| **M1** | PR-3, PR-5, PR-7, PR-9, PR-11, PR-13 | Python中间层开发 |
| **M2** | PR-4, PR-6, PR-8, PR-12, PR-14 | 前端行情模块开发 |
| **M3** | PR-10, PR-15 | 前端报单模块开发 |
| **M4** | PR-16 | 前端查询模块开发 |
| **M5** | PR-17 | 联调测试与Bug修复 |

---

## 5. 开发日志

| 日期 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 2026-07-08 | v1.0 | 初始化task.md：17个PR任务拆分 | ✅ 完成 |
| 2026-07-08 | v1.1 | 修复任务分工问题：期权API、资金查询、依赖关系、职责边界等 | ✅ 完成 |
| 2026-07-08 | v1.2 | 修复PR-14 API描述混淆，明确后端API职责 | ✅ 完成 |
