"""Tests for services/market_service.py — MarketService core logic."""

import json
import os
import tempfile

import pytest
from services.market_service import MarketService


# ── Initialization ──────────────────────────────────────────────────────

class TestMarketServiceInit:
    """MarketService construction and default state."""

    def test_import(self):
        """MarketService should be importable."""
        assert MarketService is not None

    def test_default_state(self):
        """New MarketService starts with empty caches and 0 subscriptions."""
        svc = MarketService()
        assert svc.instrument_count == 0
        assert svc.snapshot_count == 0
        assert svc.subscription_count == 0

    def test_max_subscriptions(self):
        """MAX_SUBSCRIPTIONS should be 500."""
        svc = MarketService()
        assert svc.MAX_SUBSCRIPTIONS == 500

    def test_instruments_empty_by_default(self):
        """get_instruments returns empty list when no data loaded."""
        svc = MarketService()
        result = svc.get_instruments()
        assert result == []
        assert svc.instrument_count == 0


# ── Instrument cache ────────────────────────────────────────────────────

class TestInstrumentCache:
    """Loading and querying the instrument cache."""

    SAMPLE_INSTRUMENTS = [
        {
            "instrumentID": "IF2608",
            "instrumentName": "沪深300指数期货2608",
            "exchangeID": "CFFEX",
            "productID": "IF",
            "productClass": "1",
            "volumeMultiple": 300,
            "priceTick": 0.2,
            "expireDate": "20260821",
        },
        {
            "instrumentID": "IF2609",
            "instrumentName": "沪深300指数期货2609",
            "exchangeID": "CFFEX",
            "productID": "IF",
            "productClass": "1",
            "volumeMultiple": 300,
            "priceTick": 0.2,
            "expireDate": "20260918",
        },
        {
            "instrumentID": "IC2608",
            "instrumentName": "中证500指数期货2608",
            "exchangeID": "CFFEX",
            "productID": "IC",
            "productClass": "1",
            "volumeMultiple": 200,
            "priceTick": 0.2,
            "expireDate": "20260821",
        },
        {
            "instrumentID": "au2608",
            "instrumentName": "黄金2608",
            "exchangeID": "SHFE",
            "productID": "au",
            "productClass": "1",
            "volumeMultiple": 1000,
            "priceTick": 0.02,
            "expireDate": "20260815",
        },
    ]

    def test_load_instruments(self):
        """load_instruments replaces the instrument cache."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        assert svc.instrument_count == 4

    def test_get_instruments_returns_all(self):
        """get_instruments without keyword returns all instruments."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments()
        assert len(result) == 4

    def test_get_instruments_search_by_id(self):
        """get_instruments with keyword filters by instrumentID."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="IF")
        assert len(result) == 2
        ids = {r["instrumentID"] for r in result}
        assert ids == {"IF2608", "IF2609"}

    def test_get_instruments_search_by_name(self):
        """get_instruments with keyword filters by instrumentName (fuzzy)."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="黄金")
        assert len(result) == 1
        assert result[0]["instrumentID"] == "au2608"

    def test_get_instruments_search_by_exchange(self):
        """get_instruments with keyword filters by exchangeID."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="SHFE")
        assert len(result) == 1
        assert result[0]["instrumentID"] == "au2608"

    def test_get_instruments_search_case_insensitive(self):
        """get_instruments keyword search is case-insensitive."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="if2608")
        assert len(result) == 1
        assert result[0]["instrumentID"] == "IF2608"

    def test_get_instruments_no_match(self):
        """get_instruments returns empty list when no match."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="ZZZZZ")
        assert result == []

    def test_get_instruments_empty_keyword(self):
        """get_instruments with empty keyword returns all."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="")
        assert len(result) == 4

    def test_get_instruments_preserves_all_fields(self):
        """get_instruments returns all fields from loaded data."""
        svc = MarketService()
        svc.load_instruments(self.SAMPLE_INSTRUMENTS)
        result = svc.get_instruments(keyword="IF2608")
        assert len(result) == 1
        inst = result[0]
        assert inst["volumeMultiple"] == 300
        assert inst["priceTick"] == 0.2
        assert inst["expireDate"] == "20260821"


# ── Subscription management ────────────────────────────────────────────

