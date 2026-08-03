# PR-R6 人工验证记录

**验证时间**: 2026-08-03
**验证人**: 用户
**分支**: feature/redesign-r6-multiselect

---

## 验证项

| # | 验证项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | Ctrl+点击选择 | ✅ 通过 | 按住 Ctrl 点击多个合约行，选中状态正确 |
| 2 | Ctrl+点击取消 | ✅ 通过 | 按住 Ctrl 点击已选中的合约行，取消选中 |
| 3 | Shift+点击范围选择 | ✅ 通过 | 点击一行，按住 Shift 点击另一行，中间行全部选中 |
| 4 | Ctrl+A 全选 | ✅ 通过 | 点击表格区域，按 Ctrl+A，全选所有合约 |
| 5 | 鼠标拖动选择 | ✅ 通过 | 鼠标长按拖动，选中经过的合约行 |
| 6 | 选中行高亮 | ✅ 通过 | 选中合约后，行显示蓝色高亮 |

---

## 业务讨论

### Shift+点击实现

**问题**: 最初 `lastClickedIndexRef.current = rowIndex` 在 `if` 块外面，但读取时仍然是 null。

**解决方案**: 先保存 `prevLastClicked = lastClickedIndexRef.current`，立即更新 `lastClickedIndexRef.current = rowIndex`，使用 `prevLastClicked` 进行范围计算。

### 高亮显示响应速度

**问题**: `selectedContracts` 变化后，vtable 没有自动重新渲染行样式。

**解决方案**: 添加 `useEffect` 监听 `selectedContracts` 变化，调用 `invalidate()` 或 `setRecords()` 触发 vtable 重新渲染。

---

## 验证结论

✅ **全部通过** — PR-R6 人工验证完成
