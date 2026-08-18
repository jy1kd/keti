# TDD 开发规则

## 开始前
- 使用诊断阶段已定位的文件路径确认改动范围，不重新读图谱
- 确认当前任务来源（task.md 或 task-redesign.md）
- **task-redesign.md**：同时读取 `docs/tasks/task-redesign.md`（PR 拆分、验收标准）和 `docs/specs/redesign-plan.md`（架构设计、数据流、界面布局）

## TDD 循环
1. 红：写测试，确认失败
2. 绿：写实现，测试通过
3. 重构（可选）

## Commit 规范
- 测试红灯：`test(task-xx): failing tests for XXX`
- 测试绿灯：`feat(task-xx): implement XXX`
- 重构：`refactor(task-xx): optimize XXX`
- 重构任务：`feat(redesign-rX): implement XXX`

## 文档同步
- **task.md**：开发过程同步更新 dev-record-b.md
- **task-redesign.md**：跳过 dev-record-b.md（无额外文档）

## 开发完成
- 更新任务文件中 PR 状态为「开发完成，待自验证」
- commit 进度文件
- 输出完成报告（完成内容、测试结果、commit 列表）
- 提示进入自验证
