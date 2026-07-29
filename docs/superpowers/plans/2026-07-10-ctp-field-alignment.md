# CTP字段对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 design.md、dev.md、task.md 三个文档中的所有数据模型从 snake_case 改为 camelCase，并补全 CTP 全部字段。

**Architecture:** 去掉后端的 camelCase→snake_case 转换层，CTP 字段名全程透传到前端。所有 TypeScript 接口使用 camelCase（与 CTP 官方一致），省略 `reserve1`/`reserve2` 等预留字段和 `this`/`thisown` SWIG 内部字段。

**Tech Stack:** TypeScript, Python, CTP API

## Global Constraints

- 所有 TypeScript 接口字段名使用 camelCase（与 CTP 官方字段名一致）
- 省略 `reserve1`/`reserve2`/`reserve3`/`reserve4`（CTP 预留字段，已废弃）
- 省略 `this`/`thisown`（SWIG 内部字段，前端不使用）
- WebSocket 消息格式中的字段名也统一 camelCase
- 后端 Python 代码中的回调字段名保持 camelCase（与 CTP 一致）

---

### Task 1: 更新 design.md — Section 3.1 WebSocket消息协议

**Files:**
- Modify: `docs/design.md:259-384` (Section 3.1 WebSocket消息协议)

**Interfaces:**
- Consumes: `docs/ctp-api-structure.txt` 中的 TypeScript 接口定义
- Produces: 更新后的 WebSocket 消息格式（camelCase 字段名）

- [ ] **Step 1: 更新 market_data 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `market_data` JSON 示例（约 line 259-296）：

