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

