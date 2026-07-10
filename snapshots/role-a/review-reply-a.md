# PR-1 Code Review 反馈处理记录

**审查分支**：`feature/pr-1-ctp-verify`
**处理时间**：2026-07-10

---

## 🔴 阻断性问题修复（3 条）

| # | 问题 | 修复 Commit | 处理说明 |
|---|------|------------|----------|
| 1 | 市价单验证缺失 | `e6bc245` | 在 main.py 增加 Step 5: `verify_market_order()`，提交 `OrderPriceType.ANY` 市价单并检查回报 |
| 2 | API 测试 mock 覆盖不足 | `2e7f11a` | 用 `unittest.mock` 重写 41 个测试，覆盖 subscribe/unsubscribe/release/insert_order/cancel_order 的状态管理、空列表、bytes→str 转换、order_ref 自增等逻辑 |
| 3 | dev-record-a.md 状态不一致 | `34c5c9d` | 状态改为「✅ 开发完成，待审查」，补全 `282ecaf`/`fa0a872` commit 记录 |

---

## 🟡 改进建议处理（5 条）

| # | 建议 | 采纳 | 处理说明 |
|---|------|------|----------|
| 4 | time.sleep → 事件轮询 | ✅ 采纳 | 新增 `wait_for_event()` 函数，轮询 SPI events 列表，支持超时 |
| 5 | BaseSpi 基类抽取 | ✅ 采纳 | 抽取 `BaseSpi`（共享 `__init__`/`_log`/`on`/`_dispatch` 及 4 个通用回调），`MdSpi`/`TraderSpi` 分别继承，约减少 50 行重复代码 |
| 6 | _dispatch 静默吞异常 | ✅ 采纳 | 改为 `logger.warning(...)` 记录异常，便于调试 |
| 7 | test_config_repr 永真断言 | ✅ 采纳 | 改为直接断言 `cfg.password not in r` |
| 8 | au2506 硬编码过期风险 | ✅ 采纳 | 改为环境变量 `CTP_TEST_INSTRUMENT`，默认 `au2506` |

---

## 🔵 疑问确认回复（2 条）

### 疑问-9：trader_api.py 硬编码字段是否需要补充枚举

**回复**：`TimeCondition` 和 `VolumeCondition` 已有对应的枚举类（`TimeCondition.GFD` 等），已改用枚举引用。`CombHedgeFlag`（投机 `"1"`/套利 `"2"`/套保 `"3"`）、`ContingentCondition`（立即 `"1"`/止损 `"2"`/止盈 `"3"`）、`ForceCloseReason`（非强平 `"0"`）这三个字段在 PR-1 验证阶段固定使用默认值，不需要选择。PR-9（交易 API 完善）时会根据报单类型动态设置，届时一并补充枚举定义。

### 疑问-10：Config 多实例创建是否有意

**回复**：是有意为之。各验证步骤独立创建实例是为了保持函数隔离性（每个函数可独立运行）。Config 本身无状态、无副作用（只读环境变量），多次创建不影响正确性。如果需要改为单例，可在 PR-3（FastAPI 框架）中引入依赖注入时统一处理。

---

## 测试记录

```
108 passed in 0.15s
```

全部测试通过，无回归。

---

## 二次审查修复记录（2026-07-10）

| # | 问题 | 等级 | 处理 |
|---|------|------|------|
| 1 | main.py 缺少 `import os` | 🔴 | 添加 `import os`，修复运行时崩溃 |
| 2 | `wait_for_event()` 死代码 | 🟡 | 在 `verify_md_connection`/`verify_td_connection`/`verify_market_order` 三个函数中集成替换所有 `time.sleep` |
| 3 | dev-record-a.md 测试数未更新 | 🟡 | 更新为 108 tests，各文件测试数同步 |
| 4 | `au2506` 硬编码遗漏 | 🟡 | print 信息中的硬编码 `au2506` 也改为 `_TEST_INSTRUMENT` |

**Commit**: `b081b50`
**测试**: 108 passed
