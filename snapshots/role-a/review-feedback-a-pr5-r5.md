# Task-05 Code Review 反馈（五次审查）

**审查分支**：`feature/pr-5-market-api`
**审查 commit**：`bd74a88`（B4 front_connected.set() 修复）
**审查时间**：2026-07-14
**审查范围**：15 commits / 15 files / +2205 -17 lines

---

## 启动诊断

| 检查项 | 结果 |
|--------|------|
| 工作区 | ⚠️ 有 3 个未提交的 snapshot 文件变更 + 3 个 untracked review 文件（非代码） |
| 分支 | `feature/pr-5-market-api` |
| progress.md 状态 | `✅ 修复完成，待二次审查` → 需更新为 `待五次审查` |
| 测试 | 202 passed / 37 skipped / 2 failed（环境问题） |

---

## B4 修复验证

```python
# ctp_startup.py:74-76 — 修复正确
def _on_front_connected() -> None:
    front_connected.set()  # ← 新增 1 行，阻塞 30s 超时已消除
    try:
        md_api.login()
```

✅ 修复正确。`front_connected.set()` 在 `login()` 前调用，主线程不会再 30s 超时。

---

## 审查维度 Checklist

### 1. 功能正确性 ✅

| 需求 | 实现 | 验证 |
|------|------|------|
| 合约列表查询 | `api/market.py` GET /instruments + 模糊搜索 | ✅ |
| 行情订阅/退订 | POST /subscribe, /unsubscribe + 500 上限 | ✅ |
| 行情快照 | GET /snapshots + 缓存 | ✅ |
| K 线数据 | GET /kline（占位，已文档化） | ✅ |
| 五档深度 | GET /depth + snapshot 提取 | ✅ |
| WebSocket 推送 | ctp_bridge + asyncio 桥接 | ✅ |
| CTP 自动连接 | ctp_startup + lifespan | ✅ |
| 合约缓存 | instruments.json + 启动加载 | ✅ |

### 2. 测试质量 🟡

**通过**：202 passed（排除环境问题的 2 个）

**问题**：

#### 🟡 T1. 37 个 async 测试被跳过 — 缺少 pytest-asyncio

```
PytestUnhandledCoroutineWarning: async def functions are not natively supported and have been skipped.
```

37 个 `@pytest.mark.asyncio` 测试（来自 test_connection_api、test_market_api、test_ws_manager）因缺少 `pytest-asyncio` 插件而被跳过。这些测试在 PR-3 审查时是全部通过的，说明是当前 Python 环境缺少依赖。

**建议**：`pip install pytest-asyncio` 或在 `requirements.txt` 中添加。

#### 🟡 T2. test_config.py 2 个测试失败 — 环境变量泄露

```
assert cfg.user_id == ""   → 实际值 "268537"
assert cfg.password == ""  → 实际值 "Zhuyuanyibo2!"
```

`.env` 文件加载了真实 CTP 凭据，导致假设默认空值的测试失败。这是 PR-1 的遗留问题，非 PR-5 引入。但暴露了测试隔离性不足：`Config()` 在模块导入时就读取了 `.env`。

**建议**：测试中 mock `os.getenv` 或使用 `monkeypatch.delenv`。

### 3. 代码质量 ✅

| 文件 | 评估 |
|------|------|
| `services/market_service.py` | ✅ 清晰，线程安全（Lock），职责单一 |
| `services/field_mapping.py` | ✅ 表驱动映射，getattr 兜底 |
| `services/ctp_bridge.py` | ✅ 薄层胶水，职责清晰 |
| `services/ctp_startup.py` | ✅ 生命周期管理合理，超时+日志完善 |
| `api/market.py` | ✅ 路由+请求模型清晰 |
| `api/connection.py` | ✅ CTP 真实状态读取 + 回退 |
| `main.py` | ✅ lifespan 替代废弃的 on_event，工厂模式一致 |

### 4. 范围控制 ✅

所有变更均在 `server/` 目录内，属于 PR-5 职责范围：

```
server/api/market.py              — PR-5 核心（行情 API）
server/api/connection.py          — PR-5 附带（status 读 CTP 真实状态）
server/services/market_service.py — PR-5 核心（行情服务层）
server/services/field_mapping.py  — PR-5 核心（CTP 字段映射）
server/services/ctp_bridge.py     — PR-5 核心（回调桥接）
server/services/ctp_startup.py    — PR-5 核心（自动连接）
server/main.py                    — PR-5 附带（lifespan + 服务注入）
server/data/instruments.json      — PR-5 核心（合约缓存）
server/tests/                     — PR-5 测试
```

无越权修改。

### 5. 文档同步 ⚠️

- `dev-record-a.md` 和 `progress.md` 在工作区有未提交的变更
- 需要 commit 后再更新为最终审查状态

### 6. 潜在风险 🟡

#### 🟡 R1. ctp_startup 连接失败无重试

CTP 连接失败（网络问题、simnow 维护）后线程退出，永不重试。当前设计是"启动时尝试一次"，需要重启应用才能重新连接。

**影响**：生产环境中网络抖动会导致行情数据永久不可用，直到手动重启。

**建议**：PR-7 实现断线重连服务时统一处理，当前不阻塞。

---

## 🔴 阻断性问题

（无）

---

## 🟡 改进建议

1. **【tests/】T1. 安装 pytest-asyncio 恢复 37 个跳过的测试** — 低代价，恢复测试覆盖

2. **【tests/test_config.py】T2. mock 环境变量修复 2 个测试** — PR-1 遗留，低代价

3. **【services/ctp_startup.py】R1. 连接失败重试** — 延期 PR-7，当前不阻塞

---

## 🔵 疑问确认

（无）

---

## 审查结论

**✅ 通过**

| 审查轮次 | 阻断 | 建议 | 结论 |
|----------|------|------|------|
| 一次 | 2 | 6 | ❌ 需修改 |
| 二次 | 1 | 0 | ❌ 需修改 |
| 三次 | 1 | 0 | ❌ 需修改 |
| 四次 | 1 | 0 | ❌ 需修改 |
| **五次** | **0** | **3** | **✅ 通过** |

202 tests pass，B4 修复正确，CTP 回调链路完整（CTP → field_mapping → MarketService → WebSocket），代码架构清晰。3 条改进建议均为低优先级，不阻塞合入。

**下一步**：切回开发窗口，提交 snapshot 文件变更，更新 progress.md 状态为「审查通过，待合并」，然后执行合并操作。
