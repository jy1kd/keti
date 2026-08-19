# Settings & Order-Trigger Refactoring Design

**Date:** 2026-08-19

## Context

The settings page references several features that are now offline or broken, and needs a new capability.

### Problems found

1. **一键反向 (reverse) / 一键锁仓 (lock)** — offline. The hotkey panel still shows them; the ShotcutTrade (快捷交易) tab exists solely to configure them.
2. **打开报单/打开K线/打开设置 (openOrder/openKline/openSettings)** — configurable in the panel but **no callback is wired** → they never fire.
3. **买入/卖出 (buy/sell)** — only set the order-form direction, misleading labels; user wants them removed.
4. **批量撤单 (batchCancel)** — valid & effective (Escape opens the OrderPanel batch-cancel dialog). **Keep.**
5. **撤单 (cancel)** — toast "please use query panel"; not a real action. Remove.

### New capability wanted

The order-entry ladders (五档下单 / 无限下单) currently always fire **single-click + mandatory confirm dialog**. Make this a user setting:

- **Trigger mode**: `single` (单频) or `double` (控频)
- **Confirm before order**: on/off

Applied only to the **depth ladder cells** (MarketDepth 十档, InfiniteLadder 阶梯), shared across both. QuickTradeBar stays unchanged (single-click + confirm).

## Decisions

- **Hotkeys**: keep `batchCancel`, `openOrder`, `openKline`, `openSettings` (4 real functions, `openOrder/openKline/openSettings` now wired to open floating windows at App layer). Remove `buy/sell/cancel/reverse/lock`.
- **Settings page**: keep **Tab** structure — `快捷键` tab + `下单触发` tab. Delete the old 快捷交易 (QuickTrade) tab/QuickTradeTab.
- **Order-trigger settings**: shared single config for both ladders; default = current behavior (`triggerMode: 'single'`, `confirmBeforeOrder: true`).
- **Store**: remove `quickTradeConfig` state + `DEFAULT_QUICK_TRADE_CONFIG` (the offline features it served). Keep the `QuickTradeConfig` *type* (used by OrderPanel/API). Add new `orderTrigger` state.

## New Types (services/types.ts)

```typescript
/** 盘口下单触发设置（五档/无限下单共用） */
export interface OrderTriggerConfig {
  /** 触发方式：单击（单击即触发）/ 双击（单击预览、双击触发） */
  triggerMode: 'single' | 'double'
  /** 是否二次确认：true=触发后弹确认框；false=触发后直接下单 */
  confirmBeforeOrder: boolean
}
```

`HotKeyConfig` becomes 4 fields:

```typescript
export interface HotKeyConfig {
  /** 打开报单（浮动窗） */
  openOrder: string    // default 'o'
  /** 打开K线（浮动窗） */
  openKline: string    // default 'k'
  /** 打开设置（浮动窗） */
  openSettings: string // default ','
  /** 批量撤单 */
  batchCancel: string  // default 'Escape'
}
```

`DEFAULT_ORDER_TRIGGER = { triggerMode: 'single', confirmBeforeOrder: true }`
`DEFAULT_HOT_KEYS = { openOrder: 'o', openKline: 'k', openSettings: ',', batchCancel: 'Escape' }`

## Interaction Matrix

| triggerMode | confirmBeforeOrder | 单击 | 双击 |
|-------------|--------------------|------|------|
| single      | true (default)     | 弹确认框 → 下单 | — (double-click ignored/acts as single) |
| single      | false              | 直接下单 | — |
| double      | true               | 预览高亮 | 弹确认框 → 下单 |
| double      | false              | 预览高亮 | 直接下单 |

## Architecture

### Two useHotKeys instances
- **App layer** — new `useHotKeys` handling `openOrder/openKline/openSettings` → `openOrderFloating()/openKlineFloating()/openSettingsFloating()`.
- **OrderPanel layer** — existing `useHotKeys`, now handling **only** `batchCancel`. Remove `onBuy/onSell/onCancelAll/onReverse/onLock`.
- Each instance maps a disjoint action set → no key conflicts.

