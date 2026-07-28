# 一致性检查报告

> 分支：check/docsCheck01
> 检查日期：2026-07-24
> 状态：进行中

---

## 检查结果

### 🔴 阻断性问题（必须修复）

| # | 问题 | 处理方式 | 状态 |
|---|------|----------|------|
| 1 | TimeCondition 枚举值全部错误 | → PR-C1 写入 task2.md + task.md/design.md 文档修复 | ✅ 已处理 |
| 2 | task.md PR-18 状态落后（⏳→✅） | → 直接修 task.md | ✅ 已处理 |
| 3 | design.md /api/query/quotes 冗余（/api/market/depth 已覆盖） | → 从 design.md 删除 | ✅ 已处理 |

### 🟡 不一致问题（建议修复）

| # | 问题 | 处理方式 | 状态 |
|---|------|----------|------|
| 4 | design.md 缺少 10 个已实现 API | → 直接修 design.md（补充 6 个行情 + 4 个查询端点） | ✅ 已处理 |
| 5 | design.md keyword vs search 参数描述 | → 顺带修复：`search` → `keyword` | ✅ 已处理 |
| 6 | VolatilityData 定义不一致（代码7字段 vs 文档8字段） | → design.md 对齐 dev.md + PR-C2 补代码 updateTime | ✅ 已处理 |
| 7 | dev.md 缺少 AccountQuery 组件说明 | → dev.md 组件表补充（PR-16 计划） | ✅ 已处理 |
| 8 | dev.md Axios vs fetch 不一致 | → 检查确认代码用 axios，文档正确，无需修改 | ✅ 已处理 |
| 9 | dev.md WebSocket 消息类型不全 | → dev.md 补充 instruments_refreshed、ping | ✅ 已处理 |

### 🔵 改进建议（可选）

| # | 问题 | 处理方式 | 状态 |
|---|------|----------|------|
| 10 | 后端模块文件未在 dev.md 记录 | → dev.md 补充 services/ 9个文件 + utils/ 目录 | ✅ 已处理 |
| 11 | 前端组件/hooks 未在文档记录 | → dev.md 补充 4 个组件 + 3 个 Hook | ✅ 已处理 |

---

## 详细记录

### 第 1 项：TimeCondition 枚举值全部错误

- **发现**：CTP 标准值 IOC='1', GFS='2', GFD='3'，代码使用 GFD='1', FOK='2', FAK='3'
- **根因**：FOK/FAK 不是 TimeCondition 值，而是 TimeCondition(IOC) + VolumeCondition 的组合
- **处理**：
  - `docs/tasks/consistency-check-records.md` — PR-C1 代码修复计划（12 个文件）
  - `docs/tasks/task.md` — 修复 PR-10 映射表（line 1025）和转换代码示例（line 1033）
  - `docs/specs/design.md` — 修复报单请求格式示例（line 445-457），补充 volumeCondition 字段和 CTP 标准说明
- **完成时间**：2026-07-24
