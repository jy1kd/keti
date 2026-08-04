# 审查回复 — PR-R20: 持仓平仓打开报单标签

**回复时间**: 2026-08-04
**审查反馈**: `review-feedback-redesign-r17.md`（⚠️ 文件名应为 r20，内容确认针对 PR-R20，详见文末注记）
**状态**: ✅ 审查通过（无 🔴）+ 🟡 建议已修复，待二次审查

---

## 一、审查反馈处理

### 🔴 阻断性问题
无。

### 🟡 改进建议

| 编号 | 内容 | 处理 | 说明 |
|------|------|:----:|------|
| 🟡1 | 新增测试未锁「填参数 + 开标签」完整链路；`volumeTotalOriginal` 从未被断言 | ✅ 已修复 | 新测试追加 `form.direction`/`form.combOffsetFlag`/`form.volumeTotalOriginal` 断言，把「点击平仓 → 填参数 + 开标签」完整行为锁在同一用例 |
| 🟡2 | 工作区 `frontend/dist-electron/windowManager.cjs` 行尾（LF/CRLF）噪音改动 | ✅ 已修复 | 已核实 `git diff` 内容为空（纯行尾噪音），执行 `git checkout --` 丢弃，工作区已干净 |

### 🔵 疑问

| 编号 | 内容 | 处理 | 说明 |
|------|------|:----:|------|
| 🔵1 | MAX_TABS 达上限时 `openTab` 静默失败（返回 false 无提示） | ⏸️ 确认可接受 | 与 R13 双击打开报单标签既有行为一致，属 `openTab` 通用设计（非本次引入）。修复需改 `stores/tabs.ts` 影响所有调用方，超出 R20 范围。**决定：另立独立 PR** 处理（openTab 失败时 toast 提示） |
| 🔵2 | 既有用例点击平仓触发 openTab 副作用，tabStore 未统一重置，存在顺序依赖 | ✅ 已修复 | 在 `Position.test.tsx` `beforeEach` 统一重置 `useTabStore`（恢复默认 market 标签），用例顺序无关 |

---

## 二、变更文件清单

```
frontend/src/modules/query/Position.test.tsx   # 更新：beforeEach 重置 tabStore + 新测试追加完整链路断言
frontend/dist-electron/windowManager.cjs       # 丢弃行尾噪音改动（不纳入 commit）
docs/snapshots/role-b/review-reply-redesign-r20.md  # 新增：本回复
```

> 注：`Position.tsx` 实现代码本轮无改动（审查未提出 🔴，🟡 均为测试/卫生类）。

## 三、测试结果

| 项目 | 结果 |
|------|------|
| Position | 11 tests ✅ |
| **全量** | **769 tests / 76 files ✅** |

## 四、二次审查请求

请审查窗口对**修复后 diff**做二次审查（重点：`beforeEach` tabStore 重置、新测试完整链路断言、`volumeTotalOriginal` 覆盖）。

---

### 注记：审查反馈文件名

反馈文件被命名为 `review-feedback-redesign-r17.md`，但内容标题明确为「PR-R20 审查反馈」（审查范围 diff 为 `feature/redesign-r20-position-close`）。按命名规范应为 `review-feedback-redesign-r20.md`。本回复按规范命名为 r20 以便追溯；如需重命名反馈文件，请在二次审查时一并处理。
