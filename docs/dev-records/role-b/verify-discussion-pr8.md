# PR-R8 TabStore 人工验证记录

**验证人**：角色B（开发窗口）
**验证日期**：2026-07-30
**验证方式**：自动化脚本 `tabs.verify.ts`

---

## 验证项 1：能创建新标签页

**前置条件：** store 初始状态（仅 market 标签）
**验证步骤：**
1. 调用 `openTab({ type: 'query', title: '📋 查询' })`
2. 检查返回值、tabs 数组、activeTabId

**结果：** ✅ 通过
- openTab 返回 true
- tabs 数组长度为 2
- 新标签页类型、标题、closable 正确
- activeTabId 指向新标签页

---

## 验证项 2：能关闭标签页

**前置条件：** 已打开 market + query 两个标签页
**验证步骤：**
1. 调用 `closeTab('tab-query')`
2. 检查 tabs 数组、目标标签是否移除、activeTabId

**结果：** ✅ 通过
- 关闭后 tabs 数组长度为 1
- query 标签页已移除
- activeTabId 回到 market

---

## 验证项 3：能切换标签页

**前置条件：** 已打开 market + query 两个标签页
**验证步骤：**
1. 调用 `setActiveTab('tab-market')` → 验证切换到 market
2. 调用 `setActiveTab(queryTabId)` → 验证切换回 query

**结果：** ✅ 通过
- activeTabId 正确切换

---

## 验证项 4：标签页限制（最多 15 个）

**前置条件：** 初始状态
**验证步骤：**
1. 打开 14 个额外标签页（加上 market = 15）
2. 尝试打开第 16 个标签页
3. 检查返回值和 tabs 数量

**结果：** ✅ 通过
- 15 个标签页正常打开
- 第 16 个返回 false
- tabs 数量仍为 15

---

## 验证项 5：固定标签不能关闭

**前置条件：** 仅 market 标签页
**验证步骤：**
1. 调用 `closeTab('tab-market')`
2. 检查 tabs 数组、market 标签是否仍在、activeTabId

**结果：** ✅ 通过
- market 标签仍在
- activeTabId 仍为 market

---

## 验证项 6：去重逻辑（相同 type+instrumentID 激活已有）

**前置条件：** 已打开 order-au2406 标签页
**验证步骤：**
1. 再次调用 `openTab({ type: 'order', props: { instrumentID: 'au2406' } })`
2. 检查返回值、tabs 数量、activeTabId

**结果：** ✅ 通过
- 重复打开返回 true（激活已有）
- tabs 数量仍为 2（不重复创建）
- activeTabId 指向已有标签

---

## 验证项 7：关闭活跃标签页时激活相邻标签

**前置条件：** 3 个标签页（market, query, settings），settings 为活跃
**验证步骤：**
1. 关闭 settings → 验证激活 query（前一个）
2. 重新打开 settings，设 query 为活跃，关闭 query → 验证激活 settings（后一个）

**结果：** ✅ 通过
- 关闭末尾活跃标签后，激活前一个
- 关闭中间活跃标签后，激活后一个

---

## 验证总结

| 验证项 | 结果 |
|--------|------|
| 1. 创建新标签页 | ✅ |
| 2. 关闭标签页 | ✅ |
| 3. 切换标签页 | ✅ |
| 4. 标签页限制 | ✅ |
| 5. 固定标签不可关闭 | ✅ |
| 6. 去重逻辑 | ✅ |
| 7. 关闭活跃标签激活相邻 | ✅ |

**结论**：全部通过，无遗留问题。
