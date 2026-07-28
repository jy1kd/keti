# PR-20 审查反馈处理记录

审查来源：`review-feedback-b-pr20.md`（第 1 轮初审）

---

## 处理结果

| # | 类型 | 内容 | 处理 | 说明 |
|---|------|------|------|------|
| 🟡1 | 改进建议 | progress.md PR-20 旧条目未清理 | ✅ 采纳 | 删除 lines 336-357 旧的"⏳ 待开始"条目 |
| 🟡2 | 改进建议 | fetchInstruments selector 位置不一致 | ✅ 采纳 | 移至第 55 行，与其他 selector 放在一起 |
| 🔵1 | 疑问确认 | 测试命名"未知字段"误导 | ✅ 采纳 | 重命名为"不响应非 instruments_refreshed 类型的 WS 消息" |
| 🔵2 | 疑问确认 | count=0 时 toast "已更新 0 个合约" | ✅ 采纳 | 添加 `if (data.count > 0)` 防御，新增对应测试用例 |

### 🔵 疑问回复

**🔵1 — 测试命名**：原命名确实不准确。该测试验证的是 message type 隔离（connection_status 不会触发 instruments_refreshed 的 handler），而非"未知字段"容错。已重命名为「不响应非 instruments_refreshed 类型的 WS 消息」。

**🔵2 — count=0**：虽然正常情况下 SimNow 柜台至少返回 8+ 个合约，但防御性编程是好的实践。已添加 `count > 0` 守卫，并补充了 count=0 不显示 toast 的测试用例。

---

## 修复统计

- 🔴 阻断性问题：0 条（无需修复）
- 🟡 改进建议：采纳 2 条，保留 0 条
- 🔵 疑问确认：已回复 2 条（全部采纳）

## Commit

- `736b1ea` fix(task-20): review反馈 - selector位置统一 + count=0防御 + 测试重命名 + 旧条目清理

## 测试结果

288 tests / 34 files passed (0 failures)
