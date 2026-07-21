# 合约搜索与订阅功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现合约搜索、订阅、退订功能，仿照无限易的交易所+品种二级筛选方案

**Architecture:** 后端内存缓存筛选 + 前端模态框交互 + localStorage 持久化订阅列表

**Tech Stack:** Python FastAPI, TypeScript React, Zustand, @visactor/vtable

## Global Constraints

- 合约数据来源：`MarketService._instruments`（内存缓存，启动时从 `instruments.json` 加载）
- CTP 订阅上限：500 合约（`MarketService.MAX_SUBSCRIPTIONS`）
- 前端持久化：`localStorage` key `simnow-user-prefs`
- 字段命名：后端 camelCase，与 CTP 回调数据一致
- 测试框架：后端 pytest + httpx AsyncClient，前端 vitest

---

### Task 1: Backend — MarketService 新增筛选方法

**Files:**
- Modify: `server/services/market_service.py` (在 `get_instruments` 方法后添加)
- Test: `server/tests/test_market_service.py` (新增测试类)

**Interfaces:**
- Produces: `get_exchanges() -> List[str]`, `get_products(exchange) -> List[str]`, `search_instruments(exchange, product, keyword=None) -> List[dict]`, `get_instruments_by_ids(ids) -> List[dict]`

- [ ] **Step 1: Write failing tests for get_exchanges**

在 `server/tests/test_market_service.py` 末尾添加：

```python
# ── Instrument search (筛选) ─────────────────────────────────────────

class TestInstrumentSearch:
    """get_exchanges, get_products, search_instruments, get_instruments_by_ids."""

    SAMPLE = [
        {"instrumentID": "IF2608", "instrumentName": "沪深300", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260821", "isTrading": 1},
        {"instrumentID": "IF2609", "instrumentName": "沪深300", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260918", "isTrading": 1},
        {"instrumentID": "IC2608", "instrumentName": "中证500", "exchangeID": "CFFEX", "productID": "IC", "expireDate": "20260821", "isTrading": 1},
        {"instrumentID": "au2608", "instrumentName": "黄金", "exchangeID": "SHFE", "productID": "au", "expireDate": "20260815", "isTrading": 1},
        {"instrumentID": "cu2608", "instrumentName": "铜", "exchangeID": "SHFE", "productID": "cu", "expireDate": "20260815", "isTrading": 0},
    ]

    def test_get_exchanges_returns_unique_list(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.get_exchanges()
        assert set(result) == {"CFFEX", "SHFE"}

    def test_get_exchanges_empty_when_no_data(self):
        svc = MarketService()
        assert svc.get_exchanges() == []

    def test_get_products_returns_filtered_list(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.get_products("CFFEX")
        assert set(result) == {"IF", "IC"}

    def test_get_products_empty_exchange(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        assert svc.get_products("ZZZZZ") == []

    def test_search_instruments_by_exchange_and_product(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.search_instruments("CFFEX", "IF")
        assert len(result) == 2
        ids = {r["instrumentID"] for r in result}
        assert ids == {"IF2608", "IF2609"}

    def test_search_instruments_with_keyword(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.search_instruments("CFFEX", "IF", keyword="2608")
        assert len(result) == 1
        assert result[0]["instrumentID"] == "IF2608"

    def test_search_instruments_no_match(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.search_instruments("SHFE", "IF")
        assert result == []

    def test_search_instruments_returns_all_fields(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.search_instruments("CFFEX", "IF")
        inst = result[0]
        assert "instrumentID" in inst
        assert "expireDate" in inst
        assert "isTrading" in inst

    def test_get_instruments_by_ids(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.get_instruments_by_ids(["IF2608", "au2608"])
        assert len(result) == 2
        ids = {r["instrumentID"] for r in result}
        assert ids == {"IF2608", "au2608"}

    def test_get_instruments_by_ids_partial_match(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        result = svc.get_instruments_by_ids(["IF2608", "ZZZZZ"])
        assert len(result) == 1
        assert result[0]["instrumentID"] == "IF2608"

    def test_get_instruments_by_ids_empty(self):
        svc = MarketService()
        svc.load_instruments(self.SAMPLE)
        assert svc.get_instruments_by_ids([]) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && python -m pytest tests/test_market_service.py::TestInstrumentSearch -v`
