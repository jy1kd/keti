# 三项前端需求设计文档

**日期**：2026-08-19
**范围**：取消原生菜单收藏夹 · 期权表格双击报单 · 收藏夹重名 Bug 修复

---

## 一、取消顶部原生菜单「收藏夹」

### 1.1 问题描述

应用顶部原生菜单栏和系统托盘右键菜单中均有一个 "收藏夹 > 打开收藏夹" 项。该入口功能与应用内 MarketPanel 工具栏的文件夹图标完全重复，且位于原生菜单层级中不符合用户操作习惯，需要移除。

### 1.2 影响范围

| 文件 | 行号 | 变更内容 |
|------|------|----------|
| `frontend/electron/menuTemplate.ts` | L55-61 | 删除 `getAppMenuDef()` 返回数组中的「收藏夹」菜单对象 |

`getAppMenuDef()` 的返回值同时被 `menuManager.ts`（应用菜单栏）和 `trayManager.ts`（系统托盘菜单）消费，因此**只需删除一处定义**，两处菜单同步生效。

### 1.3 具体改动

在 `getAppMenuDef()` 返回的菜单数组中，删除以下对象：

```ts
{
  id: 'collections',
  label: '收藏夹',
  submenu: [
    { id: 'collections-open', label: '📁 打开收藏夹', action: { type: 'open-floating', tab: 'collections' } },
  ],
}
```

删除后，剩余菜单结构为：行情 · 交易 · 查询 · 设置（共 4 项）。

### 1.4 关联影响

- **IPC 通道** `menu:open-floating` 和 **preload 接口** `onOpenFloatingTab` **保留不动**——其他入口（如应用内工具栏按钮）仍使用这些通道。
- 应用内入口（MarketPanel 工具栏的文件夹图标按钮、右键菜单"管理收藏夹"）不受影响，继续正常工作。

### 1.5 验证要点

- [ ] 应用启动后，菜单栏显示 4 项（行情 · 交易 · 查询 · 设置），无「收藏夹」
- [ ] 系统托盘右键菜单同样无「收藏夹」项
- [ ] 应用内 MarketPanel 工具栏的文件夹图标仍可正常打开收藏夹管理页

---

## 二、期权行情表格增加双击打开报单功能

### 2.1 问题描述

期货行情表格（`QuoteTable`）支持双击打开悬浮「五档下单」窗口，期权行情表格（`OptionsTable`）目前只有单击选中+填价，缺少双击功能，需要补齐以保持交互一致性。

### 2.2 现有实现分析

**期货（已有双击）：**

- `QuoteTable.tsx` L274-325：通过 `click_cell` 事件实现 300ms 同行双击检测，调用 `onRowDoubleClick` 回调
- `MarketPanel.tsx` L152-163：使用 `usePointOrder` hook 分发单击（选中+填价）和双击（打开报单）
- `usePointOrder` → `openOrderPopup` → `openFloatingTab({ type: 'order', ... })` 打开悬浮窗

**期权（当前只有单击）：**

- `OptionsTable.tsx` L352-379：`click_cell` 仅处理单击，无双击检测逻辑
- `OptionsTable.tsx` 的 `OptionsTableProps` 接口只有 `onRowClick`，无 `onRowDoubleClick`
- `OptionsPanel.tsx` L251-259：仅传递 `onRowClick={onSelectContract}`

### 2.3 设计方案

#### 2.3.1 OptionsTable 新增双击检测（`OptionsTable.tsx`）

复用 `QuoteTable` 的双击检测模式：

```ts
// 新增 ref
const lastClickTimeRef = useRef(0)
const lastClickRowRef = useRef<number | null>(null)

// 新增 prop
interface OptionsTableProps {
  // ...现有 props
  onRowDoubleClick?: (instrumentID: string, price: number) => void
}
```

在 `click_cell` 处理函数末尾（L372-378 之后），添加双击检测：

```ts
const now = Date.now()
const isDoubleClick =
  lastClickRowRef.current === rowIndex &&
  now - lastClickTimeRef.current < 300
lastClickTimeRef.current = now
lastClickRowRef.current = rowIndex

if (isDoubleClick) {
  onRowDoubleClickRef.current?.(instrumentID, price)
}
```

> **注意**：underlying 行（`kind === 'underlying'`）仅触发展开/折叠，不参与双击检测。

#### 2.3.2 OptionsPanel 接入双击（`OptionsPanel.tsx`）

使用与 `MarketPanel` 相同的 `usePointOrder` hook：

```ts
const { handleClick, handleDoubleClick } = usePointOrder({
  onOrder: ({ instrumentID, price }) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    if (!(inst && inst.productClass === '1') && price > 0) {
      setOrderForm({ limitPrice: price })
    }
  },
  onFill: ({ instrumentID }) => {
    setSelectedInstrument(instrumentID)
    openOrderPopup(instrumentID)
  },
})
```

在 `<OptionsTable />` 中传递新 prop：

```diff
  <OptionsTable
    records={records}
    snapshots={snapshots}
    isActive={isActive}
    onToggleGroup={toggleGroup}
-   onRowClick={onSelectContract}
+   onRowClick={handleClick}
+   onRowDoubleClick={handleDoubleClick}
    onContextMenu={handleContextMenu}
    onVisibleRangeChange={handleVisibleRangeChange}
  />
```

### 2.4 影响范围

