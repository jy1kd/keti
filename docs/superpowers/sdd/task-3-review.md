## Task 3 Review — Backend: preset instruments (re-review after fixes)

**Commits reviewed:** `a211f1a` (original) + `51a426b` (fix)

---

### Verdict

- **Spec:** ✅
- **Task quality:** Approved

---

### Issue resolution

All four issues from the initial review are resolved:

1. **Critical (test pollution):** Fixed. Service tests now use `tempfile.NamedTemporaryFile` + `file_path=tmp_path` for `refresh_preset_instruments()` calls. The API test `TestPreset` uses an `_isolate_preset_file` autouse fixture that patches `services.market_service.Path` with a `_FakePath` subclass redirecting `preset_instruments.json` writes to a temp directory. Tests are now hermetic and do not modify tracked files.

2. **Critical (wrong initial state):** Fixed. `server/data/preset_instruments.json` is restored to the spec-required empty template `{"instruments": [], "updatedAt": null}`.

3. **Important (API test validation gap):** Fixed. `SAMPLE_INSTRUMENTS` now includes `"isTrading": 1` on all three instruments, and `test_refresh_preset` asserts specific values: `assert len(data["instruments"]) == 2` and `assert set(data["instruments"]) == {"IF2608", "au2608"}`.

4. **Minor (trailing newline):** Fixed. `preset_instruments.json` now ends with a newline.

---

### Spec compliance

All required files are present and correct:
- `server/data/preset_instruments.json` — empty initial state with trailing newline
- `server/services/market_service.py` — `get_preset_instruments()` and `refresh_preset_instruments()` with `file_path` parameter
- `server/api/market.py` — `GET /preset` and `POST /preset/refresh` endpoints
- `server/tests/test_market_service.py` — 4 tests, all using temp files
- `server/tests/test_market_api.py` — 2 tests, with file isolation fixture and specific assertions

Front-month detection logic (group by `productID`, filter `isTrading==1`, pick nearest `expireDate`) is correctly implemented.

---

### Positive observations

- The `_isolate_preset_file` fixture in `TestPreset` is a clean approach to API-level test isolation: it patches `Path` at the service module level so that the entire refresh flow writes to a temp directory without changing production code.
- The `file_path=""` parameter on `refresh_preset_instruments` provides good testability for service-level tests, while the Path-patching approach covers API-level tests where the service is instantiated internally.
- All 6 Task 3 tests pass; 568 passed / 14 failed in the full suite (failures are pre-existing, unrelated to Task 3).
