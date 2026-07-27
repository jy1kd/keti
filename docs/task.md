
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
| **工作量** | 4小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
server/
├── ctp_wrapper/
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
验证ctp-python库的可行性，完成CTP连接、登录、行情订阅、报单提交的基础流程验证。

**实现方式**：
1. 安装ctp-python库：`pip install ctp-python`
2. 封装行情API（MdUserApi）：连接、登录、订阅行情
3. 封装交易API（TraderApi）：连接、登录、报单、撤单
4. 实现回调处理（MdSpi、TraderSpi）
5. 配置管理（读取.env环境变量）
6. 编写验证脚本，测试完整流程

**已验证的CTP连接流程**（参考 `md_demo.py`）：

```python
import ctp

# 1. 创建API实例
md_api = ctp.CThostFtdcMdApi.CreateFtdcMdApi()

# 2. 注册SPI回调
md_spi = MyMdSpi(md_api)
md_api.RegisterSpi(md_spi)

# 3. 注册前置机地址
md_api.RegisterFront("tcp://182.254.243.31:40011")  # 7x24环境

# 4. 初始化（触发OnFrontConnected回调）
md_api.Init()

# 5. 在OnFrontConnected回调中登录
login_field = ctp.CThostFtdcReqUserLoginField()
login_field.BrokerID = "9999"
login_field.UserID = "your_user_id"
login_field.Password = "your_password"
md_api.ReqUserLogin(login_field, request_id)

# 6. 在OnRspUserLogin回调中订阅（⚠️ 必须传字符串列表！）
md_api.SubscribeMarketData(["IF2608", "IF2609"])  # ✅ 正确
# md_api.SubscribeMarketData([b"IF2608"])          # ❌ 崩溃！
```

**⚠️ 关键发现：SubscribeMarketData参数必须传字符串列表**

```
❌ md_api.SubscribeMarketData([b"IF2608"])   # bytes导致堆损坏崩溃(0xC0000374)
✅ md_api.SubscribeMarketData(["IF2608"])    # 字符串正常工作
```

这是ctp-python库的SWIG绑定bug，bytes参数会导致内存越界。

**SimNow 7x24测试环境**：
- 行情前置：`tcp://182.254.243.31:40011`
- 交易前置：`tcp://182.254.243.31:40001`
- BrokerID：`9999`
- 注意：7x24环境连接服务可用，但非交易时段无行情推送

**参考文件**：
- `md_demo.py` — CTP字段结构探测（不需要连接，直接获取字段定义）
- `ctp_realtime_demo.py` — 实时行情显示（需在交易时段运行）

**验证方法**：
1. 运行 `md_demo.py`，成功连接simnow行情前置
2. 成功登录simnow账户
3. 成功订阅合约行情，收到OnRspSubMarketData回调
4. 交易时段收到OnRtnDepthMarketData行情推送
5. 成功提交1笔报单，收到OnRtnOrder回调

**验收标准**：
- [ ] 能通过ctp-python成功加载并创建API实例（`import ctp`）
- [ ] 能成功连接到simnow模拟柜台并登录
- [ ] 能成功订阅合约（使用字符串列表，非bytes）
- [ ] 能收到行情回调（OnRtnDepthMarketData）
- [ ] 能成功提交一笔报单并收到回报（OnRtnOrder）
- [ ] 验证simnow是否支持市价单（OrderPriceType=ANYPRICE）

**用户手动验证**：
1. 运行字段探测：`C:\Users\pc\.conda\envs\pytorch\python.exe md_demo.py`
2. 运行实时行情（交易时段）：`C:\Users\pc\.conda\envs\pytorch\python.exe ctp_realtime_demo.py`
3. 检查输出文件：`docs/ctp-api-structure.txt` 已生成

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
| **状态** | ✅ 已完成 |

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
4. 实现TypeScript类型定义（基于 `ctp-api-structure.txt` 真实CTP字段，camelCase）
   - `LoginRequest/LoginResponse`：登录请求/响应
   - `MarketSnapshot`：行情快照（含5档深度 bidPrice1-5, askPrice1-5）
   - `OrderRequest/OrderReturn`：报单请求/回报
   - `TradeReturn`：成交回报
   - `PositionInfo`：持仓信息
   - `AccountInfo`：账户资金
   - `InstrumentInfo`：合约信息（含期权字段 optionsType, strikePrice）
   - `OptionChain/OptionQuote/VolatilityData`：自定义业务接口
5. 封装Axios HTTP客户端（拦截器、错误处理）
6. 实现WebSocket管理器（基础框架，支持分端点连接）
7. 实现全局状态Store（连接状态、合约列表、用户偏好）
8. 实现工具函数（格式化、校验）
9. 配置环境变量（API地址）

**真实API字段参考**：
- 字段来源：`docs/ctp-api-structure.txt`
- 字段命名：camelCase（如 `instrumentID`, `lastPrice`, `bidPrice1`）
- 关键类型：
  ```typescript
  // 行情快照（50+字段）
  interface MarketSnapshot {
    instrumentID: string;
    lastPrice: number;
    bidPrice1: number; bidPrice2: number; bidPrice3: number; bidPrice4: number; bidPrice5: number;
    askPrice1: number; askPrice2: number; askPrice3: number; askPrice4: number; askPrice5: number;
    bidVolume1: number; askVolume1: number;
    volume: number; openInterest: number;
    openPrice: number; closePrice: number; highestPrice: number; lowestPrice: number;
    upperLimitPrice: number; lowerLimitPrice: number;
    preSettlementPrice: number; settlementPrice: number;
    updateTime: string; updateMillisec: number;
    // ... 更多字段见 ctp-api-structure.txt
  }
  // 报单请求（30+字段）
  interface OrderRequest {
    instrumentID: string; direction: string; offsetFlag: string;
    priceType: string; limitPrice: number; volumeTotalOriginal: number;
    // ... 更多字段见 ctp-api-structure.txt
  }
  ```

**验证方法**：
1. 运行`pnpm dev`，项目正常启动
2. TypeScript编译无错误
3. ESLint检查通过
4. Store状态管理正常工作
5. API封装框架就绪（等待后端PR-5提供真实接口）

**验收标准**：
- [ ] 项目正常启动，访问http://localhost:5173
- [ ] TypeScript类型定义完整（与design.md一致）
- [ ] Axios封装支持请求/响应拦截
- [ ] WebSocket管理器支持分端点连接
- [ ] Zustand Store正常工作
- [ ] localStorage持久化正常

**用户手动验证**：
1. 进入前端目录：`cd frontend`
2. 启动开发服务器：`npm run dev`
3. 浏览器访问 http://localhost:5173 确认页面正常
4. TypeScript编译检查：`npm run build`

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
| **状态** | ✅ 已完成 |

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

**用户手动验证**：
1. 进入后端目录：`cd server`
2. 启动服务：`C:\Users\pc\.conda\envs\pytorch\python.exe -m uvicorn main:app --reload --port 8000`
3. 浏览器访问 http://localhost:8000/docs 查看API文档
4. 测试连接接口：浏览器访问 http://localhost:8000/api/connection/status

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
| **状态** | ✅ 已完成 |

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

**用户手动验证**：
1. 启动前端：`cd frontend && npm run dev`
2. 浏览器访问 http://localhost:5173
3. 确认三栏布局显示（行情70%、报单30%、查询底部）
4. 确认连接状态指示器显示

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
| **状态** | ✅ 已完成 |

