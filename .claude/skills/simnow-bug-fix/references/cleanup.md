# 收尾详解

## 流程
更新文档 → git diff 展示 → 用户确认 → commit → 完成报告

## 第 1 步：更新文档

**task2.md**：
- PR 状态从「⏳ 待开始」改为「✅ 已修复」
- 填写修复 commit hash

**progress.md**：
- 记录本次修复的 PR 编号和状态

## 第 2 步：展示改动并确认

⚠️ **必须先 `git diff` 展示所有改动，用户确认后再 commit**

```bash
git diff
```

等待用户确认。

## 第 3 步：Commit

```bash
git add 所有改动文件
git commit -m "fix(task-xx): 简述"
```

## 第 4 步：完成报告

```
📌 [simnow-bug-fix]

📋 修复完成报告

PR-X：[标题]
状态：✅ 已修复

修复内容：
- [文件1]：[改动说明]
- [文件2]：[改动说明]

测试结果：
- 后端：✅ 全部通过（N 个测试）
- 前端：✅ 全部通过（N 个测试）

验收状态：✅ 全部通过

Commit：abc1234 fix(task-xx): 简述
```
