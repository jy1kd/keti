# TDD 修复详解

## 流程
复现（红灯）→ 修复（绿灯）→ 回归测试 → Commit

## 第 1 步：写失败测试

按 task2.md 的修复方案，先写能复现 bug 的测试：

- **后端**：在 `server/tests/` 中添加测试用例
- **前端**：在对应的 `.test.ts` 文件中添加测试用例
- **必须确认红灯** — 运行测试，确认失败

```bash
# 后端
cd server && python -m pytest tests/test_xxx.py::TestClass::test_method -v

# 前端
cd frontend && npm test -- --testPathPattern=xxx.test.ts
```

## 第 2 步：实现修复

按 task2.md 的修复方案逐个修改涉及文件：

- **后端**：修改 `server/` 下的文件
- **前端**：修改 `frontend/src/` 下的文件
- **文档**：修改 `docs/` 下的文件（如 task2.md 方案中包含）

⚠️ 严格按照 task2.md 中的修复方案执行，不要"顺便"改其他东西。

## 第 3 步：跑全量测试

修复后必须跑全量测试，确认不引入新问题：

```bash
# 后端
cd server && python -m pytest tests/ -v

# 前端
cd frontend && npm test
```

## 第 4 步：Commit

每个功能点一个 commit：
```
fix(task-xx): 简述修复内容
```

## Commit 规范
- 修复：`fix(task-xx): 简述`
- 修复审查反馈：`fix(task-xx): review反馈 - 简述`
- 文档更新：`docs(task-xx): 简述`
