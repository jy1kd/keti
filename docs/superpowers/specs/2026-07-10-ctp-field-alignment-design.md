# Design: 根据真实CTP字段结构更新docs文档

**日期**: 2026-07-10
**状态**: 已批准

---

## 1. 背景

通过 `md_demo.py` 探测获得了真实CTP API的完整字段结构（保存在 `docs/ctp-api-structure.txt`），发现现有docs文档中的数据模型与真实CTP存在显著差异：

| 数据结构 | docs字段数 | 真实CTP字段数 | 差距 |
|----------|-----------|-------------|------|
| MarketSnapshot | ~20 | 42 | 差22个字段 |
| OrderRequest | ~10 | 30+ | 差20+个字段 |
| OrderReturn | ~10 | 45+ | 差35+个字段 |
| TradeReturn | ~8 | 28 | 差20个字段 |
| PositionInfo | ~7 | 42 | 差35个字段 |
| AccountInfo | ~9 | 42 | 差33个字段 |
| InstrumentInfo | ~8 | 28 | 差20个字段 |

此外，命名风格不一致：真实CTP用camelCase（`instrumentID`、`lastPrice`），docs用snake_case（`instrument_id`、`last_price`）。

## 2. 架构决策

**决策**：去掉后端的camelCase→snake_case转换层，CTP字段名全程透传到前端。

```
之前: CTP(camelCase) → 后端转换(snake_case) → WebSocket(snake_case) → 前端(snake_case)
之后: CTP(camelCase) → 后端透传(camelCase) → WebSocket(camelCase) → 前端(camelCase)
```

**理由**：
1. 去掉一层无意义的转换代码
2. 前端字段名与CTP官方文档一致，方便查阅
3. 减少字段映射错误

## 3. 修改范围

### 3.1 design.md 修改

**Section 3.1 WebSocket消息协议**：
- 所有JSON示例中的字段名从snake_case改为camelCase
- `market_data` 示例补全所有MarketSnapshot字段

**Section 3.2 报单数据流**：
- 报单请求格式中的字段名改为camelCase
- 报单回报格式中的字段名改为camelCase

**Section 4.6 数据模型**：
以下7个接口全部重写，使用camelCase并补全所有CTP字段：

1. **MarketSnapshot** — 对应 `CThostFtdcDepthMarketDataField`（42个字段）
2. **OrderRequest** — 对应 `CThostFtdcInputOrderField`（30+字段）
3. **OrderReturn** — 对应 `CThostFtdcOrderField`（45+字段）
4. **TradeReturn** — 对应 `CThostFtdcTradeField`（28字段）
5. **PositionInfo** — 对应 `CThostFtdcInvestorPositionField`（42字段）
6. **AccountInfo** — 对应 `CThostFtdcTradingAccountField`（42字段）
7. **InstrumentInfo** — 对应 `CThostFtdcInstrumentField`（28字段）

**其他受影响的接口**（统一camelCase）：
- `OrderStatus`、`StopOrder`、`StopOrderRequest` — 后端自定义业务模型，也统一camelCase（如 `orderRef`、`stopPrice`、`createdAt`）
- `QuoteDepth`、`ContractInfo`、`KLineData`、`DepthData`、`VolatilityData` — 统一camelCase
- `OptionContract`、`OptionChain`、`OptionQuote` — 统一camelCase

**注意**：CTP结构中的 `reserve1`、`reserve2` 等字段是CTP预留字段（已废弃），前端不使用，接口中可以省略。

### 3.2 dev.md 修改

**Section 4.2 CTP封装代码**：
- `trader_api.py` 中的回调代码字段名保持camelCase（与CTP一致）
- `md_user_api.py` 中的 `OnRtnDepthMarketData` 回调补全所有字段

**Section 6.2 WebSocket消息契约**：
- 所有TypeScript接口定义从snake_case改为camelCase
- 与design.md保持一致

### 3.3 task.md 修改

**PR-2**：
- TypeScript类型定义说明更新为"与CTP字段名完全对齐（camelCase）"

## 4. 不修改的文件

| 文件 | 原因 |
|------|------|
| `docs/ctp-api-structure.txt` | 已是正确参考源 |
| `docs/prd.md` | 产品需求文档，不涉及具体字段名 |
| `docs/task-dev-flow.md` | 开发流程文档，不涉及具体字段名 |
| `CLAUDE.md` | 项目说明，不涉及具体字段名 |

## 5. 后端代码影响

后端回调代码**不需要改**（本来就用camelCase），只需要去掉转换层。

**之前**（有转换）：
```python
def on_market_data(self, data):
    converted = {
        'instrument_id': data.InstrumentID,
        'last_price': data.LastPrice,
    }
    ws_manager.broadcast("market", "market_data", converted)
```

**之后**（直接透传）：
```python
def on_market_data(self, data):
    ws_manager.broadcast("market", "market_data", {
        'instrumentID': data.InstrumentID,
        'lastPrice': data.LastPrice,
        # ... 所有字段
    })
```

## 6. 前端代码影响

前端TypeScript接口需要使用camelCase字段名。前端代码中所有对这些字段的引用都需要使用camelCase。

## 7. 实施顺序

1. 更新 `docs/design.md` — 数据模型和WebSocket消息格式
2. 更新 `docs/dev.md` — WebSocket消息契约和CTP封装代码
3. 更新 `docs/task.md` — PR-2类型定义说明
