# Design: 后端 PR-1 CTP连接验证 + PR-3 FastAPI框架

**日期**: 2026-07-10
**范围**: server/ 目录，阶段1基础框架的后端部分
**依赖规范**: docs/task.md, docs/design.md

---

## 1. PR-1: 后端CTP连接验证（技术Spike）

### 1.1 目标

验证 ctp-python 库的可行性，完成 CTP 连接、登录、行情订阅、报单提交的基础流程验证。

### 1.2 文件结构

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

### 1.3 模块设计

#### config.py — 配置管理

- 从 `.env` 文件读取环境变量
- 账号密码字段留空，用注释标注填写位置
- 配置项：
  - `BROKER_ID`: 经纪商代码（默认 `9999`）
  - `USER_ID`: 用户ID（⚠️ 需填写SimNow账户）
  - `PASSWORD`: 密码（⚠️ 需填写SimNow密码）
  - `MD_FRONT`: 行情前置地址
  - `TD_FRONT`: 交易前置地址
  - `APP_ID`: 产品名称（默认 `simnow_client_test`）
  - `AUTH_CODE`: 授权编码（默认 16个0）

```python
# .env 示例
SIMNOW_BROKER_ID=9999
SIMNOW_USER_ID=              # ⚠️ 填写SimNow账户ID
SIMNOW_PASSWORD=              # ⚠️ 填写SimNow密码
SIMNOW_MD_FRONT=tcp://182.254.243.31:40011
SIMNOW_TD_FRONT=tcp://182.254.243.31:40001
SIMNOW_APP_ID=simnow_client_test
SIMNOW_AUTH_CODE=0000000000000000
```

#### ctp/md_user_api.py — 行情API封装

- 封装 `CThostFtdcMdApi` 的连接、登录、订阅、退订流程
- SPI 回调类 `MdSpi`：
  - `OnFrontConnected` → 自动登录
  - `OnRspUserLogin` → 登录结果处理
  - `OnRtnDepthMarketData` → 行情数据回调
  - `OnRspSubMarketData` → 订阅结果回调
  - `OnFrontDisconnected` → 断线处理
- ⚠️ `SubscribeMarketData` 必须传字符串列表，不能传 bytes

#### ctp/trader_api.py — 交易API封装

- 封装 `CThostFtdcTraderApi` 的连接、认证、登录、报单、撤单流程
- SPI 回调类 `TraderSpi`：
  - `OnFrontConnected` → 自动认证
  - `OnRspAuthenticate` → 认证成功后登录
  - `OnRspUserLogin` → 登录成功后确认结算信息
  - `OnRtnOrder` → 报单回报
  - `OnRtnTrade` → 成交回报
  - `OnErrRtnOrderInsert` → 报单错误回报
- 穿透式认证流程：连接 → ReqAuthenticate → ReqUserLogin → ReqSettlementInfoConfirm
- 报单引用管理：自增 `order_ref` 计数器

#### ctp/types.py — CTP数据类型

- 定义 CTP 常量映射（Direction、OffsetFlag、OrderStatus 等）
- 基于 `ThostFtdcUserApiStruct.h` 和 `ThostFtdcUserApiDataType.h`

#### ctp/callback.py — 回调处理基础框架

- 定义回调接口（本PR仅打印日志，PR-7完善为WebSocket推送）
- `on_market_data(data)` — 行情回调
- `on_order_return(data)` — 报单回报回调
- `on_trade_return(data)` — 成交回报回调
- `on_connection_status(connected)` — 连接状态回调

#### main.py — 验证入口

- 简化版入口，仅用于CTP连接验证
- 启动行情和交易API，验证完整流程
- 运行方式：`python main.py`（非uvicorn）

### 1.4 关键注意事项

1. **SubscribeMarketData参数**: 必须传字符串列表 `["au2506"]`，传bytes `[b"au2506"]` 会导致堆损坏崩溃
2. **穿透式认证**: 交易接口必须先 ReqAuthenticate 再 ReqUserLogin
3. **GBK编码**: ctp-python 已自动处理GBK→UTF-8转换，无需手动处理
4. **7x24环境**: 使用第二套服务器地址（182.254.243.31），非交易时段无行情推送
5. **市价单验证**: 需验证 simnow 是否支持 OrderPriceType=ANYPRICE

### 1.5 验收标准

