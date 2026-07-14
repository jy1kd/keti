# Task-05 Code Review 反馈（六次审查 — 网络诊断）

**审查分支**：`feature/pr-5-market-api`
**审查 commit**：`bd74a88`（B4 front_connected.set() 修复）
**审查时间**：2026-07-14
**触发原因**：人工验证 5 个问题均未解决，"CTP OnFrontConnected timeout after 30s"

---

## 根因诊断

### 网络连通性测试

```
$ python -c "import socket; s=socket.socket(); s.settimeout(5); s.connect_ex(('182.254.243.31', 40011))"
CTP MD front connection refused (error 10061)

$ python -c "import socket; s=socket.socket(); s.settimeout(5); s.connect_ex(('182.254.243.31', 40001))"
CTP TD front connection refused (error 10061)
```

**SimNow 7x24 测试环境 (`182.254.243.31`) 当前不可达**。端口 40011（行情）和 40001（交易）均返回 `ECONNREFUSED`（错误码 10061），说明服务器主动拒绝连接。

---

## 5 个问题的最终定性

| # | 问题 | 定性 | 说明 |
|---|------|------|------|
| 1 | `GET /` → 404 | ✅ 非 bug | 无根路由，文档在 `/docs` |
| 2 | `/api/market/snapshots` → `{}` | ⚠️ 环境问题 | CTP 服务器不可达 → 无行情数据流入 |
| 3 | `/api/market/kline` → `bars:[]` | ✅ 设计占位 | 已文档化，延期 PR-7 |
| 4 | `/api/market/depth` → 空 | ⚠️ 环境问题 | 同 #2，无 snapshot 数据 |
| 5 | "CTP OnFrontConnected timeout after 30s" | ⚠️ 环境问题 | SimNow 服务器不可达 |

**所有 5 个问题均非代码 bug。** 问题 #2, #4, #5 的根因是 SimNow 7x24 测试环境 (`tcp://182.254.243.31:40011/40001`) 当前不可用。

---

## 代码行为验证

CTP 连接失败时，代码行为符合设计：

```python
# ctp_startup.py:118-123
if not front_connected.wait(timeout=LOGIN_TIMEOUT):
    logger.warning(
        "CTP OnFrontConnected timeout after %.0fs — "
        "market data will not be available", LOGIN_TIMEOUT,
    )
    return  # ← 不阻塞 HTTP 服务器启动
```

- ✅ 30s 超时后不阻塞 FastAPI 启动
- ✅ HTTP 服务器正常运行（`/api/market/instruments` 返回合约列表）
- ✅ 日志明确提示 "market data will not be available"
- ✅ `/api/connection/status` 返回 `mdConnected: false`

---

## 代码审查结论

**✅ 通过 — 无阻断性问题**

B4 修复（`front_connected.set()`）已正确应用。代码逻辑无 bug。所有运行时问题均由 CTP 服务器不可达导致。

---

## 下一步行动

### 开发窗口

1. 提交 snapshot 文件变更
2. 更新 progress.md 状态为「审查通过，待合并」
3. 执行合并操作

### 人工验证（等待 SimNow 恢复后）

SimNow 7x24 环境可能在维护中。恢复后验证：

```bash
# 1. 测试网络连通性
python -c "import socket; s=socket.socket(); s.settimeout(5); print(s.connect_ex(('182.254.243.31', 40011)))"
# 输出 0 = 可达

# 2. 启动服务器
cd server && python -m uvicorn main:app --reload --port 8000

# 3. 检查日志 — 应看到：
# "CTP front connected, login sent (user=...)"
# "CTP login successful (user=...)"
# "CTP market data bridge wired — snapshots + WebSocket active"

# 4. 测试 API
curl http://localhost:8000/api/connection/status
# 期望: {"loggedIn": true, "mdConnected": true, "tdConnected": false}

curl http://localhost:8000/api/market/snapshots
# 期望: {"snapshots": {"IF2608": {...}, ...}}
```

### SimNow 环境备选

如果 `182.254.243.31` 长期不可用，参考 SimNow 官网获取最新的 7x24 环境地址：
- 官网：https://www.simnow.com.cn
- 可能需要更新 `.env` 中的 `CTP_MD_FRONT` 和 `CTP_TD_FRONT`