class TestSubscriptionManagement:
    """Subscribing and unsubscribing instruments."""

    def test_subscribe_adds_instruments(self):
        """subscribe adds instruments to the subscription set."""
        svc = MarketService()
        result = svc.subscribe(["IF2608", "IF2609"])
        assert result["success"] is True
        assert svc.subscription_count == 2
        assert "IF2608" in svc.get_subscriptions()
        assert "IF2609" in svc.get_subscriptions()

    def test_subscribe_returns_added_count(self):
        """subscribe returns the count of newly added instruments."""
        svc = MarketService()
        result = svc.subscribe(["IF2608", "IF2609"])
        assert result["added"] == 2

    def test_subscribe_dedup(self):
        """Subscribing the same instrument twice does not increase count."""
        svc = MarketService()
        svc.subscribe(["IF2608"])
        result = svc.subscribe(["IF2608", "IF2609"])
        assert result["added"] == 1  # only IF2609 is new
        assert svc.subscription_count == 2

    def test_subscribe_returns_already_subscribed(self):
        """subscribe reports which instruments were already subscribed."""
        svc = MarketService()
        svc.subscribe(["IF2608"])
        result = svc.subscribe(["IF2608", "IF2609"])
        assert result["alreadySubscribed"] == ["IF2608"]

    def test_subscribe_empty_list(self):
        """subscribe with empty list is a no-op."""
        svc = MarketService()
        result = svc.subscribe([])
        assert result["added"] == 0
        assert svc.subscription_count == 0

    def test_unsubscribe_removes_instruments(self):
        """unsubscribe removes instruments from tracking."""
        svc = MarketService()
        svc.subscribe(["IF2608", "IF2609"])
        result = svc.unsubscribe(["IF2608"])
        assert result["success"] is True
        assert svc.subscription_count == 1
        assert "IF2608" not in svc.get_subscriptions()

    def test_unsubscribe_returns_removed_count(self):
        """unsubscribe returns count of removed instruments."""
        svc = MarketService()
        svc.subscribe(["IF2608", "IF2609"])
        result = svc.unsubscribe(["IF2608"])
        assert result["removed"] == 1

    def test_unsubscribe_not_subscribed(self):
        """Unsubscribing an unsubscribed instrument is safe."""
        svc = MarketService()
        result = svc.unsubscribe(["IF2608"])
        assert result["removed"] == 0
        assert svc.subscription_count == 0

    def test_unsubscribe_empty_list(self):
        """unsubscribe with empty list is a no-op."""
        svc = MarketService()
        svc.subscribe(["IF2608"])
        result = svc.unsubscribe([])
        assert result["removed"] == 0
        assert svc.subscription_count == 1


# ── CTP hooks ──────────────────────────────────────────────────────────

