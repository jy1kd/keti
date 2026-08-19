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

