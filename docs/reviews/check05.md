# 一致性检查报告 — check/docsCheck05

> 生成日期：2026-07-28
> 检查维度：文档一致性 + 前后端数据流 + 代码质量

---

## 🟡 不一致问题（建议修复）

### 1. `optionsType` 前后端命名不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P2 |
| **影响** | 前端 OptionContract 类型定义与后端实际返回字段名不一致 |
| **前端文件** | `frontend/src/services/types.ts:228` |
| **后端文件** | `server/services/field_mapping.py:250` |
| **状态** | ✅ 已修复 |

**问题描述**：
- 后端 `field_mapping.py` 映射 CTP `OptionsType` → `optionsType`（复数）
- 前端 `OptionContract.optionType`（单数）与后端不匹配
- `VolatilityData.optionType` 和 `OptionContract.optionType` 在 option_chain/volatility 路径正确（后端显式映射）

**修复方案**：
→ 前端 `OptionContract.optionType` → `optionsType`（复数），与后端一致

---

### 2. design.md 连接登录请求格式与代码不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档 |
| **文档文件** | `docs/specs/design.md:655` |
| **代码文件** | `server/api/connection.py:23-26` |
| **状态** | ✅ 已修复 |

**问题描述**：
- design.md 使用 snake_case `{broker_id, user_id, password, md_front, td_front}`
- 实际代码使用 camelCase `{brokerID, userID, password}`，无 front 地址参数
- status 响应缺少 `loggedIn` 字段

**修复方案**：
→ design.md 对齐代码（camelCase，去掉 front 参数，补充 loggedIn）

---

### 3. callback.py on_account 广播 account_update 残留

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 文档/代码 |
| **状态** | ✅ 已修复（check04 已处理） |

**问题描述**：
- `account_update` 在整个代码库中不存在（前端和后端均无）
- check04 修复已完整

---

## 🔵 改进建议（类型定义完善）

### 4. 前端类型定义字段覆盖不全

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **影响** | 类型定义不完整，但不影响运行时 |
| **前端文件** | `frontend/src/services/types.ts` |
| **状态** | ✅ 已修复 |

**问题描述**：
- `TradeRecord` 缺 10 字段、`PositionRecord` 缺 7 字段、`OrderRecord` 缺 3 字段、`AccountInfo` 缺 1 字段
- 后端 `field_mapping.py` 返回完整 CTP 字段

**修复方案**：
→ 补全前端类型定义，添加后端返回的字段（标记为可选 `?`）

---

## 汇总

| 等级 | 编号 | 问题 | 状态 |
|------|------|------|------|
| 🟡 P2 | 1 | optionsType 命名不一致 | ✅ 已修复 |
| 🟡 文档 | 2 | design.md 登录请求格式 | ✅ 已修复 |
| 🟡 文档 | 3 | account_update 残留 | ✅ 已修复（check04） |
| 🔵 P3 | 4 | 类型定义字段覆盖不全 | ✅ 已修复 |

> **全部 4 项已修复完成。** 检查日期：2026-07-28
