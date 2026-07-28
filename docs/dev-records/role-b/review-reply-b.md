# PR-4 审查反馈处理记录

**审查分支**：`feature/pr-4-layout-framework`
**处理时间**：2026-07-13

---

## 🔴 阻断性问题处理

### 1. .con 敏感文件被提交到 git
- **状态**：✅ 已修复
- **修复**：`git rm --cached` 移除6个 .con 文件，`.gitignore` 添加 `*.con`
- **提交**：`13f956d` fix(PR-4): 移除 .con 敏感文件，添加到 .gitignore

### 2. 越权修改 docs/tasks/task-dev-flow.md
- **状态**：⏸️ 保留（用户指示暂不回滚）
- **理由**：用户明确表示先不回滚此文件

---

## 🟡 改进建议处理

### 1. dev-record-b.md 提交记录未更新
- **状态**：✅ 已采纳
- **修复**：补充4条提交记录（3feccf9, ffedb9f, e6077c6, 13f956d）

### 2. @visactor/vtable 使用 latest 标签
- **状态**：✅ 已采纳
- **修复**：改为 `^1.26.4`（当前安装版本 1.26.4）

### 3. market/store.ts 和 order/store.ts 结构相似
- **状态**：📋 保留不改
- **理由**：当前仅有 `selectedInstrument` 一个字段，后续 PR-6（行情 snapshots/batchUpdate）和 PR-10（报单 orderForm/submitOrder）会各自扩展，提前抽取反而增加耦合

---

## 🔵 疑问回复

### 1. query-area 高度是否需要支持用户调整？
- **回复**：同意建议，在 PR-15 快捷功能中添加拖拽调整高度功能

### 2. ContractSearch 搜索框何时实现完整功能？
- **回复**：同意建议，在 PR-6 行情表格中实现完整搜索功能（模糊搜索 + 结果列表 + 点击添加自选）