class TestCtpHooks:
    """subscribe_fn / unsubscribe_fn integration with CTP."""

    def test_set_ctp_hooks(self):
        """set_ctp_hooks stores the callables."""
        svc = MarketService()
        sub_fn = lambda instruments: 0
        unsub_fn = lambda instruments: 0
        svc.set_ctp_hooks(sub_fn, unsub_fn)
        assert svc._subscribe_fn is sub_fn
        assert svc._unsubscribe_fn is unsub_fn

    def test_subscribe_calls_ctp_fn(self):
        """subscribe calls subscribe_fn with new instruments only."""
        called_with = []
        svc = MarketService()
        svc.set_ctp_hooks(
            subscribe_fn=lambda insts: called_with.extend(insts),
            unsubscribe_fn=lambda insts: None,
        )
        svc.subscribe(["IF2608", "IF2609"])
        assert called_with == ["IF2608", "IF2609"]

    def test_subscribe_calls_ctp_fn_only_for_new(self):
        """subscribe_fn receives only newly added instruments, not duplicates."""
        called_with = []
        svc = MarketService()
        svc.set_ctp_hooks(
            subscribe_fn=lambda insts: called_with.extend(insts),
            unsubscribe_fn=lambda insts: None,
        )
        svc.subscribe(["IF2608"])
        svc.subscribe(["IF2608", "IF2609"])
        assert called_with == ["IF2608", "IF2609"]  # IF2608 only once

    def test_unsubscribe_calls_ctp_fn(self):
        """unsubscribe calls unsubscribe_fn with removed instruments."""
        called_with = []
        svc = MarketService()
        svc.set_ctp_hooks(
            subscribe_fn=lambda insts: None,
            unsubscribe_fn=lambda insts: called_with.extend(insts),
        )
        svc.subscribe(["IF2608", "IF2609"])
        svc.unsubscribe(["IF2608"])
        assert called_with == ["IF2608"]

    def test_unsubscribe_calls_ctp_fn_only_for_subscribed(self):
        """unsubscribe_fn receives only actually subscribed instruments."""
        called_with = []
        svc = MarketService()
        svc.set_ctp_hooks(
            subscribe_fn=lambda insts: None,
            unsubscribe_fn=lambda insts: called_with.extend(insts),
        )
        svc.subscribe(["IF2608"])
        svc.unsubscribe(["IF2608", "IF2609"])  # IF2609 not subscribed
        assert called_with == ["IF2608"]

    def test_subscribe_without_hooks_no_error(self):
        """subscribe works without CTP hooks set (backward compatible)."""
        svc = MarketService()
        result = svc.subscribe(["IF2608"])
        assert result["success"] is True
        assert svc.subscription_count == 1

    def test_unsubscribe_without_hooks_no_error(self):
        """unsubscribe works without CTP hooks set (backward compatible)."""
        svc = MarketService()
        svc.subscribe(["IF2608"])
        result = svc.unsubscribe(["IF2608"])
        assert result["success"] is True
        assert svc.subscription_count == 0

    def test_subscribe_ctp_fn_exception_returns_failure(self):
        """If CTP subscribe raises, returns success=False with error message."""
        svc = MarketService()
        svc.set_ctp_hooks(
            subscribe_fn=lambda insts: (_ for _ in ()).throw(RuntimeError("CTP error")),
            unsubscribe_fn=lambda insts: None,
        )
        result = svc.subscribe(["IF2608"])
        assert result["success"] is False
        assert "message" in result
        assert "CTP error" in result["message"]
        assert svc.subscription_count == 1  # local state preserved

    def test_unsubscribe_ctp_fn_exception_returns_failure(self):
        """If CTP unsubscribe raises, returns success=False with error message."""
        svc = MarketService()
        svc.set_ctp_hooks(
            subscribe_fn=lambda insts: None,
            unsubscribe_fn=lambda insts: (_ for _ in ()).throw(RuntimeError("CTP error")),
        )
        svc.subscribe(["IF2608"])
        result = svc.unsubscribe(["IF2608"])
        assert result["success"] is False
        assert "message" in result
        assert "CTP error" in result["message"]
        assert svc.subscription_count == 0  # local state preserved


# ── Subscription limit ─────────────────────────────────────────────────

class TestSubscriptionLimit:
    """MAX_SUBSCRIPTIONS enforcement (500)."""

    def test_subscribe_within_limit(self):
        """Subscribing up to 500 instruments succeeds."""
        svc = MarketService()
        instruments = [f"IF{2600 + i:04d}" for i in range(500)]
        result = svc.subscribe(instruments)
        assert result["success"] is True
        assert svc.subscription_count == 500

    def test_subscribe_exceeds_limit(self):
        """Subscribing >500 instruments total is rejected."""
        svc = MarketService()
        # First fill up to limit
        instruments = [f"IF{2600 + i:04d}" for i in range(500)]
        svc.subscribe(instruments)
        # Then try to add one more
        result = svc.subscribe(["IF9999"])
        assert result["success"] is False
        assert "limit" in result.get("message", "").lower() or "500" in result.get("message", "")
        assert svc.subscription_count == 500

    def test_subscribe_batch_exceeds_limit(self):
        """A single batch that would exceed the limit is rejected entirely."""
        svc = MarketService()
        instruments = [f"IF{2600 + i:04d}" for i in range(501)]
        result = svc.subscribe(instruments)
        assert result["success"] is False
        assert svc.subscription_count == 0


# ── Snapshot cache ─────────────────────────────────────────────────────

