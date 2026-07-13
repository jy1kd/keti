# PR-4 Code Review 反馈

**审查分支**：`feature/pr-4-layout-framework`
**审查 commit**：`e6077c6` refactor(PR-4): 设计系统优化 — CSS变量统一、无障碍、样式去重
**审查时间**：2026-07-13

---

## 🔴 阻断性问题（必须修改）

1. **【根目录/server/】.con 敏感信息文件被提交到 git**
   - 文件：`DialogRsp.con`, `QueryRsp.con`, `TradingDay.con`（根目录和 server/ 目录各3个）
   - 原因：这些文件可能包含敏感配置信息，不应提交到版本控制
   - 建议：
     1. 将 `*.con` 添加到 `.gitignore`
     2. 使用 `git rm --cached` 从 git 历史中移除这些文件
     3. 确认这些文件是否需要保留，如不需要则删除

2. **【docs/task-dev-flow.md】越权修改非职责范围文件**
   - 原因：角色B 负责 `frontend/` 目录，但修改了 `docs/task-dev-flow.md`
   - 建议：回滚此文件的变更，或与角色A确认是否需要此修改

---

## 🟡 改进建议

1. **【dev-record-b.md:152】提交记录未更新**
   - 原因：dev-record-b.md 显示 "待提交"，但实际已有多个提交：
     - `3feccf9` feat(PR-4): 前端多面板布局框架
     - `ffedb9f` docs(PR-4): 更新进度快照和开发流程文档
     - `e6077c6` refactor(PR-4): 设计系统优化
   - 建议：更新提交记录，列出所有相关提交

2. **【package.json:15】`@visactor/vtable: "latest"` 使用 latest 标签**（PR-2 遗留问题）
   - 原因：latest 标签会拉取最新版本，可能导致不同时间安装的版本不一致
   - 建议：指定具体版本号，如 `"^1.0.0"` 或当前稳定版本

3. **【market/store.ts 和 order/store.ts】Store 结构相似**
   - 原因：两个 Store 都有 selectedInstrument 字段，存在重复代码
   - 建议：可考虑抽取为共享 hook 或 context，减少重复

---

## 🔵 疑问确认

1. **【global.css】query-area 高度设置**
   - 疑问：当前查询面板高度为 250px，是否需要支持用户调整？
   - 建议：可在 PR-15 快捷功能中添加拖拽调整高度功能

2. **【ContractSearch/index.tsx】搜索框功能**
   - 疑问：当前搜索框仅为占位符，实际搜索逻辑何时实现？
   - 建议：在 PR-6 行情表格中实现完整搜索功能

---

## 审查结论

❌ **需要修改后再审**

**理由**：
1. 存在 🔴 阻断性问题：敏感信息文件被提交到 git
2. 存在 🔴 阻断性问题：越权修改非职责范围文件
3. 文档同步问题：提交记录未更新

**必须修复**：
1. 移除 .con 敏感信息文件
2. 回滚 docs/task-dev-flow.md 的变更（或与角色A确认）
3. 更新 dev-record-b.md 的提交记录

**修复后**：
- 重新提交代码
- 切回审查窗口进行二次审查

---

## 下一步操作

请切回开发窗口，执行以下修复：

```bash
# 1. 移除 .con 文件从 git
git rm --cached DialogRsp.con QueryRsp.con TradingDay.con
git rm --cached server/DialogRsp.con server/QueryRsp.con server/TradingDay.con

# 2. 添加 .con 到 .gitignore
echo "*.con" >> .gitignore

# 3. 回滚 docs/task-dev-flow.md（如需要）
git checkout main -- docs/task-dev-flow.md

# 4. 更新 dev-record-b.md 提交记录

# 5. 提交修复
git add .
git commit -m "fix(PR-4): 移除敏感信息文件，修复范围控制问题"

# 6. 切回审查窗口进行二次审查
```
