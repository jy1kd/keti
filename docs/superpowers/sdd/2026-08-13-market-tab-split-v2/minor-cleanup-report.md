# 行情表拆分 v2 — 遗留 Minor 清理报告

日期：2026-08-13
分支：`feature/md-refactor`

## 1. Status

**DONE**

8 项 Minor 全部实现，行为除指定改动外保持一致。全量测试 + 构建 + tsc 全绿。

## 2. Commit

- Hash: `246055567859e0a0b14a6a028fc5bac1345f808b`
- Subject: `fix(options): 行情表拆分 v2 遗留 8 项 Minor 清理`
- 8 files changed, 225 insertions(+), 37 deletions(-)

## 3. 逐项明细（file:line of fix + test added/updated）

### Item 1 — useSubscriptionManager.test.ts warnSpy finally 恢复
- 修复：`frontend/src/hooks/useSubscriptionManager.test.ts:168`（batch-cap 测试，断言包进 `try { ... } finally { warnSpy.mockRestore() }`）。
- 验证：断言失败时 spy 不再泄漏到后续用例（file-level beforeEach 未受影响）。

### Item 2 — 订阅上限测试：断言"下次 diff 重试"契约
- 测试：`frontend/src/hooks/useSubscriptionManager.test.ts:168`（同一条测试内追加）——首次 554 可见 → 首批 480 + 丢弃告警；随后可见区收窄到余量 `big.slice(480)`（74 个）→ 推进定时器越过拖停窗口（两次可见变化在 300ms 内被判拖动态，diff 在拖停后 500ms 执行）→ 断言第二次 `subscribeMarket` 批次恰好包含全部余量 74 个。
- 依赖 Item 5 的可见集比对修复保持拖动语义正确（两次真实可见变化仍触发拖动态，与修复前一致）。

### Item 3 — TQuoteTable 延迟 release 定时器句柄化
- 修复：`frontend/src/modules/options/TQuoteTable.tsx:107`（`releaseTimerRef`），`:157`（cleanup 先 `clearTimeout` 旧定时器再调度新释放，释放触发时置 null）。同实例至多一个挂起释放定时器。
- 测试：`frontend/src/modules/options/TQuoteTable.test.tsx:141`（`快速挂载→卸载→挂载：同实例至多保留一个释放定时器，旧表仍被释放一次`）——StrictMode 双挂载模拟快速开合，推进 250ms 后断言 `release` 恰被调用 1 次。
- 已验证：临时回退修复（去掉 clearTimeout）→ 该测试失败（release 被调用 2 次），测试真实覆盖修复。

### Item 4 — T型报价首个到期日确定性选链
- 修复：`frontend/src/modules/options/TQuoteView.tsx:99-106`（`selectedChain` memo：filter 同标底 → 按 `expireDate.localeCompare` 升序 → 取首条），不再依赖响应顺序。
- 测试：`frontend/src/modules/options/TQuoteView.test.tsx:116`（`同标底多到期日乱序时按最早到期日确定选链`）——乱序 `[20260915, 20260815, 20261215]` → 断言选中 `IF2608-20260815`。

### Item 5 — 锁定变化不喂入拖动启发
- 修复：`frontend/src/hooks/useSubscriptionManager.ts:22`（模块级 `sameVisibleSet` 无序比较）、`:48`（`prevVisibleRef`）、`:250-258`（effect 内仅当可见集真实变化才 push 到 `recentChangesRef`；`lastVisible` 刷新与 `runFullDiff` 对锁定变化仍立即执行）。
- 测试：`frontend/src/hooks/useSubscriptionManager.test.ts:201`（`锁定/解锁合约变化不喂入拖动启发`）——300ms 内两次锁定变化（可见集不变）→ 断言第二次锁定立即 `subscribeMarket(['ag2508'])`，无 500ms 拖停延迟。
- 已验证：临时回退修复（去掉可见集比对、无条件 push）→ 该测试失败（第二次订阅被拖到拖停窗口后），测试真实覆盖修复。现有 15 个 useSubscriptionManager 测试全部保持通过。

