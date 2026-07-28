# 一致性检查报告 — check/docsCheck04

> 生成日期：2026-07-27
> 检查维度：文档一致性 + 前后端数据流 + 运行时行为 + 代码质量

---

## 🟡 不一致问题（建议修复）

### 1. `isTrading` 类型不匹配

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P1 |
| **影响** | TypeScript 类型定义不准确，运行时无影响 |
| **前端文件** | `frontend/src/services/types.ts:185`, `types.ts:208` |
| **后端文件** | `server/services/field_mapping.py:253` |
| **状态** | ✅ 已修复 |

**问题描述**：
- 前端 `ContractInfo.isTrading` 和 `OptionContract.isTrading` 定义为 `boolean`
- 后端 `field_mapping.py` 返回 `int`（0/1）
- CTP 的 `IsTrading` 字段是 `int` 类型

---

### 2. `optionType` / `optionsType` 枚举值不匹配

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P1 |
| **影响** | TypeScript 类型定义与实际值不符 |
| **前端文件** | `frontend/src/services/types.ts:75`, `types.ts:203` |
| **后端文件** | `server/services/options_service.py:76` |
| **状态** | ✅ 已修复 |

**问题描述**：
- 前端 `VolatilityData.optionType` 定义为 `'call' | 'put'`
- 前端 `OptionContract.optionsType` 定义为 `'call' | 'put'`
- 后端返回 `'1'`（call）/ `'2'`（put），CTP 原生 char 值

---

### 3. `StopOrderRequest` 类型定义与实际 API 不匹配

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P2 |
| **影响** | 类型定义未被使用，但误导开发者 |
| **前端文件** | `frontend/src/services/types.ts:109-118` |
| **实际API** | `frontend/src/services/api.ts:458-466` |
| **状态** | ✅ 已修复 |

**问题描述**：
- `types.ts` 中 `StopOrderRequest` 使用 `combOffsetFlag`, `volumeTotalOriginal`, `timeCondition`
- `api.ts` 中 `submitStopOrder()` 实际使用 `offsetFlag`, `volume`，无 `timeCondition`
- 后端 `SubmitStopOrderRequest` 使用 `offsetFlag`, `volume`

---

### 4. design.md `account_update` 消息类型未实现

| 项目 | 内容 |
|------|------|
| **严重等级** | 🟡 P2 |
| **影响** | 文档与代码不一致 |
| **文档文件** | `docs/design.md:253`, `design.md:693` |
| **状态** | ✅ 已修复 |

**问题描述**：
- design.md 列出 `account_update` 作为 WS 消息类型
- 前端 `WSMessageType` 未包含
- 后端无发送 `account_update` 的代码

---

## 🔵 改进建议

### 5. design.md WS 消息类型列表不完整

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **影响** | 文档遗漏 |
| **文档文件** | `docs/design.md:248-257` |
| **状态** | ✅ 已修复 |

**问题描述**：
- 已实现但文档未列出：`instruments_refreshed`, `ping`

---

### 6. `optionType` 命名不一致

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **影响** | 命名风格不统一 |
| **前端文件** | `frontend/src/services/types.ts:75`, `types.ts:224` |
| **状态** | ✅ 已修复 |

**问题描述**：
- ~~`VolatilityData` 使用 `optionsType`（复数）~~
- ~~`OptionContract` 使用 `optionsType`（复数）~~
- ✅ 已修复：统一为 `optionType`（单数），与后端一致

---

### 7. `OrderRecord` 类型字段覆盖不全

| 项目 | 内容 |
|------|------|
| **严重等级** | 🔵 P3 |
| **影响** | 前端无法访问后端返回的完整字段 |
| **前端文件** | `frontend/src/services/types.ts:93-104` |
| **后端文件** | `server/services/field_mapping.py:144-177` |
| **状态** | ✅ 已修复 |

**问题描述**：
- `OrderRecord` 仅定义 10 个字段
- `map_order()` 返回 27 个字段
- 缺失：`orderSysID`, `exchangeID`, `insertDate`, `cancelTime`, `frontID`, `sessionID`, `orderSubmitStatus`, `orderLocalID`, `volumeTotal`, `tradingDay`, `updateTime` 等

---

## 汇总

| 等级 | 编号 | 问题 | 状态 |
|------|------|------|------|
| 🟡 | 1 | isTrading 类型不匹配 | ✅ 已修复 |
| 🟡 | 2 | optionType 枚举值不匹配 | ✅ 已修复 |
| 🟡 | 3 | StopOrderRequest 类型与 API 不匹配 | ✅ 已修复 |
| 🟡 | 4 | account_update 未实现 | ✅ 已修复 |
| 🔵 | 5 | WS 消息类型列表不完整 | ✅ 已修复 |
| 🔵 | 6 | optionType 命名不一致 | ✅ 已修复 |
| 🔵 | 7 | OrderRecord 字段覆盖不全 | ✅ 已修复 |

> **全部 7 项已修复完成。** 检查日期：2026-07-27
