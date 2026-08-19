# Task 3 Review — OptionChainGroup 组件

## SPEC: ✅
All brief requirements met, nothing extra.

- Default collapsed: `expanded` init `false`, T 表 only mounted when `expanded && activeChain` — no T 表 while collapsed. ✅
- Header red-bold (`RED_BOLD` `#f87171` bold 14), ▼/▶ arrow, ⇗ 新窗 button calls `openTQuoteFloating(group.underlyingID)` with `e.stopPropagation()` (does NOT toggle). ✅
- On expand: `getOptionChains`, sort by `expireDate` asc, default earliest; expire toggle bar rendered when expanded. ✅
- On active chain selected: `addLockedContract` for all C/P instrumentIDs + `getSnapshots(ids)`; cleanup `removeLockedContract` on collapse/expire change/unmount. ✅
- Index options: `group.underlying` undefined → `underlyingLabel = group.underlyingID`; never subscribes synthetic header. ✅ (synthetic header id is never passed to addLockedContract — only C/P ids from the chain, per brief)
- Did NOT modify MarketPanel or TQuoteView. ✅ (commit touches only the 2 new files)
- Test data populated calls/puts (one each) so lock path is genuinely exercised; justified deviation from brief's empty arrays.

## QUALITY: Approved (Minor only)

**Critical:** 0
**Important:** 0
**Minor:** 4

### ⚠️ Items
1. **Minor — re-expand resets expiry to earliest every time** (`setExpireDate(sorted[0].expireDate)` runs on every `expanded` flip, even when chains already cached). Matches brief literal "default to earliest expireDate", but a prior user selection is lost on collapse/re-expand. Intended per brief; flagging only.
2. **Minor — duplicate `chains.find(...)`** in the lock effect (`chain`) and in render (`activeChain`). Harmless but redundant compute; could share. YAGNI-neutral.
3. **Minor — getSnapshots error swallowed** `.catch(() => {})`. Acceptable for "pre-pull" best-effort, but silent failure hides snapshot issues. Low risk.
4. **Minor — `useMarketStore()` selector pulls functions only** (no `lockedContracts` subscription), so component doesn't re-render on lock map changes. Correct here (no UI depends on it), but `addLockedContract`/`removeLockedContract` are stable store fns so effect deps are fine.

### Notes (not defects)
- Implementer report concern #3 ("index options still lock C/P ids") is CORRECT behavior per brief: the "never subscribe" rule applies only to the synthetic header id itself, not its option contracts. Implementation correctly never passes `group.underlyingID` to addLockedContract.
- Ref-counted `lockedContracts` Map — cleanup removes exactly the ids it added (ids captured in effect closure), so no leaked locks on unmount/expire change. Cleanup is sound.

## Recommendation
PASS as-is; the only behavior worth a product decision is ⚠️#1 (re-expand resetting expiry) — confirm it's intended before Task 4 integration.
