### Task 4: Frontend — API 函数

**Files:**
- Modify: `frontend/src/services/api.ts` (添加新函数)

**Interfaces:**
- Produces: `getExchanges()`, `getProducts(exchange)`, `searchInstruments(exchange, product, keyword?)`, `getPresetInstruments()`, `getInstrumentsByIds(ids)`, `refreshPresetInstruments()`, `unsubscribeMarket(instruments)`

- [ ] **Step 1: Add API functions**

在 `frontend/src/services/api.ts` 的 `refreshInstruments` 函数后添加：

```typescript
// ── 合约搜索 API ────────────────────────────────────────────────────

interface ExchangesResponse {
  exchanges: string[]
}

interface ProductsResponse {
  products: string[]
}

interface PresetResponse {
  instruments: string[]
  updatedAt: string | null
}

/** 获取交易所列表 */
export async function getExchanges(): Promise<ExchangesResponse> {
  const { data } = await api.get<ExchangesResponse>('/api/market/instruments/exchanges')
  return data
}

/** 获取指定交易所下的品种列表 */
export async function getProducts(exchange: string): Promise<ProductsResponse> {
  const { data } = await api.get<ProductsResponse>('/api/market/instruments/products', {
    params: { exchange },
  })
  return data
}

/** 按交易所+品种搜索合约 */
export async function searchInstruments(
  exchange: string,
  product: string,
  keyword?: string
): Promise<InstrumentsResponse> {
  const params: Record<string, string> = { exchange, product }
  if (keyword) params.keyword = keyword
  const { data } = await api.get<InstrumentsResponse>('/api/market/instruments/search', { params })
  return data
}

/** 获取预设合约列表 */
export async function getPresetInstruments(): Promise<PresetResponse> {
  const { data } = await api.get<PresetResponse>('/api/market/preset')
  return data
}

/** 按 ID 列表批量获取合约详情 */
export async function getInstrumentsByIds(ids: string[]): Promise<InstrumentsResponse> {
  const { data } = await api.get<InstrumentsResponse>('/api/market/instruments', {
    params: { ids: ids.join(',') },
  })
  return data
}

/** 刷新预设合约（自动检测主力合约） */
export async function refreshPresetInstruments(): Promise<{ success: boolean; instruments: string[] }> {
  const { data } = await api.post<{ success: boolean; instruments: string[] }>('/api/market/preset/refresh')
  return data
}

// ── 退订 API ────────────────────────────────────────────────────────

interface UnsubscribeResponse {
  success: boolean
  removed: number
}

/** 退订行情 */
export async function unsubscribeMarket(instruments: string[]): Promise<UnsubscribeResponse> {
  const { data } = await api.post<UnsubscribeResponse>('/api/market/unsubscribe', { instruments })
  return data
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(task-14): 新增合约搜索/预设/退订 API 函数"
```

---

