# Task 4 Report: 共享行情基础设施上移 App

## 1. Status

DONE

## 2. Commits made

- `2f74460` refactor(market): 共享行情 WS/订阅管理器/合约加载上移到 App，支持双面板单例

## 3. Test result

- `npx vitest run src/App.test.tsx src/modules/market/MarketPanel.test.tsx` → **28 passed** (App 13, MarketPanel 15)
- Full suite `npx vitest run` → **100 files / 1174 tests passed**
- `npx tsc --noEmit` → clean (no output)

## 4. Self-review notes

- **App.test.tsx**: File did NOT previously mock `useMarketWs`/`useSubscriptionManager`. Added module-level `vi.mock` for both hooks + a new dedicated `describe` block asserting each is called exactly once (with `ws://localhost:8000` arg for `useMarketWs`). Added `vi.clearAllMocks()` inside the new test BEFORE `render` because App.test.tsx's existing `beforeEach` does not clear mocks — without it, call counts accumulate across earlier `render(<App />)` tests and `toHaveBeenCalledTimes(1)` would fail. Also spy-asserted `loadAllInstruments`/`loadFavoriteContracts` called once (the loading behavior that moved out of MarketPanel).
- **MarketPanel.tsx**: Removed `useMarketWs`, `useSubscriptionManager`, `API_BASE` imports, `useRef` (only used by `loadedRef`), `loadedRef`, the `useSubscriptionManager()` call, the `useMarketWs(...)` call, and the mount loading effect. Removed `loadAllInstruments`/`loadFavoriteContracts` from the `useContractsStore()` destructure. Kept `useMarketStore`/`useContractsStore` snapshots, toolbar/table/context-menu/order logic intact.
- **MarketPanel.test.tsx**: Removed the two mount-behavior tests (loadAllInstruments/loadFavoriteContracts on mount; useMarketWs called with `ws://localhost:8000`) and the now-dead `vi.mock('@/hooks/useMarketWs', ...)` + `mockUseMarketWs`. The defensive `vi.spyOn(loadAllInstruments/loadFavoriteContracts)` calls in `setupContracts`/`setupMixedContracts`/search test were left in place — harmless, and minimal churn. The `useContractsStore` import stays used (store state is set in those helpers).
- App still calls `useTabContractLocks()` which touches the market store — no conflict with the new hooks; all three coexist.

## 5. Concerns

None. One observation for downstream tasks: `useMarketWs`'s `globalWs` module-level singleton is created from the FIRST `useMarketWs()` invocation in the app (now App at startup). The unit test for `useMarketWs` (`useMarketWs.test.ts`) relies on `resetGlobalWs()`; App-level tests mock the hook, so no cross-test pollution.
