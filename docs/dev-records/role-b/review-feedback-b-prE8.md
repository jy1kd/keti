# PR-E8 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-31
**审查范围**：PR-E8 commit `78ac05c` vs PR-E7 final `c512894`（1 commit, 3 files, +212）
**PR内容**：原生通知实现

---

## 审查结论

**🟡 需修复后通过** — 1 个阻断性问题，1 个改进建议。

---

## 改动概览

| 文件 | 类型 | 说明 |
|------|------|------|
| `electron/notificationManager.ts` | 新增 | NotificationManager 类（141 行）：原生通知、报单/止损/连接通知 |
| `electron/__tests__/notificationManager.test.ts` | 新增 | 测试（58 行，6 个用例） |
| `electron/main.ts` | 更新 | 集成 NotificationManager + will-quit 清理 |

---

## ✅ 正面评价

1. **通知类型丰富**：`show`（通用）、`showOrderNotification`（报单）、`showStopOrderNotification`（止损）、`showConnectionNotification`（连接）
2. **`Notification.isSupported()` 检查**：在 `show()` 中先检查平台支持
3. **通知生命周期管理**：`notifications` 数组跟踪，`on('close')` 自动清理，`closeAll()` 批量关闭
4. **`onClick` 回调支持**：通知点击可绑定自定义处理函数
5. **状态文本映射**：`getOrderStatusText` / `getStopOrderStatusText` 将 CTP 编码转为中文
6. **main.ts 集成干净**：`will-quit` 中 `closeAll()` 清理

---

## 🔴 阻断性问题

### F1: `getStopOrderStatusText` 返回类型错误

**文件**：`frontend/electron/notificationManager.ts:127-135`

```typescript
private getStopOrderStatusText(status: string): void {  // ← 返回类型 void
  const statusMap: Record<string, string> = {
    'pending': '待触发',
    'triggered': '已触发',
    'trigger_failed': '触发失败',
    'canceled': '已取消',
  };
  return statusMap[status] || status;  // ← 返回 string，与 void 矛盾
}
```

**问题**：
1. 函数声明返回 `void`，但实际返回 `string`
2. TypeScript 编译器不会报错（`void` 函数允许 `return` 值，只是忽略），但语义错误
3. 调用处 `showStopOrderNotification` 使用 `${statusText}` 模板字符串，运行时得到 `undefined`（void 返回值被忽略）

**影响**：止损单通知的 body 中状态文本始终显示为 `undefined`。

**建议修复**：
```typescript
private getStopOrderStatusText(status: string): string {  // ← 改为 string
```

---

## 🟡 改进建议

### I1: `NotificationOptions.type` 字段未使用

**文件**：`frontend/electron/notificationManager.ts:16-22` vs `44-48`

```typescript
export interface NotificationOptions {
  type?: NotificationType;  // 定义了
}

// 但 Notification 构造时未使用 type
const notification = new Notification({
  title: options.title,
  body: options.body,
  silent: options.silent ?? false,
  // type 缺失
});
```

**建议**：`type` 字段可用于：
- 设置通知图标（不同图标表示不同级别）
- 或在 `show()` 中根据 type 设置 `hasReply`/`urgency` 等
- 或从接口中移除，避免误导

---

## 验收标准核对

| 标准 | 状态 | 说明 |
|------|------|------|
| 报单成交时显示通知 | ✅ | `showOrderNotification(orderRef, instrumentID, status)` |
| 止损触发时显示通知 | ⚠️ | `showStopOrderNotification` 有返回类型 bug，状态文本显示 `undefined` |
| 连接断开时显示通知 | ✅ | `showConnectionNotification(connected, message?)` |
| 点击通知能打开对应窗口 | ⚠️ | `onClick` 回调已支持，但 main.ts 中未绑定实际处理函数 |

---

## 测试状态

- `notificationManager.test.ts`：6 个用例通过 ✅（均为接口存在性检查）

---

## 总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 阻断 | 1 | `getStopOrderStatusText` 返回 void 导致止损通知状态文本为 undefined |
| 🟡 建议 | 1 | `NotificationOptions.type` 字段未使用 |
