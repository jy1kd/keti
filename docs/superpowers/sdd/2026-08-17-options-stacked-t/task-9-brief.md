### Task 9: 全量回归 + 收尾

**Files:**
- 无新增，仅验证。

- [ ] **Step 1: 全量测试 + 类型 + lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint --max-warnings 0 "src/**/*.{ts,tsx}" && node_modules/.bin/vitest run`
Expected: 全绿（隔离 electron main 偶发超时忽略，与本次无关）

- [ ] **Step 2: 提交（若有零散修改）**

```bash
git add -A && git commit -m "chore(options): 堆叠 T 型链 + 系列收藏 收尾"
```
（若无零散修改则跳过；不要空提交。）

---

## Self-Review 结果

1. **Spec 覆盖**：§4.1 数据管道→Task4；§4.2 合成标底→Task1、OptionChainGroup→Task3、TQuoteTable onRowClick→Task2；§4.3 交互→Task3/Task4；§4.4 订阅→Task3；§4.5 工具栏→Task4；§5.1 数据模型→Task5；§5.2 组头⭐→Task7；§5.3 收藏夹页→Task8；§6 测试策略全覆盖。
2. **Placeholder 扫描**：Task2/Task4 标注了列索引需按 `columns` 数组实际值更正（已写明具体索引），非占位；其余均为可执行代码。
3. **类型一致性**：`OptionGroup`/`OptionChain`/`ContractInfo` 跨 Task 一致；`syntheticUnderlyingContract`(Task1)→OptionsPanel(Task4)；`onRowClick`(Task2)→OptionChainGroup(Task3)→OptionsPanel(Task4)；series API(Task5)→CollectionPicker(Task6)→OptionsPanel(Task7)/CollectionPage(Task8)。`unionSerializedIds` 命名在 Task5/Task7/Task8 一致。
