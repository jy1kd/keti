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

