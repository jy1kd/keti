# PR-18 Code Review 反馈

## 第 1 轮审查

审查分支：`feature/pr-18-options-api`
审查 commit：`d9f9a9b..14f9adc`（4 commits）
审查时间：2026-07-23

---

### 🔴 阻断性问题（必须修改）

1. **【task.md:1487】productClass 筛选值与代码不一致**
   - task.md 写 `productClass='1'`（期权），但 CTP 实际定义 `'1'`=期货、`'2'`=期权。
   - 代码 `options_service.py:33` 使用 `productClass == "2"` 是正确的。
   - task.md 是验收标准的权威来源，代码与文档矛盾会误导后续开发者。
   - 建议：将 task.md 第 1487 行 `productClass='1'` 改为 `productClass='2'`。
   ```
   # task.md 当前（错误）：
   - 合约筛选：InstrumentInfo.productClass='1'（期权）

   # 应改为：
   - 合约筛选：InstrumentInfo.productClass='2'（期权）
   ```

---

### 🟡 改进建议

1. **【options_service.py:287-292】`_calc_time_to_expiry` 的 `from datetime import datetime` 在函数内**
   - `from datetime import datetime` 在函数体内导入，与其他文件风格不一致（通常在模块顶部导入）。
   - Python 会缓存 import，功能无影响，但建议移到文件顶部保持一致。
   - 非阻塞，可后续统一。

2. **【options_service.py:270】Newton-Raphson 失败时返回 sigma 而非 0.0**
   - 循环结束时 `return sigma if sigma > 0 else 0.0`，如果迭代 100 次仍未收敛，返回的是最后一次迭代的 sigma 值（可能接近但不精确）。
   - 这是一个设计选择：返回近似值 vs 返回 0.0 表示失败。当前行为可能比返回 0.0 更有用，但应在文档中说明。
   - 非阻塞，可保持现状。

3. **【options.py:17-19】OptionQuote 模型缺少 market data 字段**
   - `OptionQuote` 定义了 `lastPrice/bidPrice/askPrice/volume/openInterest`，但 `get_option_chains()` 中这些字段始终为 0.0（需要行情快照）。
   - 这是 API 设计选择：期权链 API 不包含实时行情，需要单独调用 `/volatility` 获取含行情的波动率数据。
   - 非阻塞，但前端使用时需注意。

---

### 🔵 疑问确认

无

---

### 验收标准覆盖检查

| 验收标准 | 状态 | 实现位置 |
|----------|:----:|----------|
| 期权合约列表获取正常（基于productClass筛选） | ✅ | `options_service.py:get_options()` — productClass='2' |
| 期权T型报价数据获取正常（按标的+到期日分组） | ✅ | `options_service.py:get_option_chains()` — (underlyingInstrID, expireDate) 分组 |
| 隐含波动率计算正常（Black-Scholes模型） | ✅ | `options_service.py:calculate_implied_volatility()` — Newton-Raphson，已验证 BS 定价 + IV roundtrip |
| 看涨/看跌期权正确分类 | ✅ | `options_service.py:83-86` — optionsType='1'→calls, else→puts |
| VolatilityData返回完整参数 | ✅ | 7 字段全部返回（instrumentID, impliedVolatility, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType） |
| 期权类型映射正确 | ✅ | OptionsType: '1'=看涨(C), '2'=看跌(P) — 与 CTP 一致 |

---

### 测试验证

- PR-18 新增 44 测试：✅ 全部通过
- 测试覆盖：模型(11) + 服务(20) + API(11) + 集成(2)
- Black-Scholes 验证：Call≈10.45, Put≈5.57, Put-Call parity✅, IV roundtrip=0.20✅

---

### 审查结论

❌ **需要修改后再审**

阻断性问题 1 条（task.md productClass 文档错误）必须修复。改进建议 3 条建议修复。代码功能正确，测试全面。

---

### 下一步

请切回开发窗口：
1. 修复 task.md productClass='1'→'2'（🔴 必须）
2. 处理改进建议（🟡 建议）
3. 修复完成后切审查窗口进行二次审查