- [ ] 能通过 ctp-python 成功加载并创建 API 实例
- [ ] 能成功连接到 simnow 模拟柜台并登录
- [ ] 能成功订阅合约（使用字符串列表）
- [ ] 能收到行情回调（OnRtnDepthMarketData）
- [ ] 能成功提交一笔报单并收到回报（OnRtnOrder）
- [ ] 验证 simnow 是否支持市价单

---

## 2. PR-3: 后端FastAPI框架搭建

### 2.1 目标

搭建 FastAPI 应用框架，实现连接管理接口、WebSocket 分端点框架、数据模型定义。本PR只实现基础框架，消息分发、断线重连、回调处理在 PR-7 实现。

### 2.2 依赖

- PR-1（CTP封装层已完成验证和封装）

### 2.3 文件结构

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

### 2.4 模块设计

#### main.py — FastAPI应用入口

- 创建 FastAPI 应用实例
- 配置 CORS（允许前端 localhost:5173 访问）
- 注册路由：connection、market、order、query
- 注册 WebSocket 端点：ws/market、ws/order、ws/position、ws/stop、ws/system
- 全局异常处理
- 启动方式：`uvicorn main:app --reload --port 8000`

#### api/connection.py — 连接管理接口

- `POST /api/connection/login` — 登录simnow
  - 请求体：`{broker_id, user_id, password, md_front, td_front}`
  - 账号密码从请求传入，不硬编码
  - 内部调用 PR-1 的 MdUserApi 和 TraderApi 进行连接
- `POST /api/connection/logout` — 登出
- `GET /api/connection/status` — 获取连接状态
  - 返回：`{md_connected, td_connected}`

#### api/market.py — 行情接口（占位符）

- 路由定义存在但返回501或占位响应
- 后续 PR-5 完善

#### api/order.py — 报单接口（占位符）

- 路由定义存在但返回501或占位响应
- 后续 PR-9 完善

#### api/query.py — 查询接口（占位符）

- 路由定义存在但返回501或占位响应
- 后续 PR-11 完善

#### ws/manager.py — WebSocket连接管理器

- 维护5个端点的连接池（按端点分组）
- 连接/断开处理
- 基础消息广播方法（本PR仅框架，广播逻辑在PR-7完善）
- 端点枚举：market、order、position、stop、system

#### ws/handlers.py — 消息处理器（基础框架）

- 定义处理器接口，本PR仅打印日志
- PR-7 完善消息分发

#### models/ — 数据模型

Pydantic 模型，与 design.md 数据模型一致：

- `market.py`: MarketSnapshot, DepthData, KLineData, QuoteDepth, VolatilityData, OptionContract, OptionChain, OptionQuote
- `order.py`: OrderRequest, StopOrderRequest, StopOrder, OrderRecord, TradeRecord, OrderStatus
- `account.py`: AccountInfo
- `contract.py`: ContractInfo, PositionRecord

错误响应模型：
- `ErrorResponse`: `{success: false, error: {code, message, ctp_error_id?, ctp_error_msg?}}`
- 错误码：PARAM_INVALID, PRICE_INVALID, VOLUME_INVALID, INSTRUMENT_NOT_FOUND, NOT_CONNECTED, ORDER_REJECTED, ORDER_NOT_FOUND, STOP_ORDER_NOT_FOUND, POSITION_NOT_FOUND, SUBSCRIBE_LIMIT, INTERNAL_ERROR, CTP_ERROR

### 2.5 不包含（PR-7实现）

- 消息广播功能
- 断线重连机制
- CTP回调处理（回调转WebSocket推送）
- 消息处理器完善

### 2.6 验收标准

- [ ] FastAPI 服务正常启动
- [ ] API 文档自动生成（/docs）
- [ ] 连接管理接口可用（login/logout/status）
- [ ] WebSocket 分端点设计实现
- [ ] 数据模型定义完整
- [ ] CORS 配置正确

---

## 3. 实现顺序

1. **PR-1 先行** — CTP封装是基础，必须先验证通过
2. **PR-3 后续** — 在PR-1的CTP封装上构建FastAPI框架

## 4. 技术约束

- Python 3.10+
- ctp-python 库（pip install ctp-python）
- FastAPI 0.100+、uvicorn、websockets 11.x、pydantic
- 所有敏感信息（账号密码）通过环境变量传入，代码中不留硬编码值
