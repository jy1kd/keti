# PR-11 审查反馈处理记录

## 第 1 轮审查反馈处理

审查时间：2026-07-21

---

### 🟡 改进建议处理

| # | 问题 | 处理 | Commit |
|---|------|------|--------|
| 1 | GET 端点直接访问私有成员 | ✅ 采纳 — 为 QueryService 添加 `orders/trades/positions/account` 公开属性，API 层改用公开属性 | d6eb313 |
| 2 | refresh 端点未检查登录状态 | ✅ 采纳 — 4 个 refresh 端点均添加 `login_status != "logged_in"` 检查 | d6eb313 |
| 3 | `import ctp` 重复 4 次 | ⏭️ 保留 — `import ctp` 在方法内是 ctp-python SWIG 绑定的测试模式要求（tests 通过 `sys.modules["ctp"] = mock` 注入），与 trader_api.py 全部方法保持一致。Python 缓存 import，性能无影响 | — |
| 4 | 缺少 refresh 端点测试 | ✅ 采纳 — 新增 9 个 refresh 端点测试（positions/account/orders/trades × success + not_logged_in + no_trader） | d6eb313 |
| 5 | 4 个查询回调高度重复 | ✅ 采纳 — 提取 `_make_qry_callback(event_name)` 工厂函数，4 处复用 | d6eb313 |
| 6 | pending 列表线程安全 | ✅ 采纳 — 在 QueryService 类 docstring 中详细标注线程模型（GIL 保证、event 时序、超时兜底） | d6eb313 |

---

### 🔵 疑问确认回复

**1. subscribe/unsubscribe 失败语义变更**

当前设计是有意为之：本地订阅状态先记录，CTP 失败不回滚。

理由：
- 本地状态记录的是"用户意图"（想订阅哪些合约），CTP 失败是"执行层面"的问题
- 如果回滚本地状态，用户会看到 subscription_count 没变，误以为没有订阅，但其实 CTP 侧可能已经部分生效（网络抖动导致的超时等）
- 保持本地状态一致，用户可以通过再次 subscribe 重试
- 返回 `success: False` + `message` 让前端知道 CTP 执行失败，可以提示用户重试

**2. get_account 返回格式不一致**

Account 是单一对象（非列表），与其他端点（positions/orders/trades 是列表）不同，所以格式不同是有意的。

- positions/orders/trades：`{"positions": [...], "count": N}` — 列表 + 计数
- account：`{"balance": 1000000.0, "available": 500000.0, ...}` — 单一对象直接返回

这与 CTP 的数据模型一致：一个交易账户只有一个资金记录，而持仓/报单/成交可以有多条。前端 GET /account 可以直接使用返回值作为账户对象，无需额外解包。

---

### 修复 Commit

| Commit | 描述 |
|--------|------|
| d6eb313 | fix(task-11): review反馈 - 公开属性+登录检查+回调工厂+refresh测试+线程模型文档 |
