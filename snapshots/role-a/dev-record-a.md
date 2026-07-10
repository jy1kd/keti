# 角色A 开发记录

**角色**：角色A（后端开发）
**负责目录**：server/

---

## PR-1: 后端CTP连接验证（技术Spike）

**分支**：`feature/pr-1-ctp-verify`
**依赖**：无
**状态**：✅ 开发完成，待审查

### 测试用例列表

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `tests/test_config.py` | 11 | Config 默认值、环境变量读取、load_config 工厂函数 |
| `tests/test_types.py` | 24 | 8 个枚举类（Direction, OffsetFlag, OrderPriceType, TimeCondition, VolumeCondition, OrderStatus, PosiDirection, ProductClass） |
| `tests/test_callback.py` | 31 | MdSpi/TraderSpi 实例化、回调方法存在性、事件日志 |
| `tests/test_md_user_api.py` | 22 | MdUserApi 构造 + subscribe/unsubscribe/release 状态管理 |
| `tests/test_trader_api.py` | 20 | TraderApi 构造 + insert_order/cancel_order/release 状态管理 |
| **合计** | **108** | |

### 实现进度

#### 第1次循环：配置 + 类型 + 回调（66 tests）
- ✅ `requirements.txt` — ctp-python, python-dotenv
- ✅ `config.py` — Config 类，读取环境变量，SimNow 默认值
- ✅ `ctp/types.py` — 8 个枚举类，值与 CTP 官方一致
- ✅ `ctp/callback.py` — MdSpi + TraderSpi，事件日志 + 自定义 handler
- ✅ 测试文件：`test_config.py`, `test_types.py`, `test_callback.py`
- 📦 Commit: `ce44db8`

#### 第2次循环：API 封装 + 入口 + 配置模板（+26 tests）
- ✅ `ctp/md_user_api.py` — MdUserApi 封装，create/login/subscribe/unsubscribe/release
  - ⚠️ 强制 str 列表（避免 bytes 导致 SWIG 堆损坏）
- ✅ `ctp/trader_api.py` — TraderApi 封装，create/login/insert_order/cancel_order/release
  - 自动生成 order_ref，完整报单字段
- ✅ `main.py` — 4 步验证脚本（import → config → MD → TD）
- ✅ `.env` — 实际配置文件（gitignore，不提交）
- ✅ `.env.sample` — 配置模板（提交）
- ✅ 测试文件：`test_md_user_api.py`, `test_trader_api.py`
- 📦 Commit: `282ecaf`

### 关键设计决策

1. **SubscribeMarketData 参数安全**：`md_user_api.subscribe()` 强制 `str(i)` 转换，防止 bytes 导致崩溃（CTP SWIG bug）
2. **配置默认值**：SimNow 7x24 环境地址硬编码为默认值，开箱即用
3. **事件日志机制**：每个 SPI 回调自动记录 `{type, timestamp, data}`，方便调试
4. **自定义 handler**：通过 `spi.on(event_type, handler)` 注册，避免继承 SPI

### 遇到的问题与解决方案

- **测试隔离**：`_has_ctp` 检测需同时验证 import 成功 + DLL 可用（仅 import 成功不够）
- **OnFrontDisconnected 参数**：回调需要 `reason: int` 参数，测试传 `0` 模拟

### Commit 记录

| Commit | 内容 |
|--------|------|
| `ce44db8` | feat(task-01): 配置管理、CTP类型定义、回调框架 — 66 tests pass |
| `282ecaf` | feat(task-01): CTP行情/交易API封装、验证入口、配置模板 — 92 tests pass |
| `fa0a872` | docs(task-01): 更新progress.md — 开发完成，待审查 |
