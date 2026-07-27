---
name: role-a-dev-flow
description: 角色A 双窗口协作开发全流程，包含诊断、TDD、验证、审查、合并等规范。当用户提到角色A、后端开发流程、启动诊断、TDD开发、自验证、代码审查、处理反馈、人工验证、收尾合并等内容时使用此skill。
disable-model-invocation: true
---

# 角色A 双窗口开发流程（后端）

## 首次交互
Skill 加载后第一条回复，询问窗口身份：
```
📌 [role-a-dev-flow]
当前是开发窗口还是审查窗口？
- 开发窗口：写代码、TDD、提交、处理反馈、收尾合并
- 审查窗口：只读审查、写 review 反馈、不改代码
```
用户回答后固定模式，不再询问。每次回复第一行标注 `📌 [role-a-dev-flow]`。

## 开发窗口流程

### 第 1 步：启动诊断
- **⚠️ 必须先执行 `git log --oneline -20` 确认实际提交状态，再读 task.md**
- 读取 task.md，找到第一个「⏳ 待开始」且依赖满足的 PR
- **用 git log 交叉验证：task.md 中标记「⏳ 待开始」的 PR，git log 中是否已有对应 commit？如有则跳过该 PR**
- 校验分支 → 输出诊断结果
- 详情见 `references/diagnosis.md`
- 硬约束：不写代码、不 commit
- 被阻塞时：输出阻塞报告，等待用户决定
- ✅ 诊断完成后提示用户创建分支，等待确认

### 第 2 步：TDD 开发
用户确认分支后开始开发。TDD 循环：红 → 绿 → 重构
- 详情见 `references/tdd.md`
- 每个功能点 commit 代码
- 更新 dev-record-a.md
- ✅ 开发完成：更新 progress.md（PR 编号 + 状态「开发完成，待自验证」+ commit）
- ✅ 输出完成报告，提示进入自验证

### 第 3 步：自验证
逐条对比 task.md 验收标准与实际代码
- 详情见 `references/verification.md`
- 完整性检查：✅ 已实现 / ❌ 遗漏 / ⏸️ 推迟
- ⚠️ 遗漏/推迟项必须展示给用户，**等待用户决定后才能继续**（立即实现 / 确认推迟）
- ✅ 全部通过：更新 progress.md 状态为「开发完成，待审查」+ commit
- ✅ 提示用户切换审查窗口

### 第 4 步：处理审查反馈
审查窗口通过后，用户切回开发窗口处理反馈
- 详情见 `references/review.md`
- 读取 review-feedback-a-prX.md
- 🔴 必须修复，🟡 认同则改/不认同则记录理由
- 🔴 修复时定向修复，不重新跑完整 TDD 循环，但修复代码必须有对应测试
- 修复后直接走自验证（第 3 步），不回到 TDD 开发步骤
- ✅ 修复后：更新 review-reply + progress.md + commit
- ✅ 提示用户切换审查窗口做二次审查

### 第 5 步：人工验证
审查通过后，逐条引导用户手动验证功能。**⚠️ 这一步不是跑自动化测试，而是输出验证步骤让用户在浏览器/终端中手动执行。**
- 详情见 `references/verification.md`
- 后端：结合 Swagger 文档（http://localhost:8000/docs#/）确认参数和响应
- 前端：结合浏览器页面确认 UI 和交互
- **⚠️ 禁止直接运行 pytest/npm test — 人工验证的目的是让用户亲自确认功能可用**
- **⚠️ 每次只输出一条验证项的详细步骤，等待用户执行并反馈后，记录结果，再输出下一条**
- **⚠️ 每验证完一条，必须立即：**
  a. 记录到 verify-discussion-prX.md（结果 + 业务讨论）
  b. 然后才能进入下一条
- 全部验证完成后，将所有验证记录一次性批量 commit
- ✅ 全部通过：更新 progress.md 状态为「人工验证通过，待收尾」+ commit

### 第 6 步：收尾合并
- 详情见 `references/merge.md`
- 生成 PR 描述
- 更新 task.md（PR 状态 → ✅ 已完成）、task-dev-flow.md、progress.md、dev-record-a.md
- 知识图谱评估（仅展示评估结果，不执行更新，由用户决定）
- ✅ 最终 commit
- ✅ 提示用户手动合并：`git checkout main && git merge feature/pr-x-xxx && git push`

## 流程中断
用户说"暂停"、"取消"、"退出"时：
1. 停止当前操作
2. 如有未提交改动，提示用户决定：`git stash` 保存 / `git checkout .` 丢弃
3. 更新 progress.md 记录当前状态（如"开发中，暂停于第X步"）
4. 输出当前状态摘要，结束流程

## 输出格式
- 诊断结果：当前 PR、当前阶段、任务描述、建议分支名、依赖检查、工作区状态
- TDD 每轮：测试用例、红灯状态、绿灯状态、Commit 信息
- 开发完成报告：完成内容列表、测试结果、Commit 列表
- 审查报告：三级标注严重等级，附审查结论
- 每步完成后必须给出下一步操作指令

## 审查窗口流程

### 第 1 步：审查前准备
- git pull 确保最新（**⚠️ 如遇冲突，停止并提示用户解决**）
- 读 progress.md 确认状态
- git status 确认工作区干净
- git diff main...`当前分支名` 获取改动范围
- **如 progress.md 状态与 git log 不一致，以 git log 为准，提示用户可能有另一个窗口在操作**

### 第 2 步：执行审查
- 详情见 `references/review.md`
- 🔴 阻断性 / 🟡 改进建议 / 🔵 疑问
- **必须先写 review-feedback-a-prX.md，再给审查结论**（结论必须与文件一致）

### 第 3 步：审查后提示
- ✅ 提示开发窗口 commit review-feedback
- 审查通过：提示开发窗口执行人工验证
- 审查不通过：提示开发窗口处理审查反馈
