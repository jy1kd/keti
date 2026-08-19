## Task 3 Report — Backend: 预设合约功能

**Status:** DONE

**Commits:**
- `a211f1a` — `feat(task-3): 预设合约 — 自动检测主力合约 + preset API 端点`

**Test summary:**
```
cd server && python -m pytest tests/test_market_api.py tests/test_market_service.py -v
Result: 100 passed, 1 failed (pre-existing)
```

The 1 failure is pre-existing (`TestGetDepth::test_depth_returns_snapshot_depth` — test provides only 2 depth levels but asserts 5). All 6 new tests pass:
- 4 service tests (`TestPresetInstruments`): `test_get_preset_returns_empty_initially`, `test_refresh_preset_detects_front_month`, `test_refresh_preset_skips_non_trading`, `test_refresh_preset_saves_to_file`
- 2 API tests (`TestPreset`): `test_get_preset_returns_empty_initially`, `test_refresh_preset`

**What was done:**

1. Created `server/data/preset_instruments.json` with empty initial state (`{"instruments": [], "updatedAt": null}`)

2. Added to `server/services/market_service.py`:
   - `get_preset_instruments()` — reads preset list from `data/preset_instruments.json`, returns `{instruments, updatedAt}`
   - `refresh_preset_instruments(file_path="")` — groups `_instruments` by `productID`, filters `isTrading==1`, picks nearest `expireDate` per product (front-month), saves result to file
   - Added `from collections import defaultdict`, `from datetime import datetime`, `from pathlib import Path` to imports

3. Added to `server/api/market.py`:
   - `GET /api/market/preset` — returns preset instrument list
   - `POST /api/market/preset/refresh` — auto-detects front-month contracts and updates preset list

4. Added tests to `server/tests/test_market_service.py` (4 tests in `TestPresetInstruments` class)

5. Added tests to `server/tests/test_market_api.py` (2 tests in `TestPreset` class)

**Concerns:**
- The `refresh_preset_instruments` method uses `datetime.now()` to filter future expiries. This means results depend on the current date — contracts that have already expired will be skipped. This is correct behavior but means the preset list becomes stale over time (contracts expire). The `POST /api/market/preset/refresh` endpoint exists to re-run the detection.
- The method writes to disk synchronously. For a preset file this is fine (small file, infrequent writes), but worth noting for future consideration.

---

## Task 3 Review Fix Report

**Commit:** `51a426b` — `fix(task-3): review反馈 — 修复测试污染preset文件+API测试验证不足`

**What was fixed:**

1. **Critical: Tests pollute the real `preset_instruments.json` file.** Three tests in `TestPresetInstruments` (`test_refresh_preset_detects_front_month`, `test_refresh_preset_skips_non_trading`) and one API test (`test_refresh_preset`) were calling `refresh_preset_instruments()` without a `file_path` override, writing test output to the tracked file.
   - Service tests: Added `tempfile.NamedTemporaryFile` + `file_path=tmp_path` parameter to `refresh_preset_instruments()` calls (same pattern as existing `test_refresh_preset_saves_to_file`).
   - API test: Added `_isolate_preset_file` autouse fixture to `TestPreset` class that uses a `_FakePath` subclass (redirects `Path.parent` and `Path.__truediv__` for `preset_instruments.json`) via `unittest.mock.patch` to isolate file writes to a temp directory.

2. **Critical: Committed `preset_instruments.json` contained test side-effect data.** Restored to the spec-required empty template `{"instruments": [], "updatedAt": null}` with trailing newline.

3. **Important: API test `test_refresh_preset` did not validate front-month detection.** Added `isTrading: 1` to all three instruments in `SAMPLE_INSTRUMENTS` and added assertions for specific instrument IDs: `assert len(data["instruments"]) == 2` and `assert set(data["instruments"]) == {"IF2608", "au2608"}`.

4. **Minor: Missing trailing newline in `preset_instruments.json`.** File now ends with a newline.

**Test results:**
```
cd server && python -m pytest tests/test_market_service.py::TestPresetInstruments tests/test_market_api.py::TestPreset -v
6 passed in 0.92s
```

Full suite: `568 passed, 14 failed` (all 14 failures are pre-existing: config, connection_api, depth tests).

```
cd server && python -m pytest tests/ -v
568 passed, 14 failed, 2 warnings in 28.97s
```
