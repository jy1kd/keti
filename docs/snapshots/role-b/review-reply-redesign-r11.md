# PR-R11 审查回复

| 项目 | 内容 |
|------|------|
| **PR** | PR-R11: App.tsx 重构：标签页布局 |
| **分支** | feature/redesign-r11-app-layout |
| **回复时间** | 2026-08-03 |

---

## 🔵-1: Ctrl+Shift+M 测试无断言

**处理**: ✅ 已修复

**修改内容**:
```tsx
// 修复前
it('Ctrl+Shift+M 切换性能监控', () => {
  render(<App />)
  fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
  // 性能监控应该显示
})

// 修复后
it('Ctrl+Shift+M 切换性能监控', () => {
  render(<App />)
  const fpsBtn = screen.getByText('⚡FPS').closest('button')
  expect(fpsBtn).toBeInTheDocument()

  // 触发快捷键后，FPS 按钮背景色应变化（perfVisible=true）
  fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
  expect(fpsBtn).toHaveStyle({ background: 'rgba(63,185,80,0.12)' })
})
```

---

## 🔵-2: 设置面板断言过于宽泛

**处理**: ✅ 已修复

**修改内容**:
```tsx
// 修复前
it('点击设置按钮打开设置面板', () => {
  render(<App />)
  const settingsBtn = screen.getByTitle('设置')
  fireEvent.click(settingsBtn)
  expect(screen.getByText(/设置/)).toBeInTheDocument()
})

// 修复后
it('点击设置按钮打开设置面板', () => {
  render(<App />)
  const settingsBtn = screen.getByTitle('设置')
  fireEvent.click(settingsBtn)
  expect(document.querySelector('.settings-overlay')).toBeInTheDocument()
})
```

---

## 🧹 改进建议：死代码清理

**处理**: ⏸️ 推迟至后续 PR

**理由**: `.main-content`、`.query-area` 等旧布局样式可能在后续 PR（如 PR-R14 报单标签页、PR-R15 查询标签页）中复用或引用。待标签页系统完整迁移后再统一清理。

---

## 测试结果

- App.test.tsx: 9 tests passed
- 修复后无破坏性变更

---

## 回复结论

**✅ 审查反馈已全部处理**
- 🔵-1: 已修复（添加断言）
- 🔵-2: 已修复（精确选择器）
- 死代码清理: 推迟至后续 PR