class TestSnapshotCache:
    """Storing and retrieving market data snapshots."""

    SAMPLE_SNAPSHOT = {
        "instrumentID": "IF2608",
        "lastPrice": 3850.0,
        "openPrice": 3845.0,
        "highestPrice": 3855.0,
        "lowestPrice": 3840.0,
        "volume": 12345,
        "openInterest": 67890.0,
        "bidPrice1": 3849.8,
        "bidVolume1": 10,
        "askPrice1": 3850.2,
        "askVolume1": 5,
        "updateTime": "14:30:00",
    }

    def test_update_snapshot_stores_data(self):
        """update_snapshot stores a snapshot in cache."""
        svc = MarketService()
        svc.update_snapshot(self.SAMPLE_SNAPSHOT)
        assert svc.snapshot_count == 1

    def test_get_snapshot_returns_data(self):
        """get_snapshot retrieves a stored snapshot."""
        svc = MarketService()
        svc.update_snapshot(self.SAMPLE_SNAPSHOT)
        snap = svc.get_snapshot("IF2608")
        assert snap is not None
        assert snap["lastPrice"] == 3850.0

    def test_get_snapshot_missing(self):
        """get_snapshot returns None for unknown instrument."""
        svc = MarketService()
        snap = svc.get_snapshot("ZZZZZ")
        assert snap is None

    def test_get_all_snapshots(self):
        """get_all_snapshots returns all cached snapshots."""
        svc = MarketService()
        svc.update_snapshot(self.SAMPLE_SNAPSHOT)
        svc.update_snapshot({
            "instrumentID": "IF2609",
            "lastPrice": 3860.0,
        })
        all_snaps = svc.get_all_snapshots()
        assert len(all_snaps) == 2
        ids = {s["instrumentID"] for s in all_snaps}
        assert ids == {"IF2608", "IF2609"}

    def test_update_snapshot_overwrites(self):
        """Updating the same instrument overwrites previous snapshot."""
        svc = MarketService()
        svc.update_snapshot(self.SAMPLE_SNAPSHOT)
        svc.update_snapshot({
            "instrumentID": "IF2608",
            "lastPrice": 3900.0,
        })
        assert svc.snapshot_count == 1
        snap = svc.get_snapshot("IF2608")
        assert snap["lastPrice"] == 3900.0
        # Old fields should be merged (not wiped)
        assert snap.get("openPrice") == 3845.0


# ── File loading ───────────────────────────────────────────────────────

class TestLoadInstrumentsFromFile:
    """Loading instrument cache from JSON file."""

    def test_load_from_file_replaces_cache(self):
        """load_instruments_from_file replaces the instrument cache."""
        svc = MarketService()
        # Create a temp JSON file
        data = [
            {"instrumentID": "TEST01", "instrumentName": "Test 1"},
            {"instrumentID": "TEST02", "instrumentName": "Test 2"},
        ]
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(data, f)
            tmp_path = f.name

        try:
            count = svc.load_instruments_from_file(tmp_path)
            assert count == 2
            assert svc.instrument_count == 2
            result = svc.get_instruments()
            assert result[0]["instrumentID"] == "TEST01"
        finally:
            os.unlink(tmp_path)

    def test_load_from_nonexistent_file(self):
        """Loading from a nonexistent file returns 0 and keeps cache empty."""
        svc = MarketService()
        count = svc.load_instruments_from_file("/nonexistent/path.json")
        assert count == 0
        assert svc.instrument_count == 0

    def test_load_from_invalid_json(self):
        """Loading from a file with invalid JSON returns 0."""
        svc = MarketService()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            f.write("not valid json {{{")
            tmp_path = f.name

        try:
            count = svc.load_instruments_from_file(tmp_path)
            assert count == 0
        finally:
            os.unlink(tmp_path)

    def test_load_from_file_not_a_list(self):
        """Loading from a JSON file that is not a list returns 0."""
        svc = MarketService()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump({"not": "a list"}, f)
            tmp_path = f.name

        try:
            count = svc.load_instruments_from_file(tmp_path)
            assert count == 0
        finally:
            os.unlink(tmp_path)

    def test_load_real_instruments_file(self):
        """The real data/instruments.json file can be loaded."""
        svc = MarketService()
        # Path relative to server/ directory
        file_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "instruments.json"
        )
        count = svc.load_instruments_from_file(file_path)
        assert count > 0
        assert svc.instrument_count == count
        # All instruments should have required fields
        for inst in svc.get_instruments():
            assert "instrumentID" in inst
            assert "instrumentName" in inst


# ── Instrument refresh from CTP (PR-19) ────────────────────────────────

