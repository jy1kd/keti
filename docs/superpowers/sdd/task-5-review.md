# Task 5 Review: InstrumentSearchModal

**Diff:** b987f92..d0e650b
**Files:** `frontend/src/components/InstrumentSearchModal/index.tsx`, `index.css`

---

## Spec Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Props: isOpen, onClose, onSubscribe, subscribedIds | ✅ | Exact match |
| Uses getExchanges, getProducts, searchInstruments, subscribeMarket | ✅ | All four imported and used |
| Exchange → Product cascade | ✅ | selectedExchange triggers getProducts, resets product/instruments |
| Product → Instrument cascade | ✅ | selectedProduct triggers searchInstruments |
| Keyword search (Enter key) | ✅ | handleKeywordKeyDown on Enter |
| Subscribe button + already-subscribed badge | ✅ | subscribedIds.has() check |
| Loading / error / empty states | ✅ | All three handled |
| Modal overlay click closes | ✅ | stopPropagation on content |
| CSS uses project CSS variables | ✅ | --bg-primary, --border-color, --text-primary, --text-secondary, --accent-color, --bg-hover with fallbacks |
| TypeScript compiles | ✅ | No new errors (pre-existing order/store errors unrelated) |

**Spec: ✅**

---

## Issues

### Issue 1: Missing useEffect cleanup — RESOLVED ✅

All three useEffects now use the `ignore` flag pattern:

- **Effect 1 (exchanges, line 24-31):** `let ignore = false` guards `.then()` and `.catch()`, cleanup sets `ignore = true`.
- **Effect 2 (products, line 34-52):** Same pattern, guards the multi-setter `.then()` block.
- **Effect 3 (instruments, line 66-70):** Passes `() => ignore` as `onCleanup` callback to `loadInstruments`, which checks it before every `.then()`, `.catch()`, and `.finally()`.

The `loadInstruments` function also accepts an optional `onCleanup` parameter (line 55), allowing the effect to inject the guard while user-initiated calls (button click line 133, Enter key line 75) remain unguarded — correct since those don't need cleanup protection.

### Issue 2: eslint-disable-line suppresses real warning (Low, unchanged)

Line 70: `// eslint-disable-line react-hooks/exhaustive-deps` — `loadInstruments` is called inside the effect but not listed in the dependency array. The eslint rule is correct; the dependency should be listed or the effect restructured. Since `loadInstruments` is a `useCallback` whose own deps (`selectedExchange`, `selectedProduct`) are already the effect's deps, listing it would be redundant but formally correct.

### Issue 3: No state reset on modal close (Low, unchanged)

When `isOpen` becomes false, the component returns `null` but retains stale `exchanges`, `products`, `instruments` state. On next open, the exchanges effect re-fetches, but there's a brief moment where stale data is visible. Consider resetting state when `isOpen` becomes false, or fetching only if state is empty.

---

## Code Quality Notes

- CSS fallback values are reasonable and consistent with other components (order/styles.css, market/styles.css use the same variables).
- The `&times;` HTML entity for the close button renders correctly in JSX.
- The component is a clean functional component with hooks, no class patterns.
- Table uses sticky header (`position: sticky; top: 0`) — good for scrollable lists.

---

## Verdict

**Task quality: Approved** — The medium issue (useEffect cleanup) has been correctly resolved. All three effects now guard against post-unmount setState. The remaining two issues are low severity and can be addressed in a follow-up if desired.
