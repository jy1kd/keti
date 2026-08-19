### Task 7: OptionsPanel 组头 ⭐ 系列收藏（P1 后增量）

**Files:**
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（`OptionChainGroup` 组头加 ⭐；打开 `CollectionPicker` series 模式）
- Test: `frontend/src/modules/options/OptionsPanel.test.tsx`（追加：组头 ⭐ 打开 series 模式 picker）

**Interfaces:**
- Consumes: `unionSerializedIds(collections)`（Task 5）、`CollectionPicker` series 模式（Task 6）、`OptionChainGroup` 组头需透传 `isFavorited` 与 `onToggleFavorite(seriesID)`。
- Produces: 组头 ⭐ 切换系列收藏；OptionsPanel 管理 `picker` state（series 模式）。

- [ ] **Step 1: 写失败测试**

```tsx
it('组头 ⭐ 打开系列收藏选夹面板（series 模式）', async () => {
  render(<OptionsPanel />)
  // 展开 FG609
  fireEvent.click(screen.getByText('FG609'))
  await screen.findByText('20260930')
  const star = screen.getByTitle('收藏整条链') // 组头 ⭐
  fireEvent.click(star)
  expect(screen.getByText('收藏到收藏夹')).toBeDefined() // picker 打开（series 文案）
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx`
Expected: FAIL（组头无 ⭐）

- [ ] **Step 3: 最小实现**

`OptionChainGroup` props 增加 `isFavorited?: boolean`、`onToggleFavorite?: (seriesID: string) => void`；组头渲染 `★/☆` 按钮（stopPropagation，不触发折叠），点击调用 `onToggleFavorite(group.underlyingID)`。

`OptionsPanel` 增加 `pickerSeries: string[] | null`；组头 ⭐ → `setPickerSeries([underlyingID])`；渲染 `<CollectionPicker isOpen={!!pickerSeries} seriesIDs={pickerSeries ?? []} onClose=... />`。

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionChainGroup.tsx frontend/src/modules/options/OptionsPanel.test.tsx
git commit -m "feat(options): 组头 ⭐ 系列收藏（P2）"
```

