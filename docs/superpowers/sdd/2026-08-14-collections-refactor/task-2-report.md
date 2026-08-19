# Task 2 Report: CollectionPicker 选夹面板组件

**Status:** DONE_WITH_CONCERNS（brief 中组件实现有一处真实缺陷，已修复；测试文件加了 3 处类型转换以满足 tsc）

## 实现内容

按 task-2-brief 完成 `CollectionPicker` 独立弹层组件（复用全局 modal 骨架 `modal-overlay`/`modal-content`/`modal-header`/`modal-close`，新增 `.collection-picker*` 样式）：

- **Props**：`{ isOpen, instrumentIDs, onClose }`；`instrumentIDs.length===1` 单选对账（取消勾选即移除、可全移除），`>1` 批量只加不删
- **勾选态初始化**：单选预勾选所在夹；批量不预勾选
- **交互**：全选/全不选 toggle；新建收藏夹（回车/+ 新建，创建即勾选）；「移除全部收藏」（仅单选）；「管理收藏夹」打开 collections 标签；外部点击 / Esc 关闭；确定时单选空勾选 = 移除全部收藏、批量空勾选 = toast.error 且不关闭

## TDD 证据

### RED（组件不存在）

```
$ npx vitest run src/components/CollectionPicker/index.test.tsx
FAIL src/components/CollectionPicker/index.test.tsx
Error: Failed to resolve import "./index" from "src/components/CollectionPicker/index.test.tsx". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

### RED（brief 实现按原文落地后，1 个测试失败）

```
$ npx vitest run src/components/CollectionPicker/index.test.tsx
✓ 8 passed | ✗ 1 failed
FAIL > 新建收藏夹：回车创建并勾选
→ expected false to be true // Object.is equality  (index.test.tsx:76)
```

**根因**：brief 中初始化勾选态的 effect 依赖数组含 `collections`。组件内 `handleCreate → createCollection` 会变更 store 的 `collections`，导致 effect 重跑并把 `checked` 重置为「仅含目标合约的夹」，新夹勾选态被清掉。这是 brief 实现与自身测试相矛盾的真实缺陷（测试不可改，故修实现）。

**修复**：effect 依赖改为 `[isOpen, single, targetId]`（仅打开/目标变更时初始化），并在代码注释中说明原因；外部对 collections 的增删只影响列表渲染，checked 中的残留 id 在确认时经 store 天然忽略（addToCollections 对不存在的夹 id 为 no-op），无副作用。

### GREEN

```
$ npx vitest run src/components/CollectionPicker/index.test.tsx
✓ src/components/CollectionPicker/index.test.tsx (9 tests) 527ms
Test Files  1 passed (1)
     Tests  9 passed (9)
```

### 全量回归

```
$ npx vitest run
Test Files  114 passed (114)
     Tests  1298 passed (1298)
```

### tsc / eslint

```
$ npx tsc --noEmit        # exit 0
$ npx eslint src/components/CollectionPicker/ --max-warnings 0   # exit 0
```

## 文件变更

- 新增 `frontend/src/components/CollectionPicker/index.tsx` — 组件实现
- 新增 `frontend/src/components/CollectionPicker/index.css` — 面板样式（仅 `.collection-picker*`）
- 新增 `frontend/src/components/CollectionPicker/index.test.tsx` — 9 个测试

提交：`4eb97ba feat(collections): CollectionPicker 选夹面板组件`

## 与 brief 的偏差（均有理由）

1. **初始化 effect 依赖数组去掉 `collections`**（见上，bug 修复）。其余实现代码与 brief 完全一致。
2. **测试文件类型转换**（运行行为/断言零改动）：
   - `getByRole('checkbox', ...)` 结果 `.checked` 访问按仓库既有惯例加 `as HTMLInputElement`（与 BatchCancel 测试一致），否则 `tsc --noEmit` 报 TS2339
   - `t.type === 'collections'` 改为 `(t.type as string) === 'collections'`，因 TabType 在 Task 4 才加入 `collections`
3. **组件 `openTab`** 按任务指示用 `openTab({ type: 'collections' as any, ... })`，并加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`（Task 4 加入类型后移除）。

## 自审发现

- 9 个测试全部验证真实 store 变更（非 mock）；Toast 仅 mock 用于断言调用
- 单选对账 / 批量只加不删 / 全选 toggle / 回车新建即勾选 / 移除全部并关闭 / 管理打开标签 / Esc / 批量空勾选 error 均符合 brief 预期
- 未改 `stores/tabs.ts`（Task 4 范围）；未接线到任何面板（Task 3 范围）
- `index.css` 与 brief 逐字一致；无 overbuild

## Concerns

- 依赖数组差异已通过 9/9 测试 + 全量 1298 测试验证，行为正确
- `as any` cast 与 `as HTMLInputElement` 为 Task 4 加入 `collections` 类型后的清理点（代码注释已标注）