### Item 6 — QuoteTable rAF 合并兜底仅同步未完成时调度
- 修复：`frontend/src/modules/market/QuoteTable.tsx:154-182`（`applyRowMerges` 返回 `next.size === underlyingRows.size`，无表/无 mergeCells 返回 false）、`:514-519`（contracts effect 仅当 `!mergedAll` 才调度 rAF 兜底）。
- 测试：`frontend/src/modules/market/QuoteTable.test.tsx:909`（`同步已合并全部标底行时不调度 rAF 兜底`——`rafCalls === 0`）、`:925`（`同步合并未完成（标底行未就绪）时调度 rAF 兜底重试`——mergeCells 抛错一次后 rAF 兜底调度并重试成功，`rafCalls === 1`，mergeCells 共 2 次）。共享 mock 的 `mergeCells.mockImplementationOnce` 在 finally 中 `mockReset` 清理，避免跨用例泄漏。

### Item 7 — TQuoteView selectUnderlying 请求序列守卫
- 修复：`frontend/src/modules/options/TQuoteView.tsx:109`（`lastRequestedUnderlyingRef`）、`:113`（请求发起时记录）、`:131`（.then 过期响应忽略）、`:137`（.catch 过期响应忽略）。
- 测试：`frontend/src/modules/options/TQuoteView.test.tsx:157`（`selectUnderlying 请求竞态`）——A 请求挂起、B 响应先到并渲染；晚到 resolve A → 断言表仍为 `IF2609-20260915`，`chain.underlying === 'IF2609'`（A 的慢响应被忽略）。

### Item 8 — TQuoteTable.test 真实定时器泄漏
- 修复：`frontend/src/modules/options/TQuoteTable.test.tsx:49`（beforeEach `vi.useFakeTimers()`）、`:56`（afterEach 先 `cleanup()` 卸载（fake timers 仍生效 → 延迟 release 定时器为 fake）再 `vi.useRealTimers()` 丢弃全部挂起 fake 定时器）。该模式对 RTL 自动 cleanup 与自定义 afterEach 的先后顺序均安全：无论卸载发生在自定义 afterEach 前还是后，release 定时器都不会以真实定时器跨用例触发。
- 同时重构 `:130`（`卸载后延迟 250ms 释放 vtable`）去掉内部 `useFakeTimers/useRealTimers`，改由 file-level 统一管理。
- 已验证：全量套件 1241 测试通过，无跨用例真实定时器干扰。

## 4. 测试结果

- 定向 4 文件：`npx vitest run src/hooks/useSubscriptionManager.test.ts src/modules/options/TQuoteTable.test.tsx src/modules/options/TQuoteView.test.tsx src/modules/market/QuoteTable.test.tsx` — **95/95 通过**。
- 全量：`npm test` — **105 files / 1241 tests 全部通过**。
- 构建：`npm run build` — 成功（仅既存 chunk >500kB 警告）。
- 类型：`npx tsc --noEmit` — 0 错误。

## 5. 关注点

- **Item 3 的 tradeoff**：同实例至多一个挂起释放定时器意味着 StrictMode 双挂载中，若真实卸载发生在 250ms 内，较早挂载创建的那张脱离表可能不会被释放（它的定时器被最新 cleanup 取消，release 合并到最新定时器）。这是任务明确指定的实现方向（"Keeps at most one pending release timer"）；仅在 dev StrictMode + 快速开合窗口内出现，生产（非 StrictMode）单挂载/单卸载无此路径，vtable 实例持有者也有限。测试断言"仅最新一次释放发生"（release 恰 1 次）与该语义一致。
- **Item 2 测试说明**：第二次"可见区收窄"属于真实可见变化，两次变化在 300ms 内被判拖动态、diff 在拖停后 500ms 执行——测试需推进 610ms 越过拖停窗口后断言余量重试，这是现有拖动机制的预期行为，非修复缺陷。
