---
name: simnow-bug-fix
description: SimNow 项目 bug 修复专用流程。当用户提到修 bug、修复问题、bug 修复、处理 task2、修 bug 流程、bugfix 等内容时使用此 skill。融合 superpowers 的根因调查方法论，按 task2.md 记录逐个修复，前后端代码都需要修改时统一处理。
disable-model-invocation: true
---

# SimNow Bug 修复流程

## 首次交互
Skill 加载后第一条回复：
```
📌 [simnow-bug-fix]
请描述 bug 来源：
1. task2.md 中的 PR（输入 PR 编号，如 PR-C1）
2. 人工测试发现的问题（直接描述现象）
```
用户回答后开始诊断。每次回复第一行标注 `📌 [simnow-bug-fix]`。

## 第 1 步：诊断
- **⚠️ 必须先执行 `git log --oneline -20` 确认实际提交状态，再读 task2.md**
- 读取 task2.md，找到第一个「⏳ 待开始」且依赖满足的 PR
- **用 git log 交叉验证：task2.md 中标记「⏳ 待开始」的 PR，git log 中是否已有对应 commit？如有则跳过该 PR**
- 校验分支 → 输出诊断结果
- 详情见 `references/diagnosis.md`
- 硬约束：不写代码、不 commit
- 被阻塞时：输出阻塞报告，等待用户决定
- ✅ 诊断完成后提示用户创建分支，等待确认

## 第 2 步：根因调查
用户确认分支后，按 superpowers 4 阶段方法论执行根因调查。**没有完成根因调查就不能修。**

1. **读错误信息** — 读 task2.md 中的问题描述，理解 bug 的具体表现
2. **稳定复现** — 运行相关测试或手动操作，确认能稳定触发
3. **检查相关代码** — 读 task2.md 中列出的涉及文件，理解当前实现
4. **追踪数据流** — 从前端 → API → 后端 → CTP，找到断点在哪一层
5. **形成假设** — "X 是根因因为 Y"，明确写出
6. **验证假设** — 最小改动测试，一次只改一个变量

详情见 `references/root-cause.md`

## 第 3 步：TDD 修复
根因确认后，按 TDD 流程修复：

1. **写失败测试** — 先写一个能复现 bug 的测试用例（必须红灯）
2. **实现修复** — 按 task2.md 的修复方案修改代码（前后端都改）
3. **跑全量测试** — 确认修复不引入新问题
4. **Commit** — `fix(task-xx): 简述`

详情见 `references/tdd-fix.md`

## 第 4 步：验证
逐条对照 task2.md 中的验收标准：

- 完整性检查：✅ 已实现 / ❌ 遗漏 / ⏸️ 推迟
- 后端：结合 Swagger 文档（http://localhost:8000/docs#/）验证 API
- 前端：浏览器页面验证 UI
- ⚠️ 遗漏/推迟项必须展示给用户，**等待用户决定后才能继续**

详情见 `references/verification.md`

## 第 5 步：收尾
- 更新 task2.md：PR 状态改为「✅ 已修复」，填写修复 commit
- 更新 progress.md：记录本次修复
- **⚠️ 必须先 `git diff` 展示所有改动，用户确认后再 commit**
- 提交：`git add` 所有改动文件 + `git commit`
- ✅ 完成报告：修复内容、涉及文件、测试结果、验收状态

详情见 `references/cleanup.md`

## 流程中断
用户说"暂停"、"取消"、"退出"时：
1. 停止当前操作
2. 如有未提交改动，提示用户决定：`git stash` 保存 / `git checkout .` 丢弃
3. 更新 progress.md 记录当前状态（如"修复中，暂停于第X步"）
4. 输出当前状态摘要，结束流程

## 输出格式
- 诊断结果：当前 PR、当前阶段、bug 描述、涉及文件、依赖检查、工作区状态
- 根因调查：复现步骤、根因分析、假设验证结果
- TDD 每轮：测试用例、红灯状态、绿灯状态、Commit 信息
- 验证报告：逐条验收标准的验证结果
- 收尾报告：修复内容、涉及文件、测试结果、验收状态