Expected: FAIL (methods don't exist)

- [ ] **Step 3: Implement methods in MarketService**

在 `server/services/market_service.py` 的 `get_instruments` 方法后添加：

```python
    def get_exchanges(self) -> List[str]:
        """Return deduplicated list of exchange IDs."""
        return sorted({inst.get("exchangeID", "") for inst in self._instruments if inst.get("exchangeID")})

    def get_products(self, exchange: str) -> List[str]:
        """Return product IDs for a given exchange."""
        return sorted({
            inst.get("productID", "")
            for inst in self._instruments
            if inst.get("exchangeID") == exchange and inst.get("productID")
        })

    def search_instruments(
        self, exchange: str, product: str, keyword: str = None
    ) -> List[dict]:
        """Filter instruments by exchange + product, with optional keyword."""
        results = [
            inst for inst in self._instruments
            if inst.get("exchangeID") == exchange and inst.get("productID") == product
        ]
        if keyword:
            kw = keyword.lower()
            results = [
                inst for inst in results
                if kw in str(inst.get("instrumentID", "")).lower()
                or kw in str(inst.get("instrumentName", "")).lower()
            ]
        return results

    def get_instruments_by_ids(self, ids: List[str]) -> List[dict]:
        """Return instruments matching the given IDs."""
        if not ids:
            return []
        id_set = set(ids)
        return [inst for inst in self._instruments if inst.get("instrumentID") in id_set]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && python -m pytest tests/test_market_service.py::TestInstrumentSearch -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/market_service.py server/tests/test_market_service.py
git commit -m "feat(task-12): MarketService 新增 get_exchanges/get_products/search_instruments/get_instruments_by_ids"
```

---

### Task 2: Backend — Market API 新增筛选端点

**Files:**
- Modify: `server/api/market.py` (在 `/instruments` 端点后添加)
- Modify: `server/tests/test_market_api.py` (新增测试类)

**Interfaces:**
- Consumes: `MarketService.get_exchanges()`, `MarketService.get_products()`, `MarketService.search_instruments()`, `MarketService.get_instruments_by_ids()`
- Produces: `GET /api/market/instruments/exchanges`, `GET /api/market/instruments/products`, `GET /api/market/instruments/search`, 扩展 `GET /api/market/instruments?ids=`

- [ ] **Step 1: Write failing tests**

在 `server/tests/test_market_api.py` 的 `TestGetInstruments` 类后添加：

```python
# ── Instrument search endpoints ──────────────────────────────────────

class TestGetExchanges:
    """GET /api/market/instruments/exchanges"""

    @pytest.mark.asyncio
    async def test_returns_exchanges(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/exchanges")
        assert resp.status_code == 200
        data = resp.json()
        assert set(data["exchanges"]) == {"CFFEX", "SHFE"}


class TestGetProducts:
    """GET /api/market/instruments/products"""

    @pytest.mark.asyncio
    async def test_returns_products_for_exchange(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/products", params={"exchange": "CFFEX"})
        assert resp.status_code == 200
        data = resp.json()
        assert "IF" in data["products"]

    @pytest.mark.asyncio
    async def test_missing_exchange_returns_422(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/products")
        assert resp.status_code == 422


class TestSearchInstruments:
    """GET /api/market/instruments/search"""

    @pytest.mark.asyncio
    async def test_search_by_exchange_and_product(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/search", params={"exchange": "CFFEX", "product": "IF"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2

    @pytest.mark.asyncio
    async def test_search_with_keyword(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/search", params={"exchange": "CFFEX", "product": "IF", "keyword": "2608"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["instruments"][0]["instrumentID"] == "IF2608"

    @pytest.mark.asyncio
    async def test_missing_params_returns_422(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/search")
        assert resp.status_code == 422


class TestGetInstrumentsByIds:
    """GET /api/market/instruments?ids=X,Y,Z"""

    @pytest.mark.asyncio
    async def test_returns_matching_instruments(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments", params={"ids": "IF2608,au2608"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        ids = {inst["instrumentID"] for inst in data["instruments"]}
        assert ids == {"IF2608", "au2608"}

    @pytest.mark.asyncio
    async def test_ids_empty_string_returns_all(self, app):
        """Without ids param, returns all instruments (existing behavior)."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && python -m pytest tests/test_market_api.py::TestGetExchanges tests/test_market_api.py::TestGetProducts tests/test_market_api.py::TestSearchInstruments tests/test_market_api.py::TestGetInstrumentsByIds -v`
Expected: FAIL (endpoints don't exist)

- [ ] **Step 3: Implement endpoints**

在 `server/api/market.py` 的 `/instruments` 端点后、`/subscribe` 端点前添加：

```python
@router.get("/instruments/exchanges")
async def get_exchanges(request: Request):
    """Return deduplicated list of exchange IDs."""
    svc = _get_service(request)
    return {"exchanges": svc.get_exchanges()}


@router.get("/instruments/products")
async def get_products(request: Request, exchange: str = Query(..., min_length=1)):
    """Return product IDs for a given exchange."""
    svc = _get_service(request)
    return {"products": svc.get_products(exchange)}


@router.get("/instruments/search")
async def search_instruments(
    request: Request,
    exchange: str = Query(..., min_length=1),
    product: str = Query(..., min_length=1),
    keyword: str = Query(""),
):
    """Search instruments by exchange + product, with optional keyword filter."""
    svc = _get_service(request)
    instruments = svc.search_instruments(exchange, product, keyword=keyword or None)
    return {"instruments": instruments, "count": len(instruments)}
```

然后修改现有的 `/instruments` 端点，添加 `ids` 参数支持：

```python
@router.get("/instruments")
async def get_instruments(request: Request, keyword: str = "", ids: str = ""):
    """Query contract list.

    Supports two modes:
    - ids: comma-separated instrument IDs (batch lookup)
    - keyword: fuzzy search across instrumentID, instrumentName, exchangeID, productID
    """
    svc = _get_service(request)
    if ids:
        id_list = [i.strip() for i in ids.split(",") if i.strip()]
        instruments = svc.get_instruments_by_ids(id_list)
    else:
        instruments = svc.get_instruments(keyword=keyword)
    return {"instruments": instruments, "count": len(instruments)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && python -m pytest tests/test_market_api.py -v -k "Exchanges or Products or SearchInstruments or GetByIds"`
Expected: PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `cd server && python -m pytest tests/test_market_api.py tests/test_market_service.py -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/api/market.py server/tests/test_market_api.py
git commit -m "feat(task-12): 新增 /exchanges, /products, /search 端点 + /instruments?ids= 支持"
```

---

### Task 3: Backend — 预设合约功能

**Files:**
- Create: `server/data/preset_instruments.json`
- Modify: `server/services/market_service.py` (新增方法)
- Modify: `server/api/market.py` (新增端点)
- Modify: `server/tests/test_market_service.py` (新增测试)
- Modify: `server/tests/test_market_api.py` (新增测试)

**Interfaces:**
- Produces: `GET /api/market/preset`, `POST /api/market/preset/refresh`
- Produces: `MarketService.get_preset_instruments()`, `MarketService.refresh_preset_instruments()`

- [ ] **Step 1: Create preset_instruments.json**

```json
{
  "instruments": [],
  "updatedAt": null
}
```

- [ ] **Step 2: Write failing tests for preset service methods**

在 `server/tests/test_market_service.py` 末尾添加：

```python
# ── Preset instruments ───────────────────────────────────────────────

class TestPresetInstruments:
    """get_preset_instruments and refresh_preset_instruments."""

    def test_get_preset_returns_empty_initially(self):
        svc = MarketService()
        result = svc.get_preset_instruments()
        assert result["instruments"] == []

    def test_refresh_preset_detects_front_month(self):
        svc = MarketService()
        svc.load_instruments([
            {"instrumentID": "IF2608", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260821", "isTrading": 1},
            {"instrumentID": "IF2609", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260918", "isTrading": 1},
            {"instrumentID": "au2608", "exchangeID": "SHFE", "productID": "au", "expireDate": "20260815", "isTrading": 1},
        ])
        result = svc.refresh_preset_instruments()
        assert result["success"] is True
        # IF2608 expires sooner, au2608 is the only au
        assert set(result["instruments"]) == {"IF2608", "au2608"}

    def test_refresh_preset_skips_non_trading(self):
        svc = MarketService()
        svc.load_instruments([
            {"instrumentID": "IF2608", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260821", "isTrading": 0},
            {"instrumentID": "IF2609", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260918", "isTrading": 1},
        ])
        result = svc.refresh_preset_instruments()
        assert "IF2608" not in result["instruments"]
        assert "IF2609" in result["instruments"]

    def test_refresh_preset_saves_to_file(self):
        import tempfile, os
        svc = MarketService()
        svc.load_instruments([
            {"instrumentID": "IF2608", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260821", "isTrading": 1},
        ])
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            tmp_path = f.name
        try:
            result = svc.refresh_preset_instruments(file_path=tmp_path)
            assert result["success"] is True
            import json
            with open(tmp_path, "r") as f:
                saved = json.load(f)
            assert "IF2608" in saved["instruments"]
        finally:
            os.unlink(tmp_path)
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && python -m pytest tests/test_market_service.py::TestPresetInstruments -v`
Expected: FAIL

- [ ] **Step 4: Implement preset methods in MarketService**

在 `server/services/market_service.py` 的 `get_instruments_by_ids` 方法后添加：

```python
    def get_preset_instruments(self) -> dict:
        """Read preset instruments from config file."""
        file_path = str(Path(__file__).parent.parent / "data" / "preset_instruments.json")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"instruments": data.get("instruments", []), "updatedAt": data.get("updatedAt")}
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return {"instruments": [], "updatedAt": None}

    def refresh_preset_instruments(self, file_path: str = "") -> dict:
        """Auto-detect front-month contracts per product and save preset list.

        Logic: group by productID, filter isTrading==1, pick nearest expireDate.
        """
        from datetime import datetime
        from collections import defaultdict

        if not file_path:
            file_path = str(Path(__file__).parent.parent / "data" / "preset_instruments.json")

        # Group trading instruments by productID
        by_product: Dict[str, List[dict]] = defaultdict(list)
        for inst in self._instruments:
            if inst.get("isTrading") == 1 and inst.get("productID"):
                by_product[inst["productID"]].append(inst)

        # Pick front-month (nearest expireDate) per product
        today = datetime.now().strftime("%Y%m%d")
        preset: List[str] = []
        for product, instruments in by_product.items():
            # Filter to future or current expiries
            valid = [i for i in instruments if i.get("expireDate", "99999999") >= today]
            if not valid:
                valid = instruments  # fallback: use all if none are future
            valid.sort(key=lambda i: i.get("expireDate", "99999999"))
            preset.append(valid[0]["instrumentID"])

        preset.sort()

        # Save to file
        import json as json_mod
        from datetime import datetime as dt
        data = {"instruments": preset, "updatedAt": dt.now().isoformat()}
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json_mod.dump(data, f, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.warning("Failed to save preset to %s: %s", file_path, exc)
            return {"success": False, "message": str(exc)}

        return {"success": True, "instruments": preset}
```

注意：需要在文件顶部添加 `from pathlib import Path`（如果还没有的话）。

- [ ] **Step 5: Run preset service tests**

Run: `cd server && python -m pytest tests/test_market_service.py::TestPresetInstruments -v`
Expected: PASS

- [ ] **Step 6: Write failing tests for preset API endpoints**

在 `server/tests/test_market_api.py` 末尾添加：

```python
# ── Preset endpoints ─────────────────────────────────────────────────

class TestPreset:
    """GET /api/market/preset and POST /api/market/preset/refresh"""

    @pytest.mark.asyncio
    async def test_get_preset_returns_empty_initially(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/preset")
        assert resp.status_code == 200
        data = resp.json()
        assert "instruments" in data

    @pytest.mark.asyncio
    async def test_refresh_preset(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/preset/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["instruments"], list)
```

- [ ] **Step 7: Implement preset API endpoints**

在 `server/api/market.py` 的 `search_instruments` 端点后添加：

```python
@router.get("/preset")
async def get_preset(request: Request):
    """Return preset instrument list."""
    svc = _get_service(request)
    return svc.get_preset_instruments()


@router.post("/preset/refresh")
async def refresh_preset(request: Request):
    """Auto-detect front-month contracts and update preset list."""
    svc = _get_service(request)
    result = svc.refresh_preset_instruments()
    return result
```

- [ ] **Step 8: Run all tests**

Run: `cd server && python -m pytest tests/test_market_api.py tests/test_market_service.py -v`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add server/data/preset_instruments.json server/services/market_service.py server/api/market.py server/tests/test_market_service.py server/tests/test_market_api.py
git commit -m "feat(task-13): 预设合约 — 自动检测主力合约 + preset API 端点"
```

---

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

### Task 5: Frontend — InstrumentSearchModal 组件

**Files:**
- Create: `frontend/src/components/InstrumentSearchModal/index.tsx`
- Create: `frontend/src/components/InstrumentSearchModal/index.css`

**Interfaces:**
- Consumes: `getExchanges()`, `getProducts()`, `searchInstruments()`, `subscribeMarket()`
- Produces: `InstrumentSearchModal` React component

- [ ] **Step 1: Create the modal component**

```tsx
// frontend/src/components/InstrumentSearchModal/index.tsx
import { useState, useEffect, useCallback } from 'react'
import type { ContractInfo } from '@/services/types'
import { getExchanges, getProducts, searchInstruments, subscribeMarket } from '@/services/api'
import './index.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (instrument: ContractInfo) => void
  subscribedIds: Set<string>
}

export function InstrumentSearchModal({ isOpen, onClose, onSubscribe, subscribedIds }: Props) {
  const [exchanges, setExchanges] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [instruments, setInstruments] = useState<ContractInfo[]>([])
  const [selectedExchange, setSelectedExchange] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load exchanges on open
  useEffect(() => {
    if (!isOpen) return
    getExchanges()
      .then((res) => setExchanges(res.exchanges))
      .catch(() => setError('加载交易所列表失败'))
  }, [isOpen])

  // Load products when exchange changes
  useEffect(() => {
    if (!selectedExchange) {
      setProducts([])
      setSelectedProduct('')
      setInstruments([])
      return
    }
    getProducts(selectedExchange)
      .then((res) => {
        setProducts(res.products)
        setSelectedProduct('')
        setInstruments([])
      })
      .catch(() => setError('加载品种列表失败'))
  }, [selectedExchange])

  // Load instruments when product changes
  const loadInstruments = useCallback(() => {
    if (!selectedExchange || !selectedProduct) return
    setLoading(true)
    setError('')
    searchInstruments(selectedExchange, selectedProduct, keyword || undefined)
      .then((res) => setInstruments(res.instruments))
      .catch(() => setError('加载合约列表失败'))
      .finally(() => setLoading(false))
  }, [selectedExchange, selectedProduct, keyword])

  useEffect(() => {
    loadInstruments()
  }, [selectedExchange, selectedProduct])

  // Search on Enter key
  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadInstruments()
    }
  }

  const handleSubscribe = async (inst: ContractInfo) => {
    try {
      const result = await subscribeMarket([inst.instrumentID])
      if (result.success) {
        onSubscribe(inst)
      } else {
        setError('订阅失败')
      }
    } catch {
      setError('订阅请求失败')
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>合约搜索</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-filters">
          <select
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value)}
          >
            <option value="">选择交易所</option>
            {exchanges.map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>

          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={!selectedExchange}
          >
            <option value="">选择品种</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="搜索关键词..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            disabled={!selectedProduct}
          />

          <button onClick={loadInstruments} disabled={!selectedProduct || loading}>
            搜索
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-table-container">
          {loading ? (
            <div className="modal-loading">加载中...</div>
          ) : instruments.length === 0 ? (
            <div className="modal-empty">
              {selectedProduct ? '无匹配合约' : '请选择交易所和品种'}
            </div>
          ) : (
            <table className="modal-table">
              <thead>
                <tr>
                  <th>合约</th>
                  <th>名称</th>
                  <th>到期日</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((inst) => (
                  <tr key={inst.instrumentID}>
                    <td>{inst.instrumentID}</td>
                    <td>{inst.instrumentName}</td>
                    <td>{inst.expireDate}</td>
                    <td>{inst.isTrading ? '交易中' : '已停牌'}</td>
                    <td>
                      {subscribedIds.has(inst.instrumentID) ? (
                        <span className="subscribed-badge">已订阅</span>
                      ) : (
                        <button
                          className="btn-subscribe"
                          onClick={() => handleSubscribe(inst)}
                        >
                          订阅
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <span>共 {instruments.length} 个合约</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the CSS file**

```css
/* frontend/src/components/InstrumentSearchModal/index.css */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary, #999);
}

.modal-filters {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.modal-filters select,
.modal-filters input {
  padding: 6px 10px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 13px;
}

.modal-filters select { min-width: 100px; }
.modal-filters input { flex: 1; min-width: 120px; }

.modal-filters button {
  padding: 6px 16px;
  background: var(--accent-color, #4a9eff);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.modal-filters button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-error {
  padding: 8px 16px;
  background: #ff444422;
  color: #ff4444;
  font-size: 13px;
}

.modal-table-container {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
}

.modal-loading,
.modal-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary, #999);
}

.modal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.modal-table th,
.modal-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #333);
}

.modal-table th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary, #2a2a2a);
}

.modal-table tr:hover {
  background: var(--bg-hover, #2a2a2a);
}

.btn-subscribe {
  padding: 4px 12px;
  background: var(--accent-color, #4a9eff);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}

.subscribed-badge {
  color: var(--text-secondary, #999);
  font-size: 12px;
}

.modal-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--border-color, #333);
  font-size: 12px;
  color: var(--text-secondary, #999);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/InstrumentSearchModal/
git commit -m "feat(task-14): InstrumentSearchModal 组件 — 交易所+品种二级筛选"
```

---

### Task 6: Frontend — Contracts Store 改造 + 持久化

**Files:**
- Modify: `frontend/src/stores/contracts.ts`

**Interfaces:**
- Consumes: `useUserPrefsStore`, `getPresetInstruments()`, `getInstrumentsByIds()`, `subscribeMarket()`, `unsubscribeMarket()`
- Produces: 改造后的 `useContractsStore` 带 `addContractInfo`, `removeContractById`, `loadSubscribedContracts`

- [ ] **Step 1: Rewrite contracts store**

```typescript
// frontend/src/stores/contracts.ts
import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'
import { useUserPrefsStore } from './userPrefs'
import {
  getPresetInstruments,
  getInstrumentsByIds,
  subscribeMarket,
  unsubscribeMarket,
} from '@/services/api'

interface ContractsStore {
  contracts: ContractInfo[]
  selectedContracts: string[]
  setContracts: (contracts: ContractInfo[]) => void
  addContract: (instrumentId: string) => void
  removeContract: (instrumentId: string) => void
  /** Add a contract with full info (from search modal) */
  addContractInfo: (contract: ContractInfo) => void
  /** Remove by instrumentID and unsubscribe from CTP */
  removeContractById: (instrumentId: string) => Promise<void>
  /** Load preset + user subscriptions from localStorage and subscribe */
  loadSubscribedContracts: () => Promise<void>
}

export const useContractsStore = create<ContractsStore>((set, get) => ({
  contracts: [],
  selectedContracts: [],

  setContracts: (contracts) => set({ contracts }),

  addContract: (instrumentId) =>
    set((state) => {
      if (state.selectedContracts.includes(instrumentId)) return state
      return { selectedContracts: [...state.selectedContracts, instrumentId] }
    }),

  removeContract: (instrumentId) =>
    set((state) => ({
      selectedContracts: state.selectedContracts.filter((id) => id !== instrumentId),
    })),

  addContractInfo: (contract) => {
    set((state) => {
      if (state.contracts.some((c) => c.instrumentID === contract.instrumentID)) return state
      return { contracts: [...state.contracts, contract] }
    })
    // Persist to userPrefs
    const prefs = useUserPrefsStore.getState()
    prefs.addSelectedContract(contract.instrumentID)
    prefs.saveToLocalStorage()
  },

  removeContractById: async (instrumentId) => {
    try {
      await unsubscribeMarket([instrumentId])
    } catch {
      // Silent fail — still remove from local state
    }
    set((state) => ({
      contracts: state.contracts.filter((c) => c.instrumentID !== instrumentId),
    }))
    const prefs = useUserPrefsStore.getState()
    prefs.removeSelectedContract(instrumentId)
    prefs.saveToLocalStorage()
  },

  loadSubscribedContracts: async () => {
    // 1. Load user prefs from localStorage
    const prefs = useUserPrefsStore.getState()
    prefs.loadFromLocalStorage()
    const userSelected = prefs.selectedContracts

    // 2. Get preset instruments
    let presetIds: string[] = []
    try {
      const preset = await getPresetInstruments()
      presetIds = preset.instruments
    } catch {
      // Preset load failed — continue with user selections only
    }

    // 3. Merge and deduplicate
    const allIds = [...new Set([...presetIds, ...userSelected])]

    if (allIds.length === 0) return

    // 4. Get contract details
    try {
      const result = await getInstrumentsByIds(allIds)
      if (result.instruments?.length) {
        set({ contracts: result.instruments })
      }
    } catch {
      console.warn('[ContractsStore] Failed to load contract details')
    }
  },
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/contracts.ts
git commit -m "feat(task-15): contracts store 改造 — 预设+用户订阅合并 + localStorage 持久化"
```

---

### Task 7: Frontend — MarketPanel 集成

**Files:**
- Modify: `frontend/src/modules/market/MarketPanel.tsx`

**Interfaces:**
- Consumes: `useContractsStore.loadSubscribedContracts()`, `useContractsStore.addContractInfo()`, `useContractsStore.removeContractById()`, `InstrumentSearchModal`
- Produces: 完整合约搜索+订阅+退订 UI 流程

- [ ] **Step 1: Rewrite MarketPanel**

修改 `frontend/src/modules/market/MarketPanel.tsx`：

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ResizeHandle } from '@/components/ResizeHandle'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { MarketTable } from './MarketTable'
import { DepthQuote } from './DepthQuote'
import { SpreadDisplay } from '@/components/SpreadDisplay'
import { KLineChart } from './KLineChart'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useOrderStore } from '@/modules/order/store'
import { useMarketWs, PERIOD_MS } from '@/hooks/useMarketWs'
import { API_BASE, getKlineData, subscribeMarket } from '@/services/api'
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import './styles.css'

const savedMarketTop = loadPanelSizes('market-top-layout')
const savedMarket = loadPanelSizes('market-layout')

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, klineData, setKlineData } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, addContractInfo, removeContractById } = useContractsStore()
  const [period, setPeriod] = useState('5m')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const loadedRef = useRef(false)

  // Subscribed instrument IDs set (for modal to show "已订阅")
  const subscribedIds = useMemo(
    () => new Set(contracts.map((c) => c.instrumentID)),
    [contracts]
  )

  const onMarketTopLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-top-layout', { table: layout['market-table'], side: layout['market-side'] })
  }, [])

  const onMarketLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-layout', { top: layout['market-top'], kline: layout['market-kline'] })
  }, [])

  // WebSocket 行情推送
  useMarketWs(API_BASE.replace('http', 'ws'), period)

  // 启动时加载预设合约 + 用户订阅
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      useContractsStore.getState().loadSubscribedContracts().then(() => {
        const loaded = useContractsStore.getState().contracts
        if (loaded.length > 0) {
          subscribeMarket(loaded.map((c) => c.instrumentID)).catch(() => {})
        }
      })
    }
  }, [])

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
  })

  const handleSelectContract = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
  }

  const handleUnsubscribe = async () => {
    if (!selectedInstrument) return
    await removeContractById(selectedInstrument)
    setSelectedInstrument(null)
  }

  const handleSubscribeFromModal = (inst: import('@/services/types').ContractInfo) => {
    addContractInfo(inst)
    // Subscribe to CTP market data
    subscribeMarket([inst.instrumentID]).catch(() => {})
  }

  // 获取K线数据
  useEffect(() => {
    if (!selectedInstrument) return
    getKlineData(selectedInstrument, period, 200)
      .then((res) => {
        if (res.bars?.length) {
          const periodMs = PERIOD_MS[period] ?? PERIOD_MS['5m']
          const aligned = res.bars.map((bar) => {
            const d = new Date(bar.timestamp)
            const timeMs = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000) + d.getMilliseconds()
            return { ...bar, timestamp: Math.floor(timeMs / periodMs) * periodMs }
          })
          setKlineData(selectedInstrument, aligned)
        }
      })
      .catch(() => { /* 静默失败 */ })
  }, [selectedInstrument, period, setKlineData])

  const selectedSnapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null
  const selectedKline = selectedInstrument ? klineData.get(selectedInstrument) ?? [] : []

  return (
    <section className="market-panel">
      <div className="panel-header">
        <h2>行情面板</h2>
        <div className="panel-header__actions">
          <ContractSearch contracts={contracts} onSelect={handleSelectContract} />
          <button
            className="btn-search-instruments"
            onClick={() => setSearchModalOpen(true)}
          >
            搜索合约
          </button>
          <button
            className="btn-unsubscribe"
            disabled={!selectedInstrument}
            onClick={handleUnsubscribe}
          >
            退订
          </button>
        </div>
      </div>

      <Group orientation="vertical" className="panel-content" id="market-layout" onLayoutChange={onMarketLayout}>
        <Panel id="market-top" defaultSize={savedMarket?.top ?? 50} minSize={20}>
          <Group orientation="horizontal" className="market-panel__top" id="market-top-layout" onLayoutChange={onMarketTopLayout}>
            <Panel id="market-table" defaultSize={savedMarketTop?.table ?? 75} minSize={30}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <MarketTable
                  contracts={contracts}
                  snapshots={snapshots}
                  selectedInstrument={selectedInstrument}
                  onRowClick={handleClick}
                  onRowDoubleClick={handleDoubleClick}
                />
              </div>
            </Panel>
            <Separator>
              <ResizeHandle direction="horizontal" />
            </Separator>
            <Panel id="market-side" defaultSize={savedMarketTop?.side ?? 25} minSize={10}>
              <div className="market-panel__side">
                <DepthQuote
                  snapshot={selectedSnapshot}
                  onBuyClick={(price) => {
                    if (selectedInstrument) {
                      setOrderInstrument(selectedInstrument)
                      setOrderForm({ direction: 'buy', limitPrice: price })
                    }
                  }}
                  onSellClick={(price) => {
                    if (selectedInstrument) {
                      setOrderInstrument(selectedInstrument)
                      setOrderForm({ direction: 'sell', limitPrice: price })
                    }
                  }}
                />
                <SpreadDisplay
                  bidPrice={selectedSnapshot?.bidPrice1 ?? 0}
                  askPrice={selectedSnapshot?.askPrice1 ?? 0}
                />
              </div>
            </Panel>
          </Group>
        </Panel>
        <Separator>
          <ResizeHandle direction="vertical" />
        </Separator>
        <Panel id="market-kline" defaultSize={savedMarket?.kline ?? 50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedInstrument ? (
              <KLineChart
                instrument={selectedInstrument}
                klineData={selectedKline}
                period={period}
                onPeriodChange={setPeriod}
              />
            ) : (
              <div className="market-panel__kline-placeholder">选择合约查看K线图</div>
            )}
          </div>
        </Panel>
      </Group>

      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSubscribe={handleSubscribeFromModal}
        subscribedIds={subscribedIds}
      />
    </section>
  )
}
```

- [ ] **Step 2: Add button styles**

在 `frontend/src/modules/market/styles.css` 中添加（如果不存在）：

```css
.btn-search-instruments {
  padding: 4px 12px;
  background: var(--accent-color, #4a9eff);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn-unsubscribe {
  padding: 4px 12px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  cursor: pointer;
  font-size: 13px;
}

.btn-unsubscribe:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run frontend dev server to verify**

Run: `cd frontend && npm run dev`
Expected: App loads, "搜索合约" and "退订" buttons visible in header

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/styles.css
git commit -m "feat(task-15): MarketPanel 集成 — 搜索合约按钮 + 退订按钮 + 启动流程改造"
```

---

### Task 8: Frontend — 市场 Store 清理

**Files:**
- Modify: `frontend/src/modules/market/store.ts`

**Interfaces:**
- Removes: `fetchInstruments`, `refreshInstruments`, `isRefreshing` (不再需要)

- [ ] **Step 1: Remove unused methods from market store**

从 `frontend/src/modules/market/store.ts` 中移除 `fetchInstruments`、`refreshInstruments`、`isRefreshing` 以及相关的 `refreshInstruments` import。保留 `subscribeInstruments`（仍然用于批量订阅）。

```typescript
import { create } from 'zustand'
import type { MarketSnapshot, KLineData } from '@/services/types'
import { subscribeMarket } from '@/services/api'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
  subscribeInstruments: (instruments: string[]) => Promise<void>
  klineData: Map<string, KLineData[]>
  setKlineData: (instrument: string, data: KLineData[]) => void
  appendKline: (instrument: string, candle: KLineData) => void
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: null,
  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
  snapshots: new Map(),
  updateSnapshot: (snapshot) =>
    set((state) => {
      const next = new Map(state.snapshots)
      next.set(snapshot.instrumentID, snapshot)
      return { snapshots: next }
    }),
  batchUpdate: (updates) =>
    set((state) => {
      const next = new Map(state.snapshots)
      for (const snap of updates) {
        next.set(snap.instrumentID, snap)
      }
      return { snapshots: next }
    }),
  subscribeInstruments: async (instruments: string[]) => {
    try {
      await subscribeMarket(instruments)
    } catch (error) {
      console.warn('[MarketStore] subscribeInstruments failed:', error)
    }
  },
  klineData: new Map(),
  setKlineData: (instrument, data) =>
    set((state) => {
      const next = new Map(state.klineData)
      const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
      next.set(instrument, sorted)
      return { klineData: next }
    }),
  appendKline: (instrument, candle) =>
    set((state) => {
      const next = new Map(state.klineData)
      const existing = next.get(instrument)
      if (!existing || existing.length === 0) {
        next.set(instrument, [candle])
        return { klineData: next }
      }
      // ... (保留现有的 appendKline 逻辑)
      const last = existing[existing.length - 1]
      let updated: typeof existing
      if (candle.timestamp === last.timestamp) {
        updated = [...existing.slice(0, -1), candle]
      } else if (candle.timestamp > last.timestamp) {
        updated = [...existing, candle]
        if (updated.length > 200) updated = updated.slice(-200)
      } else {
        return state
      }
      next.set(instrument, updated)
      return { klineData: next }
    }),
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all frontend checks**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/market/store.ts
git commit -m "refactor(task-15): market store 清理 — 移除 fetchInstruments/refreshInstruments"
```

---

## 后续验证步骤

1. **后端测试**: `cd server && python -m pytest tests/ -v` — 全部通过
2. **前端构建**: `cd frontend && npm run build` — 无错误
3. **功能验证**:
   - 启动后端 + 前端
   - 检查行情表格是否展示预设合约
   - 点击"搜索合约"→ 选择交易所 → 选择品种 → 查看合约列表
   - 点击"订阅"→ 合约出现在行情表格中
   - 选中合约 → 点击"退订"→ 合约从表格中移除
   - 刷新页面 → 验证订阅列表持久化
