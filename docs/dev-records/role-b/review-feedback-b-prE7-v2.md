# PR-E7 二次审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-31
**审查范围**：PR-E7 commits `b615a68` + `d6f8cdc`（2 commits, 3 files, +387）

---

## 审查结论

**✅ 审查通过** — 无阻断性问题，1 个改进建议。

---

## ✅ 正面评价

1. **持久化设计完整**：`save()` → `<userData>/shortcuts.json`，`load()` 带 fallback 到默认值
2. **`loadAndRegister` 启动加载**：先尝试文件加载，无文件则用默认配置，与 `registerDefaults` 分离
3. **`updateShortcut` 冲突检测**：查找 action → 检查新 accelerator 冲突 → unregister 旧 → register 新
4. **`resetToDefaults` 恢复**：`unregisterAll` + `registerDefaults` + `save`
5. **`will-quit` 生命周期**：先 `save()` 再 `unregisterAll()`，确保配置不丢失
6. **构造函数可注入路径**：`storagePath?` 参数便于测试

---

## 🟡 改进建议

### I1: `open-kline` handler 未完成

**文件**：`main.ts:61-63`

```typescript
'open-kline': () => {
  mainWindow.webContents.send('get-selected-instrument');
},
```

发送 IPC 消息但无后续处理。建议改为直接打开 K 线窗口或实现双向通信。

---

## 测试状态

`shortcuts.test.ts`：14 个用例通过 ✅
