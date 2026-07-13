"""Tests for services/market_service.py — MarketService core logic."""

import json
import os
import tempfile

import pytest
from services.market_service import MarketService


# ── Fake MdUserApi for test isolation ───────────────────────────────────

class _FakeMdApi:
    """Fake MdUserApi — no CTP DLL needed."""

    def __init__(self):
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"
        self.subscribed_instruments = []

    def create(self):
        self.connection_status = "connecting"

    def login(self):
        self.login_status = "logged_in"
        self.connection_status = "connected"
        return 0

    def subscribe(self, instruments):
        for inst in instruments:
            if inst not in self.subscribed_instruments:
                self.subscribed_instruments.append(inst)
        return 0

    def unsubscribe(self, instruments):
        for inst in instruments:
            if inst in self.subscribed_instruments:
                self.subscribed_instruments.remove(inst)
        return 0

    def release(self):
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"
        self.subscribed_instruments.clear()


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
