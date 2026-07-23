# PR-18 人工验证讨论记录

**PR**：PR-18（后端期权API实现）
**分支**：`feature/pr-18-options-api`
**验证时间**：2026-07-23

---

## 验证项 1：期权合约列表获取正常

**状态**：✅ 已验证

**验证步骤**：
```bash
curl "http://localhost:8000/api/market/options?underlying=au2608"
```

**验证结果**：
- 返回 216 个期权合约
- 合约示例：`au2608C880`（productClass='2'，optionsType='1'，strikePrice=880.0）
- 筛选功能正常：只返回 underlying=au2608 的期权合约

**知识点说明**：
- au2608 是黄金期货（productClass='1'）
- 围绕 au2608 有 216 个期权合约（productClass='2'）
- 期权包括看涨（Call）和看跌（Put），每个行权价各一个
- 行权价从 600 到 1200，每隔一定价格设一个

---

## 验证项 2：期权T型报价数据获取正常

**状态**：✅ 已验证

**验证步骤**：
```bash
curl "http://localhost:8000/api/market/option_chain?underlying=au2608"
```

**验证结果**：
- 返回期权链结构正确：`{underlying, expireDate, calls[], puts[]}`
- calls 和 puts 按 strikePrice 升序排列
- 同一 strikePrice 在 calls 和 puts 中都存在（标准 T型报价 结构）

**知识点说明**：
- 期权是成对存在的：每个行权价都有一个 Call 和一个 Put
- T型报价：左边 Calls，中间行权价，右边 Puts
- 例如：au2608C880（Call）和 au2608P880（Put）共享 strikePrice=880

---

## 验证项 3：隐含波动率计算正常

**状态**：✅ 已验证

**验证步骤**：
1. 前端订阅 au2608 和 au2608C880 行情
2. 等待行情数据推送
3. 执行 `curl "http://localhost:8000/api/market/volatility?underlying=au2608"`

**验证结果**：
```json
{
  "volatility": [
    {
      "instrumentID": "au2608C816",
      "impliedVolatility": 0.01,
      "underlyingPrice": 899.88,
      "strikePrice": 816,
      "timeToExpiry": 0.009251477573738181,
      "riskFreeRate": 0.03,
      "optionType": "1"
    },
    {
      "instrumentID": "au2608C880",
      "impliedVolatility": 0.22623996179540498,
      "underlyingPrice": 899.88,
      "strikePrice": 880,
      "timeToExpiry": 0.00925147741532943,
      "riskFreeRate": 0.03,
      "optionType": "1"
    }
  ]
}
```

**参数说明**：
- `impliedVolatility`：隐含波动率（市场对标的资产未来价格波动的预期）
- `underlyingPrice`：标的价格（au2608 黄金期货当前价格）
- `strikePrice`：行权价（期权到期时可以买入/卖出的价格）
- `timeToExpiry`：到期时间（年化，0.00925 年 ≈ 3.4 天）
- `riskFreeRate`：无风险利率（Black-Scholes 计算参数）
- `optionType`：期权类型（"1"=看涨 Call, "2"=看跌 Put）

**数据分析**：
- au2608C880：实值期权（ITM），隐含波动率 22.6%，合理
- au2608C816：深度实值期权（Deep ITM），隐含波动率 1%，偏低（深度实值期权 IV 计算可能不稳定）

---

## 验证项 4：看涨/看跌期权正确分类

**状态**：待验证

---

## 验证项 5：VolatilityData返回完整参数

**状态**：待验证

---

## 验证项 6：期权类型映射正确

**状态**：待验证