`useHotKeys` hook: remove the now-dead `onBuy/onSell/onCancelAll/onReverse/onLock` from the action map & input props.

### Order-trigger wiring (shared)
A small hook `useOrderTrigger()` reads `useUserPrefsStore((s) => s.orderTrigger)`. Used by:
- `MarketDepth.tsx` (十档 buy/sell cells)
- `InfiniteLadder.tsx` (ladder bid/ask cells)

Behavior:
- **single**: cell click → `openIntent(...)`; then if `confirmBeforeOrder` → set intent (existing confirm dialog path); else → submit immediately.
- **double**: first click → set a "preview" highlight only (no intent, no dialog); second click within timeout → `openIntent(...)` then confirm-or-submit per `confirmBeforeOrder`.

For "submit immediately" (免确认 direct order), both components get a path that calls `submitOrder`/`submitOrder(intent)` directly (skip the `ConfirmDialog`).

Preview highlight in double mode: visual selected cell state (class styling), cleared on timeout or when another cell is clicked.

## File Changes

| File | Change |
|------|--------|
| `services/types.ts` | Add `OrderTriggerConfig`. Slim `HotKeyConfig` to 4 fields. Keep `QuickTradeConfig`. |
| `stores/userPrefs.ts` | `DEFAULT_HOT_KEYS` → 4 keys. Add `DEFAULT_ORDER_TRIGGER`, `orderTrigger` state + `setOrderTrigger` action + persist. Remove `quickTradeConfig`/`DEFAULT_QUICK_TRADE_CONFIG`/`setQuickTrade`. |
| `hooks/useHotKeys.ts` | Remove `buy/sell/cancel/reverse/lock` from action map & props. |
| `hooks/useOrderTrigger.ts` | **New** — read `orderTrigger` from store. |
| `components/SettingsPanel/HotKeyTab.tsx` | LABELS → 4 entries. |
| `components/SettingsPanel/OrderTriggerTab.tsx` | **New** — dropdown/mode for triggerMode + checkbox for confirm; defaults + save. |
| `components/SettingsPanel/QuickTradeTab.tsx` | **Delete**. |
| `pages/SettingsPage.tsx` | Keep tab UI: 快捷键 / 下单触发. Remove 快捷交易 tab. |
| `components/SettingsPanel/index.tsx` | Same tab changes; keep close button. |
| `App.tsx` | Add `useHotKeys` for openOrder/openKline/openSettings → floating openers. |
| `modules/order/OrderPanel.tsx` | useHotKeys: keep only `onBatchCancel`. |
| `modules/order/MarketDepth.tsx` | Apply `orderTrigger` to depth cell clicks (single/double + direct submit path). |
| `modules/infinite/InfiniteLadder.tsx` | Apply `orderTrigger` to ladder cell clicks. |
| Tests | Update `SettingsPage.test`, `SettingsPanel/index.test`, `useHotKeys.test`, `userPrefs.test`; add `OrderTriggerTab.test`, extend `MarketDepth.test`/`InfiniteLadder.test` for new trigger logic. |

## Not in scope (future)
- OrderPanel/QuickActions reverse-lock buttons.
- `reversePosition`/`lockPosition` in `api.ts`.
- Backend cleanup.
- MarketDepth "price column click → fills edit box" (unchanged).
- QuickTradeBar (stays single-click + confirm).

## Testing
- Hotkey defaults (o/k/,/Escape) call correct openers; OrderPanel batchCancel still fires; no cross-key conflicts.
- OrderTriggerTab renders single/double + confirm toggle, default value, save persists.
- MarketDepth/InfiniteLadder: single+confirm → dialog; single+free → direct submit; double+confirm → preview on first click, dialog on double; double+free → preview then direct submit on double; single-click in double mode does not order.
- Full suite passes.