| 文件 | 变更 |
|------|------|
| `frontend/src/modules/options/OptionsTable.tsx` | 新增 `onRowDoubleClick` prop + 300ms 双击检测逻辑 |
| `frontend/src/modules/options/OptionsPanel.tsx` | 使用 `usePointOrder` 替代原 `onSelectContract`，传递 `handleDoubleClick` |

两个文件改动，不涉及后端、不新增依赖，逻辑与期货表格对齐。

### 2.5 边界情况

- **underlying 行双击**：不触发报单，仅展开/折叠（与单击行为一致）
- **Call/Put 跨列双击**：双击检测基于 `rowIndex`，300ms 内点击同一行的不同侧（Call/Put）不会误判为双击（与期货行为一致）
- **无快照时双击**：`price` 为 0 时仍然打开报单窗口，价格字段留空（与期货行为一致）

### 2.6 验证要点

- [ ] 单击期权 C/P 单元格：选中合约 + 预填限价（行为不变）
- [ ] 双击期权 C/P 单元格：打开悬浮「五档下单」窗口（新功能）
- [ ] 双击 underlying 行：仅展开/折叠，不触发报单
- [ ] 300ms 内连续点击 Call → Put（同一行）：视为两次单击，不触发双击
- [ ] 期货表格双击行为不受影响

---

## 三、收藏夹重名 Bug 修复

### 3.1 问题描述

用户可以在收藏夹管理页（`CollectionsPage`）或收藏选择器（`CollectionPicker`）中创建两个同名收藏夹。重命名时同样可以改为已存在的名称。原因是 `createCollection` 和 `renameCollection` 均无重名校验。

### 3.2 现有实现分析

**创建入口（2 处）：**

- `CollectionsPage.handleCreate`（L16-21）：仅校验 `if (!name) return`
- `CollectionPicker.handleCreate`（L81-88）：仅校验 `if (!name) return`

**Store 层（`collections.ts`）：**

- `createCollection`（L112-118）：生成唯一 `id`，直接追加到数组，无名称校验
- `renameCollection`（L120-124）：直接替换 `name`，无重名校验

### 3.3 修复方案

#### 3.3.1 Store 层添加重名校验（`collections.ts`）

**`createCollection` 方法：**

```ts
createCollection: (name) => {
  const exists = get().collections.some(
    (c) => c.name === name
  )
  if (exists) return null  // 返回 null 表示创建失败

  const id = nextCollectionId()
  const collections = [...get().collections, { id, name, instrumentIDs: [], seriesIDs: [] }]
  persist(collections)
  set({ collections })
  return id
}
```

**`renameCollection` 方法：**

```ts
renameCollection: (id, name) => {
  const exists = get().collections.some(
    (c) => c.id !== id && c.name === name
  )
  if (exists) return false  // 返回 false 表示重命名失败

  const collections = get().collections.map((c) =>
    c.id === id ? { ...c, name } : c
  )
  persist(collections)
  set({ collections })
  return true
}
```

#### 3.3.2 UI 层处理返回值并提示

**`CollectionsPage.handleCreate`（L16-21）：**

```ts
const handleCreate = () => {
  const name = newName.trim()
  if (!name) return
  const id = createCollection(name)
  if (id === null) {
    toast.error('收藏夹名称已存在')
    return
  }
  setNewName('')
  toast.success(`已新建收藏夹「${name}」`)
}
```

**`CollectionPicker.handleCreate`（L81-88）：**

```ts
const handleCreate = () => {
  const name = newName.trim()
  if (!name) return
  const id = createCollection(name)
  if (id === null) {
    toast.error('收藏夹名称已存在')
    return
  }
  setChecked((prev) => new Set(prev).add(id))
  setNewName('')
  toast.success(`已新建收藏夹「${name}」`)
}
```

**`CollectionsPage.commitRename`（L34-43）：**

在重命名提交处同样检查 `renameCollection` 返回值，失败时 toast 提示「收藏夹名称已存在」。

### 3.4 影响范围

| 文件 | 变更 |
|------|------|
| `frontend/src/stores/collections.ts` | `createCollection` 返回值改为 `string \| null`；`renameCollection` 返回值改为 `boolean` |
| `frontend/src/pages/CollectionsPage.tsx` | `handleCreate`、`commitRename` 增加返回值检查和 toast |
| `frontend/src/components/CollectionPicker/index.tsx` | `handleCreate` 增加返回值检查和 toast |
| `frontend/src/stores/collections.test.ts` | 补充重名场景测试用例 |

### 3.5 类型变更说明

`createCollection` 的返回类型从 `string` 变为 `string | null`，所有调用方（共 2 处）同步更新。`renameCollection` 无显式返回值，新增 `boolean` 返回不影响现有调用方（无返回值消费）。

### 3.6 验证要点

- [ ] 创建同名收藏夹：弹出 toast「收藏夹名称已存在」，不产生重复项
- [ ] 重命名为已存在名称：弹出 toast，名称不变
- [ ] 创建不同名收藏夹：行为不变
- [ ] 重命名为不冲突名称：行为不变
- [ ] `CollectionPicker` 内创建同名收藏夹同样受阻

---

## 改动汇总

| # | 问题 | 文件数 | 后端影响 | 新增依赖 |
|---|------|--------|----------|----------|
| 1 | 取消原生菜单收藏夹 | 1 | 无 | 无 |
| 2 | 期权双击打开报单 | 2 | 无 | 无 |
| 3 | 收藏夹重名修复 | 4 | 无 | 无 |

全部为纯前端改动，不涉及后端、不新增依赖。
