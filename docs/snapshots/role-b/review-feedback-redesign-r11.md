# PR-R11 审查反馈

| 项目 | 内容 |
|------|------|
| **PR** | PR-R11: App.tsx 重构：标签页布局 |
| **分支** | feature/redesign-r11-app-layout |
| **审查时间** | 2026-08-03 |
| **审查结论** | ✅ 通过（附 2 个🔵建议） |

---

## 审查范围

| 文件 | 改动 |
|------|------|
| `frontend/src/App.tsx` | 移除三栏布局，替换为 TabBar + TabContent |
| `frontend/src/App.test.tsx` | 重写测试匹配新布局 |
| `frontend/src/assets/styles/global.css` | 添加 `.tab-main` 样式 |
| `docs/tasks/task-redesign.md` | 更新 PR-R11 状态 |

---

## 发现问题

### 🔵-1: Ctrl+Shift+M 测试无断言

**文件**: `App.test.tsx:84-88`

```tsx
it('Ctrl+Shift+M 切换性能监控', () => {
  render(<App />)
  fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
  // 性能监控应该显示  ← 注释说"应该显示"但没有 assert
})
```

**问题**: 测试触发了快捷键但没有验证结果。注释写"应该显示"，实际无断言。

**建议**: 添加断言验证 PerfMonitor 可见性，例如：
```tsx
// 触发后 FPS 按钮样式应变化（perfVisible=true 时背景色变化）
const fpsBtn = screen.getByText('⚡FPS').closest('button')
expect(fpsBtn).toHaveStyle({ background: 'rgba(63,185,80,0.12)' })
```

---

### 🔵-2: 设置面板断言过于宽泛

**文件**: `App.test.tsx:69-75`

```tsx
it('点击设置按钮打开设置面板', () => {
  render(<App />)
  const settingsBtn = screen.getByTitle('设置')
  fireEvent.click(settingsBtn)
  // 设置面板应该显示
  expect(screen.getByText(/设置/)).toBeInTheDocument()
})
```

**问题**: `getByText(/设置/)` 正则匹配范围过宽。按钮本身文字是 "⚙"（不含"设置"），但 `title="设置"` 属性和面板内容都可能匹配。无法区分按钮和面板。

**建议**: 使用更精确的选择器，例如检查 settings-overlay 是否存在：
```tsx
expect(document.querySelector('.settings-overlay')).toBeInTheDocument()
```

---

## 改进建议（不阻塞）

### 🧹 死代码清理

`global.css` 中 `.main-content`（208-212行）和 `.query-area` 等旧布局样式已无组件引用，可在后续 PR 中清理。

---

## 审查结论

**✅ 通过**

PR-R11 实现了从三栏布局到标签页布局的核心切换：
- ✅ 移除 react-resizable-panels 三栏布局
- ✅ 集成 TabBar + TabContent 组件
- ✅ 保留状态栏（ConnectionStatus、MD/TD）
- ✅ 保留设置面板
- ✅ 测试全部通过

🔵-1 和 🔵-2 为测试质量改进建议，可修复或记录理由跳过。
