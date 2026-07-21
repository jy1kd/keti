# PR-20 Code Review 反馈

## 第 1 轮审查（初审）

审查分支：`feature/pr-20-instrument-refresh-ui`
审查 commit：`2a4d682..0106342`（5 commits，范围 `origin/main..feature/pr-20-instrument-refresh-ui`）
审查时间：2026-07-21 11:10

### 🔴 阻断性问题（必须修改）

无

### 🟡 改进建议

1. **【snapshots/role-b/progress.md:336-357】PR-20 存在重复条目，旧条目未清理**
   - 原因：progress.md 中第 336-357 行保留着 "⏳ 待开始" 的旧 PR-20 条目，第 384-412 行又新增了 "✅ 已完成（待审查）" 的条目。同一 PR 在文档中出现两次，容易造成混淆。
   - 建议：删除第 336-357 行的旧条目（「待开始」状态的那一条），只保留第 384-412 行的最新条目。

2. **【frontend/src/hooks/useMarketWs.ts:64】`fetchInstruments` 提取位置与其他 selector 不一致**
   - 原因：`updateSnapshot`、`appendKline`、`setMdConnected` 在组件顶部提取（第 53-55 行），而 `fetchInstruments` 在 `wsRef` 初始化之后才提取（第 64 行）。虽然功能正确（zustand selector 返回稳定引用），但可读性略受影响。
   - 建议：将 `const fetchInstruments = useMarketStore((s) => s.fetchInstruments)` 移至第 55 行，与其他 selector 放在一起。

### 🔵 疑问确认

1. **【frontend/src/hooks/useMarketWs.test.ts:218】测试命名 "忽略非 instruments_refreshed 消息中的未知字段"**
   - 内容：该测试验证 `connection_status` 类型的消息不会触发 toast，但测试名说的是"未知字段"而非"其他消息类型"。请问这是否意图测试消息中存在未识别字段的情况（如 `{ type: 'instruments_refreshed', data: { count: 5, unknownField: 123 } }`），而实际测试只是验证了不同 message type 不会交叉触发？如果是前者（验证未知字段容错），当前测试未覆盖该场景；如果是后者（验证消息类型隔离），建议重命名为 "不响应非 instruments_refreshed 类型的 WS 消息"。

2. **【frontend/src/hooks/useMarketWs.ts:75】`message.data` 类型断言为 `{ count: number }`**
   - 内容：当后端推送 `instruments_refreshed` 消息时，`data.count` 是否可能为 0（如合约列表为空的情况）？当前 toast 会显示 "已更新 0 个合约"，语义上略显尴尬。请问这是否为一个需要前端防御的合理场景，还是后端保证 count > 0？

### 审查结论

✅ **通过**（无需修改即可合入，上述建议为可选优化）

**审查总结**：
- 功能实现完整，与 task.md 需求一致（刷新按钮 → API → WS 通知 → Toast + refetch）
- 代码质量好：错误处理使用 try-catch-finally，zustand 状态管理规范，CSS 使用自定义属性
- 测试覆盖充分：新增 13 个测试（API 2 + Store 4 + useMarketWs 3 + MarketPanel 4），覆盖 happy path、错误恢复、边界情况
- 287 个测试全部通过，TypeScript 编译无错误
- 改动范围受控：仅涉及 PR-20 相关文件，无无关改动
- 无阻断性问题；2 个 🟡 建议（文档清理 + 代码风格一致性）和 2 个 🔵 疑问（测试命名 + toast 边界）均为可选优化

下一步：请完成人工验证后切回开发窗口，生成 PR 描述并准备合并。

---

## 第 2 轮审查（复审 — 审查反馈修复验证）

审查分支：`feature/pr-20-instrument-refresh-ui`
审查 commit：`736b1ea..0a067b3`（2 commits，范围 `0106342..0a067b3`）
审查时间：2026-07-21 11:20

### 🔴 阻断性问题（必须修改）

无

### 🟡 改进建议

无

### 🔵 疑问确认

无

### 第 1 轮反馈逐项验证

| # | 类型 | 原始反馈 | 修复验证 |
|---|------|----------|----------|
| 🟡1 | progress.md 旧条目 | 删除第 336-357 行 "⏳ 待开始" 重复条目 | ✅ 已删除（23 行），grep 确认无残留 |
| 🟡2 | selector 位置 | 将 `fetchInstruments` 移至与其他 selector 一起 | ✅ 已移至第 55 行，与 updateSnapshot/appendKline 统一 |
| 🔵1 | 测试命名 | "未知字段" → 更准确的命名 | ✅ 已重命名为 "不响应非 instruments_refreshed 类型的 WS 消息" |
| 🔵2 | count=0 防御 | 添加 `count > 0` 守卫 | ✅ 已添加 `if (data.count > 0)` 守卫 + 新测试 "count=0 时不显示 toast" |

### 审查结论

✅ **通过**（所有第 1 轮反馈均已正确修复，无新问题）

**审查总结**：
- 4 条反馈全部采纳并正确修复
- 新增 1 个测试用例（count=0 边界），总计 288 tests / 34 files 全部通过
- `review-reply-b-pr20.md` 已创建，疑问回复清晰
- dev-record-b.md 已追加审查修复记录
- progress.md 状态已更新为「审查反馈已修复，待二次审查」
- 无新增文件改动，范围受控

下一步：请完成 **人工验证**（启动前端，点击"刷新合约"按钮，确认 loading 状态 → Toast 提示 → 合约列表刷新），切回开发窗口生成 PR 描述并准备合并。
