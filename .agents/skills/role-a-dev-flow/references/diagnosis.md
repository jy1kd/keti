# 启动诊断规则

## 信息来源优先级
1. git log（真实提交历史，永远准确）
2. 实际代码文件（磁盘上的代码，永远最新）
3. task.md + progress.md（任务状态）
4. 知识图谱（辅助参考，可能过时）

## 执行步骤
1. git pull
   - **⚠️ 如遇到冲突**：停止操作，输出冲突文件列表，提示用户手动解决后重新执行诊断
   - **禁止** `git push --force`、`git reset --hard` 等破坏性操作
2. **git log --oneline -20**，查看最近提交，记录已合并的 PR
3. 读取 docs/tasks/task.md，找第一个「⏳ 待开始」且依赖满足的 PR
4. **用 git log 交叉验证**：task.md 中的「⏳ 待开始」PR 是否已在 git log 中出现？如有则跳过
5. 读取 docs/tasks/task-dev-flow.md，确认阶段和并行安排
6. 读取 docs/dev-records/role-a/progress.md，了解已完成 PR
7. git status，检查未提交内容
8. git branch，确认当前分支
9. 分支校验：
   - 当前分支 == 期望分支 → 继续
   - 当前分支 == main → 提示创建分支
   - 不匹配 → 提示切换或确认
10. **读取当前 PR 涉及的实际代码文件**，确认现有实现（不依赖图谱定位）
11. 如有必要，读取 .ua/knowledge-graph.json 作为辅助参考

## 硬约束
- 不写代码、不改文件、不 commit
- 只输出诊断结果
- 诊断完成后提示用户创建分支，等待确认

## 双窗口冲突防护
- 诊断时如发现 progress.md 状态与 git log 不一致（如 progress.md 写"开发中"但 git log 已有合并记录），以 git log 为准
- 提示用户可能有另一个窗口在操作，建议先确认再继续

## 知识图谱策略
- 仅作为辅助参考，不作为主要信息来源
- 普通 PR 不更新图谱
- 阶段完成 / 架构变更 / 用户要求时才更新