**提交文件**：
```
server/
├── api/
│   └── market.py               # 行情接口（完善）
├── ctp_wrapper/
│   └── md_user_api.py          # 行情API封装（完善）
├── services/
│   ├── __init__.py
│   ├── market_service.py       # 行情服务层
│   ├── field_mapping.py        # CTP字段映射（PascalCase→camelCase）
│   ├── ctp_bridge.py           # CTP回调桥接
│   ├── ctp_startup.py          # CTP自动连接
│   └── kline_service.py        # K线聚合服务
├── data/
│   └── instruments.json        # 合约列表缓存
└── start.py                    # 智能启动脚本（自动选择CTP地址）
```

**PR描述**：
实现行情相关API接口，包括合约列表查询、行情订阅/退订、行情快照获取。

**实现方式**：
1. 完善行情API封装（MdUserApi）
   - 连接、登录、订阅、退订
   - 行情回调处理（OnRtnDepthMarketData）
   - 字段映射：CTP对象 → camelCase字典（见 `ctp-api-structure.txt` MarketSnapshot）
2. 实现行情服务层（MarketService）
   - 合约列表缓存（登录后预加载，使用 ReqQryInstrument）
   - 行情数据缓存（内存，Map<string, MarketSnapshot>）
   - 订阅状态管理
3. 实现行情API接口
   - GET /api/market/instruments（合约列表查询，支持搜索）
   - POST /api/market/subscribe（订阅行情）
   - POST /api/market/unsubscribe（退订行情）
   - GET /api/market/snapshots（行情快照）
   - GET /api/market/kline（K线数据，支持多周期）
   - GET /api/market/depth（五档行情深度）
4. 实现WebSocket行情推送
   - 行情回调 → WebSocket广播（market_data）
   - 消息格式：`{ type: 'market_data', data: MarketSnapshot }`
5. 实现订阅限制（最大500个合约）

**真实API字段参考**：
- 行情回调字段：`ctp-api-structure.txt` → MarketSnapshot（50+字段）
- 合约信息字段：`ctp-api-structure.txt` → InstrumentInfo（含 optionsType, strikePrice, underlyingInstrID）

**不含**（在PR-18实现）：
- 期权合约列表接口（/api/market/options）
- 期权T型报价接口（/api/market/option_chain）
- 隐含波动率接口（/api/market/volatility）

**验证方法**：
1. 调用登录接口，成功登录
2. 调用合约列表接口，返回合约数据
3. 调用订阅接口，成功订阅行情
4. 通过WebSocket接收行情推送
5. 调用快照接口，获取当前行情数据
6. 调用K线接口，返回K线数据
7. 调用五档深度接口，返回深度数据

**验收标准**：
- [ ] 合约列表查询正常（支持模糊搜索）
- [ ] 行情订阅/退订正常
- [ ] 行情快照获取正常
- [ ] K线数据获取正常（多周期）
- [ ] 五档深度数据获取正常
- [ ] WebSocket行情推送正常
- [ ] 订阅限制生效（500个）
- [ ] 合约列表缓存正常

**用户手动验证**：
1. 启动后端：`cd server && C:\Users\pc\.conda\envs\pytorch\python.exe -m uvicorn main:app --reload --port 8000`
2. 测试合约列表：浏览器访问 http://localhost:8000/api/market/instruments
3. 测试行情订阅：`curl -X POST http://localhost:8000/api/market/subscribe -H "Content-Type: application/json" -d "{\"instruments\":[\"IF2608\"]}"`
4. 测试行情快照：浏览器访问 http://localhost:8000/api/market/snapshots?instruments=IF2608

---

