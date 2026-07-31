# PR-R8: TabStore 标签页状态管理

## 完成内容
- 新增 `frontend/src/stores/tabs.ts`：TabStore 实现
  - TabType 类型定义（8 种标签页类型）
  - Tab 接口定义（id, type, title, props, closable）
  - openTab：打开标签页 + type+instrumentID 去重
  - closeTab：关闭标签页（固定标签不可关闭）
  - setActiveTab：切换活跃标签页
  - getTabByType：按类型查找标签页
  - MAX_TABS = 15 标签页数量限制
  - PINNED_TAB_TYPE = 'market' 固定标签
  - openTab 返回 boolean 表示成功/失败
- 新增 `frontend/src/stores/tabs.test.ts`：20 个单元测试

## 影响范围
- `frontend/src/stores/tabs.ts`（新增）
- `frontend/src/stores/tabs.test.ts`（新增）

## 测试结果
- 20 个测试全部通过
- 覆盖：初始状态、openTab、closeTab、setActiveTab、getTabByType、标签页限制、固定标签

## 人工验证问题
- 无遗留问题

## 依赖关系
- 无依赖 PR
- 被依赖：PR-R9（TabBar）、PR-R10（TabContent）、PR-R11（App.tsx 重构）

## 审查结论
- 第 1 轮审查：1 🔴 + 2 🟡
- 🔴 #1（报告测试数量）：不适用（轻量文档模式无报告文件）
- 🟡 #2（openTab 返回 boolean）：已修复
- 🟡 #3（去重逻辑文档化）：已修复
- 第 2 轮审查：通过
