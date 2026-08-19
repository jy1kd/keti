### Task 3: 顶部菜单改名 + IPC market-view 语义

**Files:**
- Modify: `frontend/electron/menuTemplate.ts:46-47`（label）
- Modify: `frontend/electron/menuActions.ts`（`market` 窗口标题 `📊 期货`）
- Modify: `frontend/src/services/electron.ts:123-124`、`frontend/electron/preload.ts`（注释同步，可选）
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`、`frontend/electron/__tests__/menuManager.test.ts`

**Interfaces:**
- Consumes: `MenuAction['market-view']` 的 `view` 值 `'all' | 'options' | 'favorites'`（保持不变，仅 label 文案变）。
- Produces: 菜单 label `📊 期货` / `📉 期权`。Task 6 的 `MarketPanel` 处理器据此激活对应标签。

- [ ] **Step 1: 写失败测试**

更新 `frontend/electron/__tests__/menuTemplate.test.ts` 与 `menuManager.test.ts` 中「行情子菜单」断言：

```ts
it('行情子菜单镜像：期货/期权/自选/分隔符/在新窗口打开', () => {
  // 原来断言 '📊 全部行情' / '📉 T型期权'，改为：
  expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '🪟 在新窗口打开'])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/../electron/__tests__/menuTemplate.test.ts`（若 vitest 不覆盖 electron，改用 `cd frontend && npx vitest run electron` 或直接断言更新后重跑）
Expected: FAIL（label 仍是旧文案）

- [ ] **Step 3: 改 label**

`frontend/electron/menuTemplate.ts:46-47` 改为：

```ts
{ id: 'market-all', label: '📊 期货', action: { type: 'market-view', view: 'all' } },
{ id: 'market-options', label: '📉 期权', action: { type: 'market-view', view: 'options' } },
```

`frontend/electron/menuActions.ts:39` 的 `openTabWindow('market', 'tab-market', '📊 行情')` 改 `'📊 期货'`。

- [ ] **Step 4: 运行测试确认通过**

Run: 同 Step 2
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/electron/menuTemplate.ts frontend/electron/menuActions.ts frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuManager.test.ts
git commit -m "feat(menu): 顶部行情菜单改名（全部行情→期货、T型期权→期权）"
```

---