class TestRefreshInstrumentsFromCtp:
    """refresh_instruments_from_ctp: collect CTP results and save to file."""

    def test_refresh_calls_query_instruments(self):
        """refresh should call query_instruments on the TraderApi."""
        svc = MarketService()
        query_calls = []

        class MockTraderApi:
            login_status = "logged_in"
            connection_status = "connected"

            def query_instruments(self):
                query_calls.append(1)
                return 0

        svc.refresh_instruments_from_ctp(MockTraderApi(), callback=None)
        assert len(query_calls) == 1

    def test_refresh_returns_error_when_not_logged_in(self):
        """refresh should fail if TraderApi is not logged in."""
        svc = MarketService()

        class MockTraderApi:
            login_status = "not_logged_in"
            connection_status = "connected"

        result = svc.refresh_instruments_from_ctp(MockTraderApi(), callback=None)
        assert result["success"] is False
        assert "not logged in" in result["message"].lower()

    def test_refresh_returns_error_when_query_fails(self):
        """refresh should fail if query_instruments returns negative."""
        svc = MarketService()

        class MockTraderApi:
            login_status = "logged_in"
            connection_status = "connected"

            def query_instruments(self):
                return -1

        result = svc.refresh_instruments_from_ctp(MockTraderApi(), callback=None)
        assert result["success"] is False
        assert "query failed" in result["message"].lower()

    def test_refresh_stores_instruments_callback(self):
        """refresh should store the on_instruments callback for later use."""
        svc = MarketService()

        class MockTraderApi:
            login_status = "logged_in"
            connection_status = "connected"

            def query_instruments(self):
                return 0

        received = []
        svc.refresh_instruments_from_ctp(
            MockTraderApi(),
            callback=lambda instruments: received.extend(instruments),
        )
        # The callback should be stored for use when CTP responds
        assert svc._on_instruments_callback is not None

    def test_on_instruments_result_saves_to_file(self):
        """on_instruments_result should save instruments to JSON file."""
        svc = MarketService()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            tmp_path = f.name

        try:
            instruments = [
                {"instrumentID": "IF2608", "instrumentName": "IF2608"},
                {"instrumentID": "IF2609", "instrumentName": "IF2609"},
            ]
            svc.on_instruments_result(instruments, is_last=True, file_path=tmp_path)
            assert svc.instrument_count == 2
            # Verify file was written
            with open(tmp_path, "r") as f:
                saved = json.load(f)
            assert len(saved) == 2
        finally:
            os.unlink(tmp_path)

    def test_on_instruments_result_accumulates(self):
        """on_instruments_result should accumulate until is_last=True."""
        svc = MarketService()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            tmp_path = f.name

        try:
            svc.on_instruments_result(
                [{"instrumentID": "IF2608"}], is_last=False, file_path=tmp_path,
            )
            assert svc.instrument_count == 0  # not saved yet

            svc.on_instruments_result(
                [{"instrumentID": "IF2609"}], is_last=True, file_path=tmp_path,
            )
            assert svc.instrument_count == 2  # both saved
        finally:
            os.unlink(tmp_path)

    def test_on_instruments_result_calls_callback(self):
        """on_instruments_result should call the callback with count."""
        svc = MarketService()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            tmp_path = f.name

        try:
            received = []
            svc.set_instruments_callback(lambda count: received.append(count))
            svc.on_instruments_result(
                [{"instrumentID": "IF2608"}, {"instrumentID": "IF2609"}],
                is_last=True,
                file_path=tmp_path,
            )
            assert received == [2]
        finally:
            os.unlink(tmp_path)

    def test_on_instruments_result_maps_ctp_fields(self):
        """on_instruments_result should map CTP PascalCase to camelCase."""
        svc = MarketService()

        class MockInstrument:
            InstrumentID = "IF2608"
            InstrumentName = "沪深300"
            ExchangeID = "CFFEX"
            ProductID = "IF"
            ProductClass = "1"
            VolumeMultiple = 300
            PriceTick = 0.2
            ExpireDate = "20260821"
            OptionsType = ""
            StrikePrice = 0.0
            UnderlyingInstrID = ""
            IsTrading = 1

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            tmp_path = f.name

        try:
            svc.on_instruments_result(
                [MockInstrument()], is_last=True, file_path=tmp_path,
            )
            result = svc.get_instruments()
            assert len(result) == 1
            assert result[0]["instrumentID"] == "IF2608"
            assert result[0]["volumeMultiple"] == 300
        finally:
            os.unlink(tmp_path)


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
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            tmp_path = f.name
        try:
            result = svc.refresh_preset_instruments(file_path=tmp_path)
            assert result["success"] is True
            # IF2608 expires sooner, au2608 is the only au
            assert set(result["instruments"]) == {"IF2608", "au2608"}
        finally:
            os.unlink(tmp_path)

    def test_refresh_preset_skips_non_trading(self):
        svc = MarketService()
        svc.load_instruments([
            {"instrumentID": "IF2608", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260821", "isTrading": 0},
            {"instrumentID": "IF2609", "exchangeID": "CFFEX", "productID": "IF", "expireDate": "20260918", "isTrading": 1},
        ])
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            tmp_path = f.name
        try:
            result = svc.refresh_preset_instruments(file_path=tmp_path)
            assert "IF2608" not in result["instruments"]
            assert "IF2609" in result["instruments"]
        finally:
            os.unlink(tmp_path)

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
