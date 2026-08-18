# TDD 开发规则

## 开始前
- 使用诊断阶段已定位的文件路径确认改动范围，不重新读图谱

## TDD 循环
1. 红：写测试，确认失败
2. 绿：写实现，测试通过
3. 重构（可选）

## Commit 规范
- 测试红灯：`test(task-xx): failing tests for XXX`
- 测试绿灯：`feat(task-xx): implement XXX`
- 重构：`refactor(task-xx): optimize XXX`

## 文档同步
- 开发过程同步更新 dev-record-a.md

## 开发完成
- 更新 progress.md（PR 编号 + 状态「开发完成，待自验证」）
- commit 进度文件
- 输出完成报告（完成内容、测试结果、commit 列表）
- 提示进入自验证