```json
{
  "type": "market_data",
  "data": {
    "tradingDay": "20260710",
    "instrumentID": "au2406",
    "exchangeID": "SHFE",
    "exchangeInstID": "au2406",
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

- [ ] **Step 2: 更新 order_return 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `order_return` JSON 示例（约 line 298-314）：

```json
{
  "type": "order_return",
  "data": {
    "orderRef": "123456",
    "instrumentID": "au2406",
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

- [ ] **Step 3: 更新 trade_return 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `trade_return` JSON 示例（约 line 316-330）：

```json
{
  "type": "trade_return",
  "data": {
    "tradeID": "T789",
    "orderRef": "123456",
    "instrumentID": "au2406",
    "direction": "0",
    "offsetFlag": "0",
    "price": 480.50,
    "volume": 1,
    "tradeTime": "14:30:11"
  }
}
```

- [ ] **Step 4: 更新 position_update 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `position_update` JSON 示例（约 line 332-347）：

```json
{
  "type": "position_update",
  "data": {
    "instrumentID": "au2406",
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

- [ ] **Step 5: 更新 stop_order_update 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `stop_order_update` JSON 示例（约 line 349-360）：

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

- [ ] **Step 6: 更新 connection_status 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `connection_status` JSON 示例（约 line 362-372）：

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

- [ ] **Step 7: 更新 error 消息格式**

Replace `docs/design.md` 中 Section 3.1 的 `error` JSON 示例（约 line 374-384）：

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

- [ ] **Step 8: Commit**

```bash
git add docs/design.md
git commit -m "docs(design): 更新Section 3.1 WebSocket消息格式为camelCase"
```

---

### Task 2: 更新 design.md — Section 3.2 报单数据流

**Files:**
- Modify: `docs/design.md:423-453` (Section 3.2 报单数据流)

**Interfaces:**
- Consumes: `docs/ctp-api-structure.txt` 中的 OrderRequest/OrderReturn 定义
- Produces: 更新后的报单请求/回报格式（camelCase 字段名）

- [ ] **Step 1: 更新报单请求格式**

Replace `docs/design.md` 中 Section 3.2 的报单请求 JSON 示例（约 line 423-435）：

```json
{
  "instrumentID": "au2406",
  "direction": "0",
  "combOffsetFlag": "0",
  "limitPrice": 480.50,
  "volumeTotalOriginal": 1,
  "orderPriceType": "2",
  "timeCondition": "3",
  "stopPrice": 0
}
```

- [ ] **Step 2: 更新报单回报格式**

Replace `docs/design.md` 中 Section 3.2 的报单回报 JSON 示例（约 line 437-453）：

```json
{
  "type": "order_return",
  "data": {
    "orderRef": "123456",
    "instrumentID": "au2406",
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

- [ ] **Step 3: Commit**

```bash
git add docs/design.md
git commit -m "docs(design): 更新Section 3.2 报单数据流为camelCase"
```

---

### Task 3: 更新 design.md — Section 4.6 数据模型（7个CTP接口）

**Files:**
- Modify: `docs/design.md:716-932` (Section 4.6 数据模型)

**Interfaces:**
- Consumes: `docs/ctp-api-structure.txt` 中的所有 TypeScript 接口定义
- Produces: 7个CTP接口 + 10个自定义业务接口（全部 camelCase）

- [ ] **Step 1: 替换 MarketSnapshot 接口**

Replace `docs/design.md` 中的 `MarketSnapshot` 接口（约 line 730-767）：

```typescript
// 对应CTP: CThostFtdcDepthMarketDataField
interface MarketSnapshot {
  tradingDay: string;           // 交易日
  instrumentID: string;         // 合约代码
  exchangeID: string;           // 交易所代码
  exchangeInstID: string;       // 合约在交易所的代码
  lastPrice: number;            // 最新价
  preSettlementPrice: number;   // 上次结算价
  preClosePrice: number;        // 昨收盘
  preOpenInterest: number;      // 昨持仓量
  openPrice: number;            // 今开盘
  highestPrice: number;         // 最高价
  lowestPrice: number;          // 最低价
  volume: number;               // 成交量
  turnover: number;             // 成交额
  openInterest: number;         // 持仓量
  closePrice: number;           // 今收盘
  settlementPrice: number;      // 本次结算价
  upperLimitPrice: number;      // 涨停板价
  lowerLimitPrice: number;      // 跌停板价
  bidPrice1: number;            // 买一价
  bidVolume1: number;           // 买一量
  askPrice1: number;            // 卖一价
  askVolume1: number;           // 卖一量
  bidPrice2: number;            // 买二价
  bidVolume2: number;           // 买二量
  askPrice2: number;            // 卖二价
  askVolume2: number;           // 卖二量
  bidPrice3: number;            // 买三价
  bidVolume3: number;           // 买三量
  askPrice3: number;            // 卖三价
  askVolume3: number;           // 卖三量
  bidPrice4: number;            // 买四价
  bidVolume4: number;           // 买四量
  askPrice4: number;            // 卖四价
  askVolume4: number;           // 卖四量
  bidPrice5: number;            // 买五价
  bidVolume5: number;           // 买五量
  askPrice5: number;            // 卖五价
  askVolume5: number;           // 卖五量
  averagePrice: number;         // 当日均价
  actionDay: string;            // 业务日期
  updateMillisec: number;       // 最后修改毫秒
  updateTime: string;           // 最后修改时间
  bandingUpperPrice: number;    // 上调上限价
  bandingLowerPrice: number;    // 下调下限价
  currDelta: number;            // 当日虚实度
  preDelta: number;             // 昨日虚实度
}
```

- [ ] **Step 2: 替换 OrderRequest 接口**

Replace `docs/design.md` 中的 `OrderRequest` 接口（约 line 716-728）：

```typescript
// 对应CTP: CThostFtdcInputOrderField
interface OrderRequest {
  brokerID: string;             // 经纪公司代码
  investorID: string;           // 投资者代码
  instrumentID: string;         // 合约代码
  orderRef: string;             // 报单引用
  userID: string;               // 用户代码
  orderPriceType: string;       // 报单价格条件（'1'=市价, '2'=限价）
  direction: string;            // 买卖方向（'0'=买, '1'=卖）
  combOffsetFlag: string;       // 组合开平标志（'0'=开仓, '1'=平仓, '3'=平今）
  combHedgeFlag: string;        // 组合投机套保标志（'1'=投机）
  limitPrice: number;           // 价格
  volumeTotalOriginal: number;  // 数量
  timeCondition: string;        // 有效期（'1'=IOC, '3'=GFD）
  volumeCondition: string;      // 成交量类型（'1'=任何数量）
  minVolume: number;            // 最小成交量
  contingentCondition: string;  // 触发条件（'1'=立即）
  stopPrice: number;            // 止损价
  forceCloseReason: string;     // 强平原因（'0'=非强平）
  isAutoSuspend: number;        // 自动挂起标志
  isSwapOrder: number;          // 互换单标志
  exchangeID: string;           // 交易所代码
  investUnitID: string;         // 投资单元代码
  accountID: string;            // 账号
  currencyID: string;           // 币种代码
  clientID: string;             // 客户代码
  iPAddress: string;            // IP地址
  macAddress: string;           // MAC地址
  gTDDate: string;              // GTD日期
  businessUnit: string;         // 业务单元
  requestID: number;            // 请求编号
  userForceClose: number;       // 用户强评标志
  orderMemo: string;            // 报单附言
}
```

- [ ] **Step 3: 替换 OrderReturn 接口**

Replace `docs/design.md` 中的 `OrderReturn` 接口（约 line 769-783）：

```typescript
// 对应CTP: CThostFtdcOrderField
interface OrderReturn {
  brokerID: string;             // 经纪公司代码
  investorID: string;           // 投资者代码
  instrumentID: string;         // 合约代码
  orderRef: string;             // 报单引用
  userID: string;               // 用户代码
  orderPriceType: string;       // 报单价格条件
  direction: string;            // 买卖方向
  combOffsetFlag: string;       // 组合开平标志
  combHedgeFlag: string;        // 组合投机套保标志
  limitPrice: number;           // 价格
  volumeTotalOriginal: number;  // 数量
  timeCondition: string;        // 有效期
  volumeCondition: string;      // 成交量类型
  minVolume: number;            // 最小成交量
  contingentCondition: string;  // 触发条件
  stopPrice: number;            // 止损价
  forceCloseReason: string;     // 强平原因
  isAutoSuspend: number;        // 自动挂起标志
  isSwapOrder: number;          // 互换单标志
  exchangeID: string;           // 交易所代码
  investUnitID: string;         // 投资单元代码
  accountID: string;            // 账号
  currencyID: string;           // 币种代码
  clientID: string;             // 客户代码
  iPAddress: string;            // IP地址
  macAddress: string;           // MAC地址
  gTDDate: string;              // GTD日期
  businessUnit: string;         // 业务单元
  requestID: number;            // 请求编号
  userForceClose: number;       // 用户强评标志
  orderMemo: string;            // 报单附言
  // --- 以下为回报特有字段 ---
  orderSysID: string;           // 报单编号
  orderLocalID: string;         // 本地报单编号
  exchangeInstID: string;       // 合约在交易所的代码
  traderID: string;             // 交易所交易员代码
  installID: number;            // 安装编号
  orderSubmitStatus: string;    // 报单提交状态
  orderStatus: string;          // 报单状态
  orderType: string;            // 报单类型
  orderSource: string;          // 报单来源
  statusMsg: string;            // 状态信息
  insertDate: string;           // 报单日期
  insertTime: string;           // 委托时间
  activeTime: string;           // 激活时间
  suspendTime: string;          // 挂起时间
  updateTime: string;           // 最后修改时间
  cancelTime: string;           // 撤销时间
  activeTraderID: string;       // 最后修改交易所交易员代码
  activeUserID: string;         // 操作用户代码
  volumeTraded: number;         // 今成交数量
  volumeTotal: number;          // 剩余数量
  frontID: number;              // 前置编号
  sessionID: number;            // 会话编号
  userProductInfo: string;      // 用户端产品信息
  statusMsg: string;            // 状态信息
  notifySequence: number;       // 通知序列号
  settlementID: number;         // 结算编号
  sequenceNo: number;           // 序列号
  brokerOrderSeq: number;       // 经纪公司报单编号
  participantID: string;        // 会员代码
  clearingPartID: string;       // 清算会员代码
  relativeOrderSysID: string;   // 相关报单
  zCETotalTradedVolume: number; // 郑商所成交数量
}
```

- [ ] **Step 4: 替换 TradeReturn 接口**

Replace `docs/design.md` 中的 `TradeReturn` 接口（约 line 890-902）：

```typescript
// 对应CTP: CThostFtdcTradeField
interface TradeReturn {
  brokerID: string;             // 经纪公司代码
  investorID: string;           // 投资者代码
  instrumentID: string;         // 合约代码
  orderRef: string;             // 报单引用
  userID: string;               // 用户代码
  exchangeID: string;           // 交易所代码
  tradeID: string;              // 成交编号
  orderSysID: string;           // 报单编号
  orderLocalID: string;         // 本地报单编号
  participantID: string;        // 会员代码
  clientID: string;             // 客户代码
  exchangeInstID: string;       // 合约在交易所的代码
  traderID: string;             // 交易所交易员代码
  direction: string;            // 买卖方向
  offsetFlag: string;           // 开平标志
  hedgeFlag: string;            // 投机套保标志
  price: number;                // 价格
  volume: number;               // 数量
  tradeDate: string;            // 成交时期
  tradeTime: string;            // 成交时间
  tradeType: string;            // 成交类型
  tradeSource: string;          // 成交来源
  tradingDay: string;           // 交易日
  settlementID: number;         // 结算编号
  brokerOrderSeq: number;       // 经纪公司报单编号
  sequenceNo: number;           // 序列号
  tradingRole: string;          // 交易角色
  businessUnit: string;         // 业务单元
  clearingPartID: string;       // 清算会员代码
  priceSource: string;          // 成交价来源
  investUnitID: string;         // 投资单元代码
}
```

- [ ] **Step 5: 替换 PositionInfo 接口**

Replace `docs/design.md` 中的 `PositionRecord` 接口（约 line 904-916）：

```typescript
// 对应CTP: CThostFtdcInvestorPositionField
interface PositionInfo {
  instrumentID: string;         // 合约代码
  brokerID: string;             // 经纪公司代码
  investorID: string;           // 投资者代码
  investUnitID: string;         // 投资单元代码
  exchangeID: string;           // 交易所代码
  posiDirection: string;        // 持仓多空方向（'2'=净, '3'=多, '4'=空）
  hedgeFlag: string;            // 投机套保标志
  positionDate: string;        // 持仓日期
  position: number;             // 今日持仓
  ydPosition: number;           // 上日持仓
  todayPosition: number;        // 今日持仓
  openVolume: number;           // 开仓量
  closeVolume: number;          // 平仓量
  openAmount: number;           // 开仓金额
  closeAmount: number;          // 平仓金额
  openCost: number;             // 开仓成本
  positionCost: number;         // 持仓成本
  positionCostOffset: number;   // 持仓成本差值
  positionProfit: number;       // 持仓盈亏
  closeProfit: number;          // 平仓盈亏
  closeProfitByDate: number;    // 逐日平仓盈亏
  closeProfitByTrade: number;   // 逐笔平仓盈亏
  useMargin: number;            // 占用保证金
  preMargin: number;            // 上次占用保证金
  frozenMargin: number;         // 冻结的保证金
  frozenCash: number;           // 冻结的资金
  frozenCommission: number;     // 冻结的手续费
  commission: number;           // 手续费
  cashIn: number;               // 资金差额
  preSettlementPrice: number;   // 上次结算价
  settlementPrice: number;      // 本次结算价
  settlementID: number;         // 结算编号
  longFrozen: number;           // 多头冻结
  longFrozenAmount: number;     // 多头冻结金额
  shortFrozen: number;          // 空头冻结
  shortFrozenAmount: number;    // 空头冻结金额
  exchangeMargin: number;       // 交易所保证金
  marginRateByMoney: number;    // 保证金率
  marginRateByVolume: number;   // 逐笔保证金率
  combPosition: number;         // 组合持仓
  combLongFrozen: number;       // 组合多头冻结
  combShortFrozen: number;      // 组合空头冻结
  strikeFrozen: number;         // 执行冻结
  strikeFrozenAmount: number;   // 执行冻结金额
  abandonFrozen: number;        // 放弃执行冻结
  tradingDay: string;           // 交易日
  tasPosition: number;          // TAS持仓
  tasPositionCost: number;      // TAS持仓成本
  ydStrikeFrozen: number;       // 昨日执行冻结
}
```

- [ ] **Step 6: 替换 AccountInfo 接口**

Replace `docs/design.md` 中的 `AccountInfo` 接口（约 line 815-829）：

```typescript
// 对应CTP: CThostFtdcTradingAccountField
interface AccountInfo {
  accountID: string;            // 资金账号
  brokerID: string;             // 经纪公司代码
  preBalance: number;           // 上次结算准备金
  preMargin: number;            // 上次占用保证金
  interest: number;             // 利息收入
  deposit: number;              // 入金金额
  withdraw: number;             // 出金金额
  frozenMargin: number;         // 冻结的保证金
  frozenCash: number;           // 冻结的资金
  frozenCommission: number;     // 冻结的手续费
  currMargin: number;           // 当前保证金总额
  cashIn: number;               // 资金差额
  commission: number;           // 手续费
  closeProfit: number;          // 平仓盈亏
  positionProfit: number;       // 持仓盈亏
  balance: number;              // 期货结算准备金
  available: number;           // 可用资金
  withdrawQuota: number;        // 可取资金
  preDeposit: number;           // 上次存款额
  preCredit: number;            // 上次信用额度
  credit: number;               // 信用额度
  exchangeMargin: number;       // 交易所保证金
  deliveryMargin: number;       // 投资者交割保证金
  exchangeDeliveryMargin: number; // 交易所交割保证金
  reserveBalance: number;       // 保底期货结算准备金
  currencyID: string;           // 币种代码
  preFundMortgageIn: number;    // 上次货币质入金额
  preFundMortgageOut: number;   // 上次货币质出金额
  fundMortgageIn: number;       // 货币质入金额
  fundMortgageOut: number;      // 货币质出金额
  fundMortgageAvailable: number; // 货币质押余额
  mortgageableFund: number;     // 可质押货币金额
  specProductMargin: number;    // 特殊产品占用保证金
  specProductFrozenMargin: number; // 特殊产品冻结保证金
  specProductCommission: number; // 特殊产品手续费
  specProductFrozenCommission: number; // 特殊产品冻结手续费
  specProductPositionProfit: number; // 特殊产品持仓盈亏
  specProductCloseProfit: number; // 特殊产品平仓盈亏
  specProductPositionProfitByAlg: number; // 根据持仓盈亏算法计算的特殊产品持仓盈亏
  specProductExchangeMargin: number; // 特殊产品交易所保证金
  frozenSwap: number;           // 冻结换汇额度
  remainSwap: number;           // 剩余换汇额度
  bizType: string;              // 业务类型
  tradingDay: string;           // 交易日
  settlementID: number;         // 结算编号
  reserve: number;              // 基本准备金
}
```

- [ ] **Step 7: 替换 InstrumentInfo 接口**

Replace `docs/design.md` 中的 `ContractInfo` 接口（约 line 843-855）：

```typescript
// 对应CTP: CThostFtdcInstrumentField
interface InstrumentInfo {
  instrumentID: string;         // 合约代码
  instrumentName: string;       // 合约名称
  exchangeID: string;           // 交易所代码
  exchangeInstID: string;       // 合约在交易所的代码
  productID: string;            // 产品代码
  productClass: string;         // 产品类型
  deliveryYear: number;         // 交割年份
  deliveryMonth: number;        // 交割月
  maxMarketOrderVolume: number; // 市价单最大下单量
  minMarketOrderVolume: number; // 市价单最小下单量
  maxLimitOrderVolume: number;  // 限价单最大下单量
  minLimitOrderVolume: number;  // 限价单最小下单量
  volumeMultiple: number;       // 合约乘数
  priceTick: number;            // 最小变动价位
  createDate: string;           // 创建日
  openDate: string;             // 上市日
  expireDate: string;           // 到期日
  startDelivDate: string;       // 开始交割日
  endDelivDate: string;         // 结束交割日
  instLifePhase: string;        // 合约生命周期状态
  isTrading: number;            // 当前是否交易
  positionType: string;         // 持仓类型
  positionDateType: string;     // 持仓日期类型
  longMarginRatio: number;      // 多头保证金率
  shortMarginRatio: number;     // 空头保证金率
  maxMarginSideAlgorithm: string; // 是否使用大额单边保证金算法
  underlyingInstrID: string;    // 基础商品代码
  underlyingMultiple: number;   // 基础商品乘数
  strikePrice: number;          // 执行价
  optionsType: string;          // 期权类型
  combinationType: string;      // 组合类型
}
```

- [ ] **Step 8: 更新其他自定义业务接口**

Replace `docs/design.md` 中的以下接口，统一 camelCase：

**OrderStatus**（约 line 918-932）：
```typescript
interface OrderStatus {
  orderRef: string;             // 报单引用
  instrumentID: string;         // 合约代码
  direction: string;            // 买卖方向
  combOffsetFlag: string;       // 开平标志
  limitPrice: number;           // 报单价格
  volumeTotalOriginal: number;  // 报单数量
  volumeTraded: number;         // 已成交数量
  orderStatus: string;          // 报单状态
  statusMsg: string;            // 状态信息
  insertTime: string;           // 报单时间
}
```

**StopOrderRequest**（约 line 785-796）：
```typescript
interface StopOrderRequest {
  instrumentID: string;         // 合约代码
  direction: string;            // 买卖方向
  combOffsetFlag: string;       // 开平标志
  limitPrice: number;           // 报单价格（触发后的报单价格）
  volumeTotalOriginal: number;  // 报单数量
  stopPrice: number;            // 止损价（必填）
  timeCondition: string;        // 有效期（默认'3'=GFD）
}
```

**StopOrder**（约 line 798-813）：
```typescript
interface StopOrder {
  stopOrderRef: string;         // 止损单引用
  instrumentID: string;         // 合约代码
  direction: string;            // 买卖方向
  combOffsetFlag: string;       // 开平标志
  limitPrice: number;           // 报单价格
  volumeTotalOriginal: number;  // 报单数量
  stopPrice: number;            // 止损价
  status: string;               // pending/triggered/trigger_failed/canceled
  triggeredOrderRef?: string;   // 触发后的报单引用
  createdAt: string;            // 创建时间
  triggeredAt?: string;         // 触发时间
}
```

**QuoteDepth**（约 line 831-841）：
```typescript
interface QuoteDepth {
  instrumentID: string;         // 合约代码
  bidPrices: number[];          // 买一到买五价格
  bidVolumes: number[];         // 买一到买五数量
  askPrices: number[];          // 卖一到卖五价格
  askVolumes: number[];         // 卖一到卖五数量
  updateTime: string;           // 更新时间
}
```

**KLineData**（约 line 857-868）：
```typescript
interface KLineData {
  timestamp: number;            // 时间戳
  open: number;                 // 开盘价
  high: number;                 // 最高价
  low: number;                  // 最低价
  close: number;                // 收盘价
  volume: number;               // 成交量
  openInterest: number;         // 持仓量
}
```

**DepthData**（约 line 870-878）：
```typescript
interface DepthData {
  instrumentID: string;         // 合约代码
  bids: Array<{price: number, volume: number}>;  // 买一到买五
  asks: Array<{price: number, volume: number}>;  // 卖一到卖五
  updateTime: string;           // 更新时间
}
```

**VolatilityData**（约 line 880-888）：
```typescript
interface VolatilityData {
  instrumentID: string;         // 合约代码
  impliedVolatility: number;    // 隐含波动率
  updateTime: string;           // 更新时间
}
```

**OptionContract**（约 line 934-947）：
```typescript
interface OptionContract {
  instrumentID: string;         // 合约代码
  instrumentName: string;       // 合约名称
  underlying: string;           // 标的合约
  optionsType: string;          // 期权类型（'1'=看涨, '2'=看跌）
  strikePrice: number;          // 行权价
  expireDate: string;           // 到期日
  volumeMultiple: number;       // 合约乘数
  priceTick: number;            // 最小变动价位
  isTrading: number;            // 是否可交易
}
```

**OptionChain**（约 line 949-958）：
```typescript
interface OptionChain {
  underlying: string;           // 标的合约
  expireDate: string;           // 到期日
  calls: OptionQuote[];         // 看涨期权列表
  puts: OptionQuote[];          // 看跌期权列表
  updateTime: string;           // 更新时间
}

interface OptionQuote {
  instrumentID: string;         // 合约代码
  strikePrice: number;          // 行权价
  lastPrice: number;            // 最新价
  bidPrice: number;             // 买一价
  askPrice: number;             // 卖一价
  volume: number;               // 成交量
  openInterest: number;         // 持仓量
  impliedVolatility: number;    // 隐含波动率
}
```

- [ ] **Step 9: Commit**

```bash
git add docs/design.md
git commit -m "docs(design): 更新Section 4.6数据模型为camelCase，补全CTP全部字段"
```

---

### Task 4: 更新 dev.md — Section 4.2 CTP封装代码

**Files:**
- Modify: `docs/dev.md:398-519` (md_user_api.py 代码)
- Modify: `docs/dev.md:795-898` (trader_api.py 回调代码)

**Interfaces:**
- Consumes: `docs/ctp-api-structure.txt` 中的字段定义
- Produces: 更新后的 CTP 封装代码示例（camelCase 字段名）

- [ ] **Step 1: 更新 OnRtnDepthMarketData 回调**

Replace `docs/dev.md` 中的 `OnRtnDepthMarketData` 回调代码（约 line 498-513）：

```python
def OnRtnDepthMarketData(self, pDepthMarketData):
    """行情数据推送回调 - 核心回调"""
    if self.api.on_market_data:
        # 直接透传CTP字段名（camelCase）
        data = {
            'tradingDay': pDepthMarketData.TradingDay,
            'instrumentID': pDepthMarketData.InstrumentID,
            'exchangeID': pDepthMarketData.ExchangeID,
            'lastPrice': pDepthMarketData.LastPrice,
            'preSettlementPrice': pDepthMarketData.PreSettlementPrice,
            'preClosePrice': pDepthMarketData.PreClosePrice,
            'openPrice': pDepthMarketData.OpenPrice,
            'highestPrice': pDepthMarketData.HighestPrice,
            'lowestPrice': pDepthMarketData.LowestPrice,
            'volume': pDepthMarketData.Volume,
            'turnover': pDepthMarketData.Turnover,
            'openInterest': pDepthMarketData.OpenInterest,
            'closePrice': pDepthMarketData.ClosePrice,
            'settlementPrice': pDepthMarketData.SettlementPrice,
            'upperLimitPrice': pDepthMarketData.UpperLimitPrice,
            'lowerLimitPrice': pDepthMarketData.LowerLimitPrice,
            'bidPrice1': pDepthMarketData.BidPrice1,
            'bidVolume1': pDepthMarketData.BidVolume1,
            'askPrice1': pDepthMarketData.AskPrice1,
            'askVolume1': pDepthMarketData.AskVolume1,
            'bidPrice2': pDepthMarketData.BidPrice2,
            'bidVolume2': pDepthMarketData.BidVolume2,
            'askPrice2': pDepthMarketData.AskPrice2,
            'askVolume2': pDepthMarketData.AskVolume2,
            'bidPrice3': pDepthMarketData.BidPrice3,
            'bidVolume3': pDepthMarketData.BidVolume3,
            'askPrice3': pDepthMarketData.AskPrice3,
            'askVolume3': pDepthMarketData.AskVolume3,
            'bidPrice4': pDepthMarketData.BidPrice4,
            'bidVolume4': pDepthMarketData.BidVolume4,
            'askPrice4': pDepthMarketData.AskPrice4,
            'askVolume4': pDepthMarketData.AskVolume4,
            'bidPrice5': pDepthMarketData.BidPrice5,
            'bidVolume5': pDepthMarketData.BidVolume5,
            'askPrice5': pDepthMarketData.AskPrice5,
            'askVolume5': pDepthMarketData.AskVolume5,
            'averagePrice': pDepthMarketData.AveragePrice,
            'actionDay': pDepthMarketData.ActionDay,
            'updateMillisec': pDepthMarketData.UpdateMillisec,
            'updateTime': pDepthMarketData.UpdateTime,
        }
        self.api.on_market_data(data)
```

- [ ] **Step 2: 更新 subscribe 方法**

Replace `docs/dev.md` 中的 `subscribe` 方法（约 line 411-428）：

```python
def subscribe(self, instruments: list[str]) -> bool:
    """订阅行情"""
    try:
        # ⚠️ 必须传字符串列表，不能传bytes列表！
        ret = self.api.SubscribeMarketData(instruments)
        if ret == 0:
            logger.info(f"行情订阅成功: {instruments}")
            return True
        else:
            logger.error(f"行情订阅失败，返回值: {ret}")
            return False
    except Exception as e:
        logger.error(f"行情订阅异常: {e}")
        return False
```

- [ ] **Step 3: 更新 OnRtnOrder 回调**

Replace `docs/dev.md` 中的 `OnRtnOrder` 回调代码（约 line 795-813）：

```python
def OnRtnOrder(self, pOrder):
    """报单回报"""
    if pOrder:
        data = {
            'brokerID': pOrder.BrokerID,
            'investorID': pOrder.InvestorID,
            'instrumentID': pOrder.InstrumentID,
            'orderRef': pOrder.OrderRef,
            'direction': pOrder.Direction,
            'combOffsetFlag': pOrder.CombOffsetFlag,
            'limitPrice': pOrder.LimitPrice,
            'volumeTotalOriginal': pOrder.VolumeTotalOriginal,
            'volumeTraded': pOrder.VolumeTraded,
            'volumeTotal': pOrder.VolumeTotal,
            'orderStatus': pOrder.OrderStatus,
            'orderPriceType': pOrder.OrderPriceType,
            'timeCondition': pOrder.TimeCondition,
            'statusMsg': pOrder.StatusMsg,
            'insertDate': pOrder.InsertDate,
            'insertTime': pOrder.InsertTime,
            'exchangeID': pOrder.ExchangeID,
            'orderSysID': pOrder.OrderSysID,
            'frontID': pOrder.FrontID,
            'sessionID': pOrder.SessionID,
            'tradingDay': pOrder.TradingDay,
        }
        logger.info(f"报单回报: {data}")
        if 'on_order' in self.api.callbacks:
            self.api.callbacks['on_order'](data)
```

- [ ] **Step 4: 更新 OnRtnTrade 回调**

Replace `docs/dev.md` 中的 `OnRtnTrade` 回调代码（约 line 815-830）：

```python
def OnRtnTrade(self, pTrade):
    """成交回报"""
    if pTrade:
        data = {
            'brokerID': pTrade.BrokerID,
            'investorID': pTrade.InvestorID,
            'instrumentID': pTrade.InstrumentID,
            'orderRef': pTrade.OrderRef,
            'tradeID': pTrade.TradeID,
            'direction': pTrade.Direction,
            'offsetFlag': pTrade.OffsetFlag,
            'hedgeFlag': pTrade.HedgeFlag,
            'price': pTrade.Price,
            'volume': pTrade.Volume,
            'tradeDate': pTrade.TradeDate,
            'tradeTime': pTrade.TradeTime,
            'tradingDay': pTrade.TradingDay,
            'exchangeID': pTrade.ExchangeID,
            'orderSysID': pTrade.OrderSysID,
            'settlementID': pTrade.SettlementID,
        }
        logger.info(f"成交回报: {data}")
        if 'on_trade' in self.api.callbacks:
            self.api.callbacks['on_trade'](data)
```

- [ ] **Step 5: 更新 OnRspQryInvestorPosition 回调**

Replace `docs/dev.md` 中的持仓查询回调（约 line 850-866）：

```python
def OnRspQryInvestorPosition(self, pInvestorPosition, pRspInfo, nRequestID, bIsLast):
    """持仓查询响应"""
    if pRspInfo is not None and pRspInfo.ErrorID != 0:
        logger.error(f"查询持仓失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
        return
    if pInvestorPosition:
        data = {
            'instrumentID': pInvestorPosition.InstrumentID,
            'brokerID': pInvestorPosition.BrokerID,
            'investorID': pInvestorPosition.InvestorID,
            'posiDirection': pInvestorPosition.PosiDirection,
            'hedgeFlag': pInvestorPosition.HedgeFlag,
            'positionDate': pInvestorPosition.PositionDate,
            'position': pInvestorPosition.Position,
            'ydPosition': pInvestorPosition.YdPosition,
            'todayPosition': pInvestorPosition.TodayPosition,
            'openCost': pInvestorPosition.OpenCost,
            'positionCost': pInvestorPosition.PositionCost,
            'positionProfit': pInvestorPosition.PositionProfit,
            'closeProfit': pInvestorPosition.CloseProfit,
            'useMargin': pInvestorPosition.UseMargin,
            'exchangeMargin': pInvestorPosition.ExchangeMargin,
            'tradingDay': pInvestorPosition.TradingDay,
        }
        if 'on_position' in self.api.callbacks:
            self.api.callbacks['on_position'](data, bIsLast)
```

- [ ] **Step 6: 更新 OnRspQryTradingAccount 回调**

Replace `docs/dev.md` 中的资金查询回调（约 line 868-884）：

```python
def OnRspQryTradingAccount(self, pTradingAccount, pRspInfo, nRequestID, bIsLast):
    """资金查询响应"""
    if pRspInfo is not None and pRspInfo.ErrorID != 0:
        logger.error(f"查询资金失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
        return
    if pTradingAccount:
        data = {
            'accountID': pTradingAccount.AccountID,
            'brokerID': pTradingAccount.BrokerID,
            'balance': pTradingAccount.Balance,
            'available': pTradingAccount.Available,
            'frozenMargin': pTradingAccount.FrozenMargin,
            'currMargin': pTradingAccount.CurrMargin,
            'commission': pTradingAccount.Commission,
            'closeProfit': pTradingAccount.CloseProfit,
            'positionProfit': pTradingAccount.PositionProfit,
            'deposit': pTradingAccount.Deposit,
            'withdraw': pTradingAccount.Withdraw,
            'preBalance': pTradingAccount.PreBalance,
            'tradingDay': pTradingAccount.TradingDay,
        }
        if 'on_account' in self.api.callbacks:
            self.api.callbacks['on_account'](data)
```

- [ ] **Step 7: 更新 OnRspQryInstrument 回调**

Replace `docs/dev.md` 中的合约查询回调（约 line 831-849）：

```python
def OnRspQryInstrument(self, pInstrument, pRspInfo, nRequestID, bIsLast):
    """合约查询响应"""
    if pRspInfo is not None and pRspInfo.ErrorID != 0:
        logger.error(f"查询合约失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
        return
    if pInstrument:
        data = {
            'instrumentID': pInstrument.InstrumentID,
            'instrumentName': pInstrument.InstrumentName,
            'exchangeID': pInstrument.ExchangeID,
            'productID': pInstrument.ProductID,
            'productClass': pInstrument.ProductClass,
            'volumeMultiple': pInstrument.VolumeMultiple,
            'priceTick': pInstrument.PriceTick,
            'expireDate': pInstrument.ExpireDate,
            'openDate': pInstrument.OpenDate,
            'isTrading': pInstrument.IsTrading,
            'longMarginRatio': pInstrument.LongMarginRatio,
            'shortMarginRatio': pInstrument.ShortMarginRatio,
            'underlyingInstrID': pInstrument.UnderlyingInstrID,
            'strikePrice': pInstrument.StrikePrice,
            'optionsType': pInstrument.OptionsType,
        }
        if 'on_instrument' in self.api.callbacks:
            self.api.callbacks['on_instrument'](data, bIsLast)
```

- [ ] **Step 8: Commit**

```bash
git add docs/dev.md
git commit -m "docs(dev): 更新Section 4.2 CTP封装代码为camelCase，补全字段"
```

---

### Task 5: 更新 dev.md — Section 6.2 WebSocket消息契约

**Files:**
- Modify: `docs/dev.md:1080-1130` (Section 6.2 WebSocket消息契约)

**Interfaces:**
- Consumes: design.md 中更新后的接口定义
- Produces: 更新后的 WebSocket 消息契约（camelCase 字段名）

- [ ] **Step 1: 替换所有 WebSocket 消息接口**

Replace `docs/dev.md` 中 Section 6.2 的所有 TypeScript 接口定义（约 line 1080-1130）：

```typescript
// 行情推送
interface MarketDataMessage {
  type: 'market_data';
  data: MarketSnapshot;
}

// 报单回报
interface OrderReturnMessage {
  type: 'order_return';
  data: OrderReturn;
}

// 成交回报
interface TradeReturnMessage {
  type: 'trade_return';
  data: TradeReturn;
}

// 持仓更新
interface PositionUpdateMessage {
  type: 'position_update';
  data: PositionInfo;
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
    mdConnected: boolean;
    tdConnected: boolean;
    message: string;
  };
}

// 错误消息
interface ErrorMessage {
  type: 'error';
  data: {
    code: string;
    message: string;
    relatedRef?: string;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/dev.md
git commit -m "docs(dev): 更新Section 6.2 WebSocket消息契约为camelCase"
```

---

### Task 6: 更新 task.md — PR-2 TypeScript类型定义说明

**Files:**
- Modify: `docs/task.md:176` (PR-2 TypeScript类型定义说明)

**Interfaces:**
- Consumes: design.md 中更新后的接口定义
- Produces: 更新后的 PR-2 说明

- [ ] **Step 1: 更新 PR-2 类型定义说明**

Replace `docs/task.md` 中 PR-2 的实现方式第4点（约 line 176）：

```
4. 实现TypeScript类型定义（与CTP字段名完全对齐，camelCase）
```

- [ ] **Step 2: Commit**

```bash
git add docs/task.md
git commit -m "docs(task): 更新PR-2 TypeScript类型定义说明为camelCase"
```

---

### Task 7: 更新 design.md — Section 1.3 CTP API说明

**Files:**
- Modify: `docs/design.md:62` (技术栈中的包管理说明)

**Interfaces:**
- Produces: 更新后的技术栈说明

- [ ] **Step 1: 更新包管理说明**

Replace `docs/design.md` 中技术栈表格的包管理行（约 line 62）：

```
| 包管理 | npm (前端) + pip (后端) | - | 依赖管理 |
```

- [ ] **Step 2: 更新后端环境安装命令**

Replace `docs/design.md` 中 Section 7.2 的安装命令（约 line 1157）：

```bash
pip install fastapi uvicorn websockets ctp-python
```

- [ ] **Step 3: Commit**

```bash
git add docs/design.md
git commit -m "docs(design): 更新技术栈说明，pnpm改为npm，openctp-ctp改为ctp-python"
```