#### PR-6: 前端行情表格

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-6 |
| **PR标题** | 前端行情表格（vtable） |
| **PR分支名** | `feature/pr-6-market-table` |
| **负责角色** | 角色B |
| **依赖PR** | PR-5（需要后端行情API提供真实数据） |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

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
├── components/
│   ├── ContractSearch/
│   │   └── index.tsx           # 合约搜索框（完善）
│   └── PerfMonitor/
│       └── index.tsx           # 渲染性能监控（FPS、渲染耗时，Ctrl+P切换）
```

**PR描述**：
实现高性能行情表格，使用vtable渲染，支持虚拟滚动、增量渲染、单击/双击点价。**直接调用后端真实API获取数据，不使用mock数据**。

**实现方式**：
1. 实现MarketTable组件（基于@visactor/vtable）
   - 列定义：合约代码、最新价、涨跌额、涨跌幅%、买一、卖一、成交量、持仓量
   - 涨跌额 = lastPrice - preSettlementPrice
   - 涨跌幅% = (lastPrice - preSettlementPrice) / preSettlementPrice * 100
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
4. **调用后端真实API获取数据**
   - GET /api/market/instruments（获取合约列表）
   - GET /api/market/snapshots（获取行情快照）
   - WebSocket /ws/market（接收实时行情推送）
5. 实现点价报单Hook（基础框架）
   - 单击行情表格：直接报单
   - 双击行情表格：填充报单面板
6. 实现合约搜索框
   - 支持模糊搜索
   - 显示搜索结果列表
   - 点击添加到自选合约
7. 实现PerfMonitor组件（渲染性能监控）
   - FPS监控（使用requestAnimationFrame计算实时帧率）
   - 渲染耗时统计（监控vtable每次更新的耗时）
   - 默认隐藏，Ctrl+P快捷键切换显示/隐藏
   - 告警阈值：FPS<30时显示警告

**验证方法**：
1. 行情表格正常显示
2. 虚拟滚动流畅（1000+合约）
3. 行情数据实时更新
4. 单击/双击事件正常触发
5. 合约搜索功能正常
6. FPS监控显示≥60
7. PerfMonitor组件正常工作（Ctrl+P切换显示）

**验收标准**：
- [ ] 行情表格正常渲染
- [ ] 虚拟滚动支持1000+合约
- [ ] 增量渲染正常（只更新变化单元格）
- [ ] 批量更新机制正常（50ms间隔）
- [ ] 涨跌额和涨跌幅%显示正常
- [ ] 单击点价功能正常
- [ ] 双击填充功能正常
- [ ] 合约搜索功能正常
- [ ] PerfMonitor组件正常（FPS监控、渲染耗时、Ctrl+P切换）

**用户手动验证**：
1. 启动前端：`cd frontend && npm run dev`
2. 浏览器访问 http://localhost:5173
3. 确认行情表格正常渲染
4. 确认涨跌额和涨跌幅%列正确显示
5. 确认合约搜索框可用

---

#### PR-6a: 前端行情表格接入真实API

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-6a |
| **PR标题** | 前端行情表格接入真实后端API |
| **PR分支名** | `feature/pr-6a-market-real-api` |
| **负责角色** | 角色B |
| **依赖PR** | PR-5（后端行情API已就绪）、PR-6（已完成） |
| **工作量** | 1小时 |
| **状态** | ✅ 已完成 |

**PR描述**：
将PR-6中使用的mock数据替换为真实后端API调用。删除mockData.ts，行情数据全部来自后端 `/api/market/*` 接口和 WebSocket 推送。

**提交文件**：
```
frontend/src/
├── modules/market/
│   ├── mockData.ts             # 删除
│   ├── store.ts                # 修改：去掉mock初始化，接入真实API
│   └── MarketPanel.tsx         # 修改：启动时调用API获取初始数据
├── services/
│   └── api.ts                  # 修改：实现行情相关API调用
└── hooks/
    └── useMarketWs.ts          # 新增：WebSocket行情推送Hook
```

**实现方式**：
1. 删除 `mockData.ts` 文件
2. 修改 `store.ts`：
   - 去掉 `initMockSnapshots()` 和 `import.meta.env.DEV` 判断
   - snapshots 初始为空 Map
   - 新增 `fetchInstruments()` 方法：调用 `GET /api/market/instruments` 获取合约列表
   - 新增 `subscribeInstruments()` 方法：调用 `POST /api/market/subscribe` 订阅行情
3. 修改 `MarketPanel.tsx`：
   - 组件挂载时调用 `fetchInstruments()` 获取合约列表
   - 调用 `subscribeInstruments()` 订阅默认合约
4. 新增 `useMarketWs.ts` Hook：
   - 连接 `ws://localhost:8000/ws/market`
   - 监听 `market_data` 消息，调用 `updateSnapshot()` 更新 store
   - 自动重连机制
5. 修改 `services/api.ts`：
   - 实现 `getInstruments()` → `GET /api/market/instruments`
   - 实现 `subscribeMarket(instruments)` → `POST /api/market/subscribe`
   - 实现 `getSnapshots(instruments)` → `GET /api/market/snapshots`

**验证方法**：
1. 启动后端（PR-5已完成）
2. 启动前端，确认行情表格显示真实数据（非mock）
3. 确认WebSocket连接建立，行情实时更新
4. 确认合约搜索返回真实合约列表

**验收标准**：
- [ ] mockData.ts 已删除
- [ ] 行情表格显示后端真实数据
- [ ] WebSocket行情推送正常工作
- [ ] 合约搜索使用后端合约列表
- [ ] 无mock数据残留

**用户手动验证**：
1. 启动后端：`cd server && python -m uvicorn main:app --reload --port 8000`
2. 启动前端：`cd frontend && npm run dev`
3. 浏览器访问 http://localhost:5173
4. 确认行情表格显示真实合约数据（非mock数据）

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
| **状态** | ✅ 已完成 |

**提交文件**：
```
server/
├── ws/
│   ├── manager.py              # WebSocket管理器（完善）
│   └── handlers.py             # 消息处理器（完善）
├── ctp_wrapper/
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

**用户手动验证**：
1. 启动后端
2. 浏览器打开开发者工具 → Console
3. 输入 `new WebSocket('ws://localhost:8000/ws/market').onmessage = e => console.log(JSON.parse(e.data))`
4. 确认WebSocket连接成功

---

#### PR-8: 前端五档行情

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-8 |
| **PR标题** | 前端五档行情展示 |
| **PR分支名** | `feature/pr-8-depth-quote` |
| **负责角色** | 角色B |
| **依赖PR** | PR-7（需要WebSocket推送实时行情数据） |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── market/
│       ├── DepthQuote.tsx      # 五档行情组件
│       └── store.ts            # 行情Store（完善depthData）
├── hooks/
│   ├── usePointOrder.ts        # 点价报单Hook（完善）
│   └── useReconnect.ts         # 断线重连Hook（指数退避重试，最多5次）
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
5. 实现useReconnect Hook（断线重连）
   - 监控WebSocket连接状态
   - WebSocket断开时自动重连
   - 指数退避策略（1s, 2s, 4s, 8s, 16s）
   - 最多重试5次
   - 重连成功后恢复订阅

**验证方法**：
1. 五档行情正常显示
2. 点击买价：自动以该价格卖出
3. 点击卖价：自动以该价格买入
4. 价差显示正确
5. 数据实时更新
6. 断线重连机制正常（WebSocket断开后自动重连）

**验收标准**：
- [ ] 五档行情正确显示（买一到买五、卖一到卖五）
- [ ] 点价报单功能正常
- [ ] 价差计算正确
- [ ] 数据实时更新
- [ ] 样式美观，易于阅读
- [ ] 断线重连机制正常（指数退避，最多5次重试）

**用户手动验证**：
1. 启动前端，访问行情面板
2. 点击任意合约，确认五档行情显示
3. 确认买一到买五、卖一到卖五价格和数量正确

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
| **状态** | ✅ 已完成（2026-07-20，PR #12，32 commits，391 tests） |

**提交文件**：
```
server/
├── api/
│   └── order.py                # 报单接口（完善）
├── ctp_wrapper/
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
   - 字段映射：CTP对象 → camelCase字典（见 `ctp-api-structure.txt`）
2. 实现报单管理服务（OrderManager）
   - 报单状态跟踪（维护活动报单表，基于 orderRef + orderSysID）
   - GFD有效期处理（当日有效，依赖simnow柜台自动撤销）
   - FOK成交方式处理（全部成交或全部撤销，VolumeCondition=ALL）
   - FAK成交方式处理（部分成交，剩余撤销，VolumeCondition=ANY）
   - 报单引用管理（orderRef映射，sessionID + frontID）
3. 实现报单API接口
   - POST /api/order/insert（报单，使用 CThostFtdcInputOrderField）
   - POST /api/order/cancel（撤单，使用 CThostFtdcInputOrderActionField）
   - POST /api/order/cancel_all（批量撤单）
   - POST /api/order/reverse（一键反向）
   - POST /api/order/lock（一键锁仓）
   - GET /api/order/status/{order_ref}（查询报单状态）
4. 实现报单参数校验
   - 价格校验（>0，符合最小变动价位 priceTick）
   - 数量校验（>0，不超过 maxLimitOrderVolume/maxMarketOrderVolume）
   - 合约校验（存在且可交易 isTrading=1）
5. 实现WebSocket报单推送
   - 报单回报 → WebSocket推送（order_return）
   - 成交回报 → WebSocket推送（trade_return）
   - 消息格式：`{ type: 'order_return', data: OrderReturn }`

**真实API字段参考**：
- 报单请求字段：`ctp-api-structure.txt` → OrderRequest（30+字段）
  - 关键字段：instrumentID, direction, offsetFlag, priceType, limitPrice, volumeTotalOriginal
  - 条件字段：contingentCondition, timeCondition, volumeCondition
- 报单回报字段：`ctp-api-structure.txt` → OrderReturn（50+字段）
  - 关键字段：orderRef, orderSysID, orderStatus, volumeTraded, volumeTotal
  - 状态字段：orderSubmitStatus, statusMsg
- 成交回报字段：`ctp-api-structure.txt` → TradeReturn（30+字段）
  - 关键字段：tradeID, price, volume, tradeTime, offsetFlag

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

**用户手动验证**：
1. 启动后端
2. 测试报单接口：`curl -X POST http://localhost:8000/api/order/insert -H "Content-Type: application/json" -d "{\"instrumentID\":\"IF2608\",\"direction\":\"0\",\"combOffsetFlag\":\"0\",\"limitPrice\":4800.0,\"volumeTotalOriginal\":1}"`
3. 确认返回orderRef
4. 测试撤单接口

---

#### PR-19: 后端合约查询API

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-19 |
| **PR标题** | 后端合约查询API（CTP ReqQryInstrument） |
| **PR分支名** | `feature/pr-19-instrument-query-api` |
| **负责角色** | 角色A |
| **依赖PR** | PR-9（需要 TraderApi 连接） |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
server/
├── ctp_wrapper/
│   ├── trader_api.py           # 新增 query_instruments() 方法
│   └── callback.py             # 新增 OnRspQryInstrument 回调
├── api/
│   └── market.py               # 新增 POST /api/market/instruments/refresh
├── services/
│   └── market_service.py       # 新增 refresh_instruments_from_ctp()
└── data/
    └── instruments.json        # 合约缓存文件（查询后自动更新）
```

**PR描述**：
从 CTP 查询全量合约列表，结果缓存到 instruments.json，提供刷新接口。

**实现方式**：
1. TraderApi 新增 `query_instruments()` 方法
   - 调用 `ReqQryInstrument(pQryInstrument, nRequestID)`
   - 回调 `OnRspQryInstrument` 接收数据（`bIsLast=False` 时持续接收）
   - 收集完整列表后写入 `instruments.json`
2. callback.py 新增 `OnRspQryInstrument` 回调
   - TraderSpi 新增 `_td_on_rsp_instrument` 方法
   - 事件分发 `OnRspQryInstrument`
3. 新增 `POST /api/market/instruments/refresh` 端点
   - 调用 `TraderApi.query_instruments()`
   - 返回 `{ status: "started" }`（异步操作）
   - 查询完成后 WebSocket `/ws/system` 推送 `instruments_refreshed` 消息

**验证方法**：
1. 调用刷新接口，确认返回 `{ status: "started" }`
2. 确认 `instruments.json` 文件已更新（合约数量 > 8）
3. 确认 WebSocket 推送 `instruments_refreshed` 消息

**验收标准**：
- [ ] ReqQryInstrument 查询正常
- [ ] OnRspQryInstrument 回调正确接收合约数据
- [ ] instruments.json 缓存文件自动更新
- [ ] WebSocket 推送通知正常

**用户手动验证**：
1. 启动后端，确认 CTP 登录成功
2. 调用 `curl -X POST http://localhost:8000/api/market/instruments/refresh`
3. 确认 `server/data/instruments.json` 已更新

---

#### PR-20: 前端合约刷新功能

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-20 |
| **PR标题** | 前端合约刷新功能（刷新按钮 + Toast） |
| **PR分支名** | `feature/pr-20-instrument-refresh-ui` |
| **负责角色** | 角色B |
| **依赖PR** | PR-19（需要后端刷新接口） |
| **工作量** | 1小时 |
| **状态** | ✅ 已完成 |

**实际实现说明**：

PR-20 的实现超出了原始设计范围，通过 InstrumentSearchModal 模态框提供了合约搜索和订阅功能，实际提交文件包含 InstrumentSearchModal、Toast、合约搜索 API、contracts Store 等。验收标准已全部满足：按钮触发后端查询 ✅、Toast 提示更新数量 ✅、合约列表自动刷新 ✅、模态框搜索 ✅、订阅/退订 ✅、localStorage 持久化 ✅。

---

#### PR-10: 前端报单表单

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-10 |
| **PR标题** | 前端报单表单实现 |
| **PR分支名** | `feature/pr-10-order-form` |
| **负责角色** | 角色B |
| **依赖PR** | PR-9（报单表单需要后端交易API） |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成（2026-07-20，PR #16，12 commits，274 tests） |

**提交文件**：
```
frontend/src/
├── modules/
│   └── order/
│       ├── OrderForm.tsx       # 报单表单组件
│       ├── StopOrderForm.tsx   # 止损单表单组件（完整实现）
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
   - 报单有效期选择（GFD/IOC/FOK/FAK）
   - 价格输入（支持步进调整）
   - 数量输入（支持步进调整）
   - 提交按钮（买入/卖出）
   - 报单确认反馈（Toast提示：成功/失败+orderRef）

**⚠️ 前后端字段映射（重要）**：

前端使用人类可读字符串，后端使用CTP字符码。前端提交报单时需要转换：

| 字段 | 前端格式 | 后端CTP格式 |
|------|----------|-------------|
| direction | `'buy'` / `'sell'` | `"0"` / `"1"` |
| combOffsetFlag | `'open'` / `'close'` / `'close_today'` | `"0"` / `"1"` / `"3"` |
| orderPriceType | `'limit'` / `'market'` | `"2"` / `"1"` |
| timeCondition | `'gfd'` / `'fok'` / `'fak'` | `"1"` / `"2"` / `"3"` |

**前端转换方案**（在前端api.ts或store中实现）：
```typescript
// 前端提交时转换
const DIRECTION_MAP = { buy: '0', sell: '1' }
const OFFSET_MAP = { open: '0', close: '1', close_today: '3' }
const PRICE_TYPE_MAP = { limit: '2', market: '1' }
const TIME_CONDITION_MAP = { gfd: '1', fok: '2', fak: '3' }

function convertOrderRequest(form: OrderRequest) {
  return {
    ...form,
    direction: DIRECTION_MAP[form.direction],
    combOffsetFlag: OFFSET_MAP[form.combOffsetFlag],
    orderPriceType: PRICE_TYPE_MAP[form.orderPriceType],
    timeCondition: TIME_CONDITION_MAP[form.timeCondition],
  }
}
```

**后端返回数据转换**（后端返回CTP格式，前端显示时转换）：
```typescript
// 后端返回时转换（用于显示）
const DIRECTION_REVERSE = { '0': 'buy', '1': 'sell' }
const OFFSET_REVERSE = { '0': 'open', '1': 'close', '3': 'close_today' }
const ORDER_STATUS_MAP = { '0': 'all_traded', '1': 'partial', '2': 'no_traded', '5': 'canceled' }
```
2. 实现价格步进Hook（usePriceStep）
   - 根据合约最小变动价位自动对齐
   - 支持+/-按钮调整
3. 实现快捷键Hook（基础框架）
   - B键：快速买入
   - S键：快速卖出
   - C键：撤销当前合约所有未成交报单
   - 仅报单面板焦点时生效
4. 实现报单Store（完善）
   - orderForm: OrderRequest（包含timeCondition字段）
   - setOrderForm: 更新表单数据
   - submitOrder: 提交报单（传递timeCondition给后端）
   - cancelOrder: 撤单
   - 报单提交后显示Toast提示（成功显示orderRef，失败显示错误信息）
5. 实现止损单表单（完整实现）
   - 合约代码输入（自动填充）
   - 买卖方向选择（买/卖）
   - 开平标志选择（开/平/平今）
   - 报单价格输入
   - 报单数量输入
   - 止损价输入
   - 提交止损单按钮
   - 止损单提交后显示Toast提示

**验证方法**：
1. 报单表单正常显示
2. 限价/市价切换正常
3. 开平切换正常
4. 价格步进调整正常
5. 快捷键操作正常（B/S/C）
6. 提交报单正常
7. 表单校验正常
8. 报单有效期切换正常（GFD/IOC/FOK/FAK）
9. GFD报单提交正常（当日有效）
10. FOK报单提交正常（全部成交或全部撤销）
11. FAK报单提交正常（部分成交，剩余撤销）
12. 报单确认反馈正常（Toast提示成功/失败）
13. 止损单表单完整显示
14. 止损单提交正常

**验收标准**：
- [ ] 报单表单完整显示
- [ ] 限价/市价切换正常
- [ ] 开平切换正常
- [ ] 价格步进功能正常
- [ ] 快捷键功能正常（B/S/C）
- [ ] 提交报单功能正常
- [ ] 表单校验正常
- [ ] 报单有效期选择正常（GFD/IOC/FOK/FAK）
- [ ] GFD报单提交正常
- [ ] FOK报单提交正常
- [ ] FAK报单提交正常
- [ ] 报单确认Toast提示正常
- [ ] 止损单表单完整显示
- [ ] 止损单提交正常

**用户手动验证**：
1. 启动前端，定位到报单面板
2. 确认限价/市价切换正常
3. 确认价格步进按钮（+/-）正常
4. 按B键确认快速买入
5. 确认报单有效期选择（GFD/IOC/FOK/FAK）正常
6. 测试GFD报单：选择GFD，提交报单，确认Toast提示成功
7. 测试FOK报单：选择FOK，提交报单，确认Toast提示成功
8. 测试FAK报单：选择FAK，提交报单，确认Toast提示成功
9. 确认止损单表单完整显示（合约、方向、开平、价格、数量、止损价）
10. 测试止损单提交：填写止损单表单，提交，确认Toast提示成功

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
| **状态** | ✅ 已完成 |

**提交文件**：
```
server/
├── api/
│   └── query.py                # 查询接口（完善）
├── ctp_wrapper/
│   ├── trader_api.py           # 交易API封装（完善查询功能）
│   └── callback.py             # 回调处理（完善查询回调）
├── services/
│   └── query_service.py        # 查询服务层（新增）
└── models/
    ├── account.py              # 账户数据模型（完善）
    └── contract.py             # 合约数据模型（完善）
```

**PR描述**：
实现查询相关API接口，包括报单流水、成交流水、持仓、账户资金、合约信息查询。

**实现方式**：
1. 完善交易API封装（查询功能）
   - query_orders: 查询报单流水（ReqQryOrder → OnRspQryOrder）
   - query_trades: 查询成交流水（ReqQryTrade → OnRspQryTrade）
   - query_positions: 查询持仓（ReqQryInvestorPosition → OnRspQryInvestorPosition）
   - query_account: 查询账户资金（ReqQryTradingAccount → OnRspQryTradingAccount）
   - query_contracts: 查询合约信息（ReqQryInstrument → OnRspQryInstrument）
2. 实现查询API接口
   - GET /api/query/orders（报单流水，返回 OrderReturn[]）
   - GET /api/query/trades（成交流水，返回 TradeReturn[]）
   - GET /api/query/positions（持仓，返回 PositionInfo[]）
   - GET /api/query/account（账户资金，返回 AccountInfo）
   - GET /api/query/contracts（合约信息，返回 InstrumentInfo[]）
3. 实现查询结果缓存
   - 合约信息缓存（登录后预加载，Map<string, InstrumentInfo>）
   - 其他数据实时查询
4. 实现WebSocket持仓推送
   - 持仓变化 → WebSocket推送（position_update）
   - 消息格式：`{ type: 'position_update', data: PositionInfo }`

**真实API字段参考**：
- 持仓信息字段：`ctp-api-structure.txt` → PositionInfo（40+字段）
  - 关键字段：instrumentID, position, openCost, positionProfit, posiDirection, positionDate
  - 今仓/昨仓：todayPosition, ydPosition
- 账户资金字段：`ctp-api-structure.txt` → AccountInfo（40+字段）
  - 关键字段：balance, available, frozenMargin, currMargin, closeProfit, positionProfit
- 合约信息字段：`ctp-api-structure.txt` → InstrumentInfo（30+字段）
  - 关键字段：instrumentID, instrumentName, productClass, volumeMultiple, priceTick
  - 期权字段：optionsType, strikePrice, underlyingInstrID, underlyingMultiple

**验证方法**：
1. 调用报单流水接口，返回报单记录
2. 调用成交流水接口，返回成交记录
3. 调用持仓接口，返回持仓数据
4. 调用账户资金接口，返回资金数据
5. 调用合约信息接口，返回合约数据
6. 通过WebSocket接收持仓更新

**⚠️ 待修复问题（遗留）**：
- `server/services/market_service.py` 的 subscribe() 和 unsubscribe() 方法在CTP调用失败时仍返回 `{"success": true}`，应返回失败信息。在PR-11开发时一并修复此错误处理逻辑。

**验收标准**：
- [x] 报单流水查询正常
- [x] 成交流水查询正常
- [x] 持仓查询正常
- [x] 账户资金查询正常
- [x] 合约信息查询正常
- [x] WebSocket持仓推送正常

**用户手动验证**：
1. 启动后端
2. 测试持仓查询：浏览器访问 http://localhost:8000/api/query/positions
3. 测试资金查询：浏览器访问 http://localhost:8000/api/query/account
4. 测试合约查询：浏览器访问 http://localhost:8000/api/query/contracts?instruments=IF2608

---

#### PR-12: 前端K线图

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-12 |
| **PR标题** | 前端K线图实现 |
| **PR分支名** | `feature/pr-12-kline-chart` |
| **负责角色** | 角色B |
| **依赖PR** | PR-5（K线图需要行情API获取K线数据） |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

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

**用户手动验证**：
1. 启动前端，点击行情表格中的合约
2. 确认K线图正常显示
3. 切换周期（1m/5m/15m），确认图表更新

---

#### PR-12a: 前端补缺补差

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-12a |
| **PR标题** | 前端补缺补差（WebSocket重连、K线实时更新、PerfMonitor、布局优化） |
| **PR分支名** | `feature/pr-12a-frontend-gaps` |
| **负责角色** | 角色B |
| **依赖PR** | PR-12 |
| **工作量** | 4小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/
├── hooks/
│   ├── useReconnect.ts           # WebSocket断线重连Hook
│   ├── useReconnect.test.ts
│   ├── useMarketWs.ts            # 行情WebSocket Hook（集成重连）
│   └── useMarketWs.test.ts
├── components/
│   ├── PerfMonitor/              # FPS性能监控组件
│   │   ├── index.tsx
│   │   └── index.test.tsx
│   └── ContractSearch/
│       ├── index.tsx             # 合约搜索（键盘导航）
│       └── styles.css
├── modules/market/
│   ├── MarketPanel.tsx           # 布局重构（上表格+五档，下K线全宽）
│   ├── MarketTable.tsx           # 点击修复（闭包陷阱+off-by-one）
│   ├── KLineChart.tsx            # K线修复（缩放保持、时间对齐、排序）
│   ├── store.ts                  # appendKline修复（排序、200根限制）
│   └── styles.css
└── App.tsx                       # PerfMonitor状态栏按钮集成
```

**PR描述**：
补充前端缺失功能和修复已知问题，包括WebSocket断线重连、K线实时更新、性能监控、布局优化等。

**实现方式**：
1. WebSocket断线重连（useReconnect）
   - 指数退避策略（1s→2s→4s→8s→16s）
   - 最大重试5次，超时后停止
   - 类型安全（MessageHandler类型别名）
2. 行情WebSocket Hook（useMarketWs）
   - 集成useReconnect自动重连
   - snapshotToKline时间对齐（时分秒格式，去掉日期）
   - PERIOD_MS常量导出（供历史数据对齐使用）
3. K线图修复
   - dataZoom缩放状态保持（getOption/setOption）
   - getOption()空值保护（防止切换合约崩溃）
   - appendKline排序修复（忽略旧数据、限制200根）
   - setKlineData时间戳排序
4. PerfMonitor性能监控
   - FPS实时监控（requestAnimationFrame计数）
   - 状态栏UI按钮（⚡FPS）
   - 低FPS警告（<30显示红色）
5. 合约搜索键盘导航
   - ↑↓方向键选择下拉项
   - Enter确认选中
   - Escape关闭下拉
   - 循环导航（首→末→首）
6. 行情表格修复
   - 闭包陷阱修复（recordsRef替代闭包变量）
   - off-by-one修复（vtable row 1-based）
   - widthMode: 'adaptive'自动撑满宽度
7. 布局优化
   - 外层垂直Group：[上半部] | [K线图全宽]
   - 上半部水平Group：[行情表格] | [五档行情]
   - K线图撑满底部全宽
8. 涨跌幅计算修正
   - `||` → `??` 空值运算符
   - 结算价优先：preSettlementPrice ?? preClosePrice ?? lastPrice

**验证方法**：
1. WebSocket断网重连测试
2. K线图实时更新、缩放保持
3. 合约搜索键盘操作
4. 行情表格点击选中
5. 布局拖拽调整

**验收标准**：
- [ ] WebSocket断线后自动重连
- [ ] K线图实时更新正常
- [ ] 合约搜索键盘导航正常
- [ ] 行情表格点击选中正常
- [ ] 布局拖拽正常

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
| **状态** | ✅ 已完成 |

**提交文件**：
```
server/
├── api/
│   └── order.py                # 报单接口（完善止损单）
├── services/
│   └── stop_order.py           # 止损单监控服务
├── data/
│   └── stop_orders.json        # 止损单持久化文件
└── tests/
    ├── test_stop_order_service.py  # 服务层测试
    ├── test_stop_order_api.py      # API测试
    └── test_stop_order_integration.py  # 集成测试
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
- [x] 止损单提交正常
- [x] 止损单取消正常
- [x] 止损单查询正常
- [x] 止损单触发逻辑正确
- [x] 触发后自动报单正常
- [x] WebSocket推送正常
- [x] 持久化正常

**用户手动验证**：
1. 启动后端
2. 提交止损单：`curl -X POST http://localhost:8000/api/order/stop -H "Content-Type: application/json" -d "{\"instrumentID\":\"IF2608\",\"direction\":\"1\",\"offsetFlag\":\"1\",\"limitPrice\":4800.0,\"volume\":1,\"stopPrice\":4790.0}"`
3. 查询止损单列表：浏览器访问 http://localhost:8000/api/order/stop/list
4. 取消止损单

---

#### PR-18: 后端期权API实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-18 |
| **PR标题** | 后端期权API实现 |
| **PR分支名** | `feature/pr-18-options-api` |
| **负责角色** | 角色A |
| **依赖PR** | PR-5 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
server/
├── api/
│   └── market.py               # 行情接口（新增期权端点）
├── services/
│   └── options_service.py      # 期权服务层（新增）
└── models/
    └── options.py              # 期权数据模型（OptionChain, VolatilityData）
```

**PR描述**：
实现期权相关API接口，包括期权合约列表、期权T型报价、隐含波动率计算。

**实现方式**：
1. 实现期权服务层（OptionsService）
   - 期权合约筛选（基于 InstrumentInfo.productClass='2'）
   - 期权链聚合（按标的合约+到期日分组）
   - 隐含波动率计算（Black-Scholes模型）
2. 实现期权API接口
   - GET /api/market/options（期权合约列表，返回 InstrumentInfo[]）
   - GET /api/market/option_chain（期权T型报价，返回 OptionChain）
   - GET /api/market/volatility（隐含波动率，返回 VolatilityData）
3. 实现数据模型
   - OptionChain：期权链（underlying, expireDate, calls[], puts[]）
   - OptionQuote：单个期权报价（strikePrice, impliedVolatility）
   - VolatilityData：波动率数据（Black-Scholes参数）

**真实API字段参考**：
- 自定义接口来源：`ctp-api-structure.txt` → 自定义业务接口部分
- 合约筛选：InstrumentInfo.productClass='2'（期权，'1'=期货）
- 期权类型：InstrumentInfo.optionsType（'1'=看涨，'2'=看跌）
- 行权价：InstrumentInfo.strikePrice
- 标的合约：InstrumentInfo.underlyingInstrID

**验证方法**：
1. 调用期权合约列表接口，返回期权合约数据
2. 调用期权T型报价接口，返回按行权价排序的期权链
3. 调用隐含波动率接口，返回Black-Scholes计算结果

**验收标准**：
- [ ] 期权合约列表获取正常（基于productClass筛选）
- [ ] 期权T型报价数据获取正常（按标的+到期日分组）
- [ ] 隐含波动率计算正常（Black-Scholes模型）
- [ ] 看涨/看跌期权正确分类
- [ ] VolatilityData返回完整参数（impliedVolatility, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType）
- [ ] 期权类型映射正确（OptionsType: '1'=看涨, '2'=看跌）

---

#### PR-21: 手动订阅/退订合约

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-21 |
| **PR标题** | 手动订阅/退订合约 |
| **PR分支名** | `feature/pr-21-manual-subscribe` |
| **负责角色** | 角色B |
| **依赖PR** | PR-6a（需要subscribe/unsubscribe接口） |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**实际实现说明**：PR-21 的订阅/退订功能已通过 InstrumentSearchModal + MarketPanel 按钮组 + Contracts Store 实现，功能目标全部覆盖。原始 ContractSearch 增强方案未严格执行，实际方案更强大（支持交易所/品种筛选、CTP 刷新等）。

**提交文件**：
```
与 PR-20 共享以下文件（见 PR-20 提交文件清单）：
frontend/src/
├── components/
│   └── InstrumentSearchModal/   # 合约搜索模态框（订阅入口）
├── modules/market/
│   ├── MarketPanel.tsx          # "已订阅"筛选 + "退订"/"订阅"按钮
│   └── styles.css              # 按钮样式
├── stores/
│   ├── contracts.ts            # 合约Store（订阅/退订状态管理）
│   └── userPrefs.ts            # localStorage 持久化
└── services/
    └── api.ts                  # subscribeMarket / unsubscribeMarket
```

---

#### PR-22: 连接状态指示器完善

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-22 |
| **PR标题** | 连接状态指示器完善（MD/TD状态广播+前端处理） |
| **PR分支名** | `feature/pr-22-connection-status` |
| **负责角色** | 角色A + 角色B（本次两者均由角色B完成） |
| **依赖PR** | PR-9（需要TraderApi连接状态） |
| **工作量** | 1小时 |
| **状态** | ✅ 已完成（审查通过） |

**背景**：
当前MD/TD指示器使用demo方案（前端通过行情数据推断MD状态），需要改为后端主动广播连接状态。
同时，当前登录逻辑存在问题：startup 时 TD 用 `.env` 凭证自动连接，绕过了 `/login` 端点；`ctp_startup.py` 中有两套重复的 TD 连接代码（`start_ctp_trading_connection` 和 `connect_trading`）。

**实际实施（简化方案）**：

讨论后决定取消原设计的 `{status, target}` 格式，简化方案：后端所有广播已统一使用 `{mdConnected}` / `{tdConnected}` 字段，只需修复 MD 断线/重连相关的 3 处遗漏。

**角色A（后端）已完成**：
- `ctp_startup.py`：MD 断线/重连 3 处广播从 `{status}` 改为 `{mdConnected}` 格式（与其他 14 处一致）

**角色B（前端）已完成**：
- `useSystemWs.ts`：删除 `status === 'disconnected'` 兜底分支（不再需要）
- `useMarketWs.ts`：删除 `setMdPhase('connected')` 行情 hack（连接状态由 /ws/system 管理）
- `MarketTable.tsx`：
  - 行情表格涨跌着色（6 列红涨绿跌：最新价/涨跌/涨跌%/买一/卖一）
  - 新增合约品种、交易所、到期日 3 列
  - 合约品种通过 productID 本地映射表显示中文名（132 品种全覆盖）
  - fallback 逻辑修复：昨结算价为 0 时 fallback 到昨收价（解决 CTP DBL_MAX sanitize 导致的着色错乱）

**消息格式**（与现有格式一致，无新增 `target` 字段）：
```typescript
// 后端推送
{
  type: 'connection_status',
  data: {
    mdConnected: boolean,   // MD 连接状态
    tdConnected: boolean,   // TD 连接状态
    reason?: number         // 断连原因（可选）
  }
}
```

**提交文件**：
```
server/services/ctp_startup.py                        # 修改：3 处广播格式统一
frontend/src/hooks/useSystemWs.ts                      # 修改：删除兜底分支
frontend/src/hooks/useMarketWs.ts                      # 修改：删除行情 hack
frontend/src/modules/market/MarketTable.tsx            # 修改：涨跌着色 + 3 新列 + 映射表 + fallback 修复
```

**提交记录**：
- `9a8ebd6` fix(task-22): 统一MD断线/重连广播格式为mdConnected，删除前端demo方案和兜底逻辑
- `ed7d01c` feat(task-22): 行情表格涨跌着色 + 新增交易所/到期日列
- `43ed2e1` feat(task-22): 合约名称列 — productID本地映射中文名
- `ad924f7` fix(task-22): 补全产品映射表 — 132品种全覆盖（5交易所）
- `ef11135` refactor(task-22): 合约名称改为合约品种，取消月份后缀
- `6126ae1` docs(task-22): 文档更新
- `41f3af1` fix(task-22): 昨结算价为0时fallback到昨收价，修复红绿着色错乱

**验收标准**：
- [x] MD连接成功后指示器变绿
- [x] TD连接成功后指示器变绿
- [x] 断连后指示器变红
- [x] 重连后指示器变绿
- [x] 行情表格涨跌着色正确（红涨绿跌，昨结算价为 0 时 fallback 到昨收）

**留待角色A 处理**：
- 登录流程重构（connect_ctp→connect_md 重命名、startup 只连 MD、/login 触发 TD）
- `server/tests/test_ws_integration.py` 仍有旧格式引用，需跟随更新测试

---

#### PR-14: 前端期权T型报价

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-14 |
| **PR标题** | 前端期权T型报价实现 |
| **PR分支名** | `feature/pr-14-option-tquote` |
| **负责角色** | 角色B |
| **依赖PR** | PR-6, PR-18 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/
├── modules/
│   └── options/
│       ├── OptionPanel.tsx        # 期权面板（可搜索标的、重试机制、手动刷新）
│       ├── OptionPanel.test.tsx   # 期权面板测试
│       ├── TQuoteTable.tsx        # T型报价表格（vtable增量更新）
│       ├── TQuoteTable.test.tsx   # T型报价表格测试
│       ├── store.ts               # 期权Store
│       ├── store.test.ts          # 期权Store测试
│       └── styles.css             # 期权面板样式
└── services/
    └── api.ts                     # API封装（期权接口）
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
4. 调用期权API接口（已在PR-18后端实现）
   - GET /api/market/options（获取期权合约列表，返回 InstrumentInfo[]）
   - GET /api/market/option_chain（获取期权T型报价数据，返回 OptionChain）
   - GET /api/market/volatility（获取隐含波动率，返回 VolatilityData）
   - 在T型报价表格中显示隐含波动率列（impliedVolatility）
   - 波动率数据随行情实时更新

**真实API字段参考**：
- 自定义接口来源：`ctp-api-structure.txt` → 自定义业务接口部分
- OptionChain：`{ underlying, expireDate, calls: OptionQuote[], puts: OptionQuote[], updateTime }`
- OptionQuote：`{ instrumentID, strikePrice, lastPrice, bidPrice, askPrice, volume, openInterest, impliedVolatility }`
- VolatilityData：`{ instrumentID, impliedVolatility, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType, updateTime }`
- 合约筛选：基于 InstrumentInfo.productClass='1'（期权）+ InstrumentInfo.optionsType（看涨/看跌）

**验证方法**：
1. 期权面板正常显示
2. T型报价表格正常渲染
3. 看涨/看跌期权正确显示
4. 隐含波动率列正常显示（调用/api/market/volatility）
5. 波动率数据随行情实时更新
6. 点击行权价高亮正常

**已解决问题**：
- vtable 卡死：改为 setRecords 增量更新，不再每次销毁重建
- 后端阻塞事件循环：`async def` 改为 `def`
- 面板简化：改为单合约 T 型报价，移除多合约堆叠
- 标的列表加载：新增 `/api/market/options/underlyings` API + 重试机制 + 手动刷新
- 可搜索标的下拉框：输入关键字实时过滤标的列表

**⚠️ 待修复问题（遗留）**：
- `store.ts` 及 `store.test.ts` 存在 4 个 TypeScript 类型错误（`ApiResponse` 泛型不匹配），运行时正常但需修正类型定义
- `design.md` 中 VolatilityData 定义只有3个字段（instrumentID, impliedVolatility, updateTime），与 `dev.md` 的8个字段不一致。以dev.md的8字段为准。

**验收标准**：
- [x] 期权面板正常显示
- [x] T型报价表格正常渲染
- [x] 看涨/看跌期权正确显示
- [x] 隐含波动率列正常显示
- [x] 波动率数据实时更新
- [x] 交互操作正常

**用户手动验证**：
1. 启动前端，切换到期权面板
2. 选择标的合约（如cu2508）
3. 确认T型报价表格正常显示
4. 确认看涨/看跌期权正确展示

---

#### PR-15: 前端快捷功能

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-15 |
| **PR标题** | 前端快捷功能实现 |
| **PR分支名** | `feature/pr-15-quick-actions` |
| **负责角色** | 角色B |
| **依赖PR** | PR-9, PR-10, PR-11（一键反向需要查询持仓） |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成（C 键快捷撤单 + 一键全部撤单延后至 PR-16，一键反向/锁仓待后端补全） |

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
4. 完善快捷键Hook（useHotKeys）— ⚠️ 初步完成，完整功能延后
   - B键：✅ 快速买入（完整实现）
   - S键：✅ 快速卖出（完整实现）
   - C键：⏳ 当前为 toast 占位（"请使用查询面板撤单"），真正「撤销当前合约所有未成交报单」逻辑延后至 PR-16。需先查询当前合约未成交报单列表（依赖 PR-11 查询 API），再逐个撤单，PR-15 阶段不具备此上下文
   - 仅报单面板焦点时生效
   - 支持自定义快捷键（完整实现）
   - **注意**：`cancelAllOrders()` API 函数已实现并测试通过，但 UI 按钮推迟到 PR-16（OrderFlow 报单流水组件）中实现，C 键快捷撤单也一同在 PR-16 补全，详见 PR-16 第 2 项
5. 实现一键反向逻辑（⚠️ 后端 reverse/lock 为 501 占位，前端已做友好降级提示）
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
- [ ] 一键反向功能正常（⚠️ 后端 501 占位，前端 UI + 降级提示已就绪）
- [ ] 一键锁仓功能正常（⚠️ 后端 501 占位，前端 UI + 降级提示已就绪）
- [ ] 批量撤单功能正常（逐个选中撤单 ✅，一键全部撤单 → PR-16）
- [ ] 快捷键配置正常（自定义键位、保存/恢复默认、去重校验 ✅）
- [ ] 快捷键操作正常（B/S 键 ✅，C 键 toast 占位，完整逻辑 → PR-16）
- [ ] localStorage 持久化正常

**用户手动验证**：
1. 启动前端，定位到报单面板
2. 点击"一键反向"按钮
3. 点击"批量撤单"按钮
4. 打开快捷键配置面板，修改快捷键映射

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
| **状态** | ✅ 已完成（审查反馈已修复） |

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
   - 报单流水表格（字段：OrderReturn）
   - 增量更新（新数据插入顶部）
   - 新数据高亮（2秒）
   - 时间倒序
   - 撤单按钮（针对未成交报单，点击调用 /api/order/cancel）
   - **「撤销全部未成交报单」按钮**（列表顶部，调用 `cancelAllOrders()` → POST /api/order/cancel_all。此 API 函数已在 PR-15 实现并测试通过，前端直接 import 使用即可）
   - **C 键快捷撤单**（继承 PR-15 的 useHotKeys，在查询面板焦点时按 C 键撤销当前选中合约的所有未成交报单。PR-15 中 C 键为 toast 占位，此处补全实际逻辑）
3. 实现TradeFlow组件
   - 成交流水表格（字段：TradeReturn）
   - 增量更新
   - 新数据高亮
   - 时间倒序
4. 实现Position组件
   - 持仓表格（字段：PositionInfo）
   - 点击持仓直接平仓
   - 持仓盈亏显示（positionProfit）
5. 实现AccountQuery组件
   - 账户资金信息展示（字段：AccountInfo）
   - 可用余额（available）、冻结资金（frozenMargin）、持仓盈亏（positionProfit）
   - 实时更新
6. 实现QuoteQuery组件
   - 五档行情深度展示（字段：MarketSnapshot bidPrice1-5, askPrice1-5）
   - 支持多合约切换
7. 实现ContractQuery组件
   - 合约详细信息展示（字段：InstrumentInfo）
   - 合约乘数（volumeMultiple）、最小变动价位（priceTick）
8. 实现StopOrderList组件
   - 止损单列表
   - 止损单状态显示（pending/triggered/canceled/trigger_failed）
   - 取消止损单操作
9. 实现查询Store完善
   - orders: OrderReturn[], trades: TradeReturn[], positions: PositionInfo[]
   - account: AccountInfo, quotes: Map<string, MarketSnapshot>
   - contracts: Map<string, InstrumentInfo>, stopOrders: StopOrder[]
   - isPaused: 暂停更新
   - 增量更新方法

**真实API字段参考**：
- 所有类型定义见 `ctp-api-structure.txt`
- 报单回报：OrderReturn（50+字段，关键：orderRef, orderStatus, instrumentID, direction, volumeTraded）
- 成交回报：TradeReturn（30+字段，关键：tradeID, price, volume, tradeTime）
- 持仓信息：PositionInfo（40+字段，关键：instrumentID, position, openCost, positionProfit）
- 账户资金：AccountInfo（40+字段，关键：balance, available, frozenMargin, currMargin）
- 合约信息：InstrumentInfo（30+字段，关键：instrumentID, volumeMultiple, priceTick, productClass）

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
12. 报单流水撤单按钮正常（未成交报单显示撤单按钮）

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
- [ ] 报单流水单个撤单功能正常
- [ ] 报单流水「撤销全部未成交报单」按钮正常（调用 PR-15 已实现的 cancelAllOrders）

**用户手动验证**：
1. 启动前端，定位到查询面板
2. 切换Tab：报单流水、成交流水、持仓、资金
3. 确认数据正常显示
4. 点击暂停更新，确认数据停止刷新

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

**用户手动验证**：
1. 同时启动前端和后端
2. 完整流程：登录 → 订阅行情 → 报单 → 查询
3. 确认WebSocket推送正常
4. 测试断网重连

---

## 3. PR依赖关系图

**设计原则**：前端PR必须等对应后端API完成后再开发，直接调用真实接口，不使用mock数据。

```
阶段1: 基础框架
PR-1 (CTP验证) ──►PR-3 (FastAPI框架)
PR-2 (前端初始化)  ← 无依赖，可与PR-1/PR-3并行

阶段2: 行情模块（后端先行）
PR-3 ──►PR-5 (行情API) ──►PR-4 (前端布局) ──►PR-6 (行情表格)
                                    │
PR-5 ──►PR-7 (WebSocket) ──►PR-8 (五档行情)
                                    │
PR-5 ──►PR-12 (K线图)              │
PR-5 ──►PR-18 (期权API) ──►PR-14 (期权T型报价)

阶段3: 交易模块（后端先行）
PR-7 ──►PR-9 (交易API) ──►PR-19 (合约查询API) ──►PR-20 (合约刷新UI)
                   │                    └──►PR-21 (手动订阅) ←── PR-6a
                   └──►PR-10 (报单表单) ──►PR-15 (快捷功能) ←── PR-11

阶段4: 查询模块（后端先行）
PR-9 ──►PR-11 (查询API) ──►PR-16 (查询面板)
PR-9 ──►PR-13 (止损单)   ──►PR-16 (查询面板)

阶段5: 联调优化
PR-1~16,PR-18~21 ──►PR-17 (联调测试)
```

**并行开发建议**：
- PR-1 和 PR-2 可以并行开发（无依赖）
- PR-3 完成后，PR-5 可以开始（依赖FastAPI框架）
- PR-2 完成后，PR-4 可以开始（前端布局不需要后端数据）
- PR-5 完成后，PR-6/7/12/18 可以并行开发（都依赖行情API）
- PR-7 完成后，PR-8/9 可以并行开发（分别依赖WebSocket和交易API）
- PR-9 完成后，PR-10/11/13 可以并行开发（都依赖交易API）
- PR-10 完成后，PR-15 可以开始（快捷功能依赖报单表单）
- PR-11 和 PR-13 完成后，PR-16 可以开始（查询面板需要查询API和止损单服务）
- PR-18 完成后，PR-14 可以开始（期权T型报价依赖期权API）
- PR-9 完成后，PR-19 可以开始（合约查询需要 TraderApi）
- PR-19 完成后，PR-20 可以开始（前端刷新需要后端接口）
- PR-6a 完成后，PR-21 可以开始（手动订阅只需要subscribe/unsubscribe接口）

---

## 4. 里程碑对应

| 里程碑 | PR范围 | 说明 | 对应Week |
|--------|--------|------|----------|
| **M0** | PR-1, PR-2 | 基础框架（CTP验证 + 前端初始化） | Week 1 Day 1-2 |
| **M1** | PR-3, PR-4, PR-5, PR-6 | 框架搭建 + 行情模块启动 | Week 1 Day 3-5 |
| **M2** | PR-7, PR-8, PR-9, PR-10, PR-11, PR-12 | 行情完善 + 交易模块 | Week 2 |
| **M3** | PR-13, PR-14, PR-15, PR-16, PR-18 | 高级功能 | Week 3 Day 1-4 |
| **M3+** | PR-19, PR-20, PR-21 | 合约查询 + 手动订阅 | Week 3 Day 4-5 |
| **M4** | PR-17 | 联调测试与Bug修复 | Week 3 Day 5 |

---

## 5. 开发日志

| 日期 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 2026-07-08 | v1.0 | 初始化task.md：17个PR任务拆分 | ✅ 完成 |
| 2026-07-08 | v1.1 | 修复任务分工问题：期权API、资金查询、依赖关系、职责边界等 | ✅ 完成 |
| 2026-07-08 | v1.2 | 修复PR-14 API描述混淆，明确后端API职责 | ✅ 完成 |
| 2026-07-10 | v1.3 | 里程碑与task-dev-flow.md对齐，openctp-ctp改为ctp-python | ✅ 完成 |
| 2026-07-10 | v1.4 | 基于ctp-api-structure.txt真实API字段更新PR-2/5/9/11/14/16 | ✅ 完成 |
| 2026-07-10 | v1.5 | 修复ctp_wrapper命名、PR-2状态、PR-1工作量；新增PR-18期权API | ✅ 完成 |
| 2026-07-13 | v1.6 | 更新PR-1/3/4/6状态为已完成（合并后） | ✅ 完成 |
| 2026-07-10 | v1.5 | 每个PR增加用户手动验证提示 | ✅ 完成 |
| 2026-07-13 | v1.6 | 前端PR依赖后端API先行，去掉mock数据，直接调用真实接口 | ✅ 完成 |
| 2026-07-14 | v1.7 | PR-5后端行情API合并，更新PR-5状态+提交文件清单 | ✅ 完成 |
| 2026-07-15 | v1.8 | 修复PR-21依赖（改为PR-6a）、PR-18验收标准补充Black-Scholes验证、修复文档间状态不一致 | ✅ 完成 |
| 2026-07-15 | v1.9 | PR-10补充GFD/FOK/FAK报单有效期选择UI（PRD F2.4-F2.6要求） | ✅ 完成 |
| 2026-07-15 | v2.0 | 修复6处遗漏：PR-10报单确认反馈+止损单表单、PR-15依赖PR-11、PR-16撤单按钮、PR-14波动率调用、PR-6涨跌幅 | ✅ 完成 |
| 2026-07-15 | v2.1 | 补充PR-6 PerfMonitor组件实现（PRD F5.4渲染性能监控） | ✅ 完成 |
| 2026-07-15 | v2.2 | 补充PR-8 useReconnect Hook实现（PRD F4.3断线重连） | ✅ 完成 |
| 2026-07-24 | v2.3 | PR-22 连接状态指示器完善（简化方案：修复广播格式+涨跌着色+合约品种映射） | ✅ 完成 |
