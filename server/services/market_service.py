"""Market data service — instrument cache, snapshot cache, subscription management.

Sits between API routes and CTP MdUserApi. Designed for testability:
all CTP-dependent operations accept the MdUserApi as an optional dependency.
"""

import json
import logging
import threading
from typing import Any, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class MarketService:
    """Core market data service.

    Manages:
    - Instrument list cache (loaded from CTP or file)
    - Market data snapshot cache (in-memory)
    - Subscription tracking (with 500-contract limit)
    """

    MAX_SUBSCRIPTIONS: int = 500

    def __init__(self) -> None:
        self._instruments: List[dict] = []
        self._snapshots: Dict[str, dict] = {}
        self._subscriptions: Set[str] = set()
        self._lock = threading.Lock()
        # CTP callback hooks — set via set_ctp_hooks() after CTP connects
        self._subscribe_fn: Optional[Callable[[List[str]], Any]] = None
        self._unsubscribe_fn: Optional[Callable[[List[str]], Any]] = None
        # Instrument refresh state (PR-19)
        self._pending_instruments: List[dict] = []
        self._on_instruments_callback: Optional[Callable] = None

    def set_ctp_hooks(
        self,
        subscribe_fn: Callable[[List[str]], Any],
        unsubscribe_fn: Callable[[List[str]], Any],
    ) -> None:
        """Inject CTP subscribe/unsubscribe callables.

        Called by ctp_startup after CTP connects. Before this,
        subscribe/unsubscribe only do local bookkeeping.
        """
        self._subscribe_fn = subscribe_fn
        self._unsubscribe_fn = unsubscribe_fn

    # ── Instrument cache ──────────────────────────────────────────────

    @property
    def instrument_count(self) -> int:
        return len(self._instruments)

    def load_instruments(self, instruments: List[dict]) -> None:
        """Replace the instrument cache with a new list."""
        self._instruments = list(instruments)

    def load_instruments_from_file(self, file_path: str) -> int:
        """Load instrument cache from a JSON file.

        Returns:
            Number of instruments loaded. 0 on error or empty file.
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
            logger.warning("Failed to load instruments from %s: %s", file_path, exc)
            return 0

        if not isinstance(data, list):
            logger.warning(
                "Instruments file %s is not a JSON array (got %s)",
                file_path, type(data).__name__,
            )
            return 0

        self.load_instruments(data)
        return len(data)

    def get_instruments(self, keyword: str = "") -> List[dict]:
        """Query instruments, optionally filtered by keyword (fuzzy search).

        Searches across: instrumentID, instrumentName, exchangeID, productID.
        Case-insensitive.
        """
        if not keyword:
            return list(self._instruments)

        kw = keyword.lower()
        results: List[dict] = []
        for inst in self._instruments:
            searchable = " ".join(
                str(inst.get(k, "")) for k in (
                    "instrumentID", "instrumentName",
                    "exchangeID", "productID",
                )
            ).lower()
            if kw in searchable:
                results.append(inst)
        return results

    # ── Subscription management ───────────────────────────────────────

    @property
    def subscription_count(self) -> int:
        return len(self._subscriptions)

    def get_subscriptions(self) -> List[str]:
        """Return current subscription list."""
        return sorted(self._subscriptions)

    def subscribe(self, instruments: List[str]) -> dict:
        """Subscribe to market data for a list of instruments.

        Returns:
            dict with keys: success, added, alreadySubscribed, message (if limit hit).
        """
        if not instruments:
            return {"success": True, "added": 0, "alreadySubscribed": []}

        already: List[str] = []
        new_instruments: List[str] = []

        for inst in instruments:
            if inst in self._subscriptions:
                already.append(inst)
            else:
                new_instruments.append(inst)

        # Check limit BEFORE adding (atomic check for batch)
        if len(self._subscriptions) + len(new_instruments) > self.MAX_SUBSCRIPTIONS:
            return {
                "success": False,
                "added": 0,
                "alreadySubscribed": already,
                "message": (
                    f"Subscription limit exceeded: "
                    f"{len(self._subscriptions)} subscribed, "
                    f"cannot add {len(new_instruments)} more "
                    f"(max {self.MAX_SUBSCRIPTIONS})"
                ),
            }

        for inst in new_instruments:
            self._subscriptions.add(inst)

        # Call CTP SubscribeMarketData for the new instruments
        if new_instruments and self._subscribe_fn is not None:
            try:
                self._subscribe_fn(new_instruments)
            except Exception:
                logger.warning("CTP subscribe failed for %s", new_instruments, exc_info=True)

        return {
            "success": True,
            "added": len(new_instruments),
            "alreadySubscribed": already,
        }

    def unsubscribe(self, instruments: List[str]) -> dict:
        """Unsubscribe from market data for a list of instruments.

        Returns:
            dict with keys: success, removed.
        """
        if not instruments:
            return {"success": True, "removed": 0}

        removed_instruments: List[str] = []
        for inst in instruments:
            if inst in self._subscriptions:
                self._subscriptions.discard(inst)
                removed_instruments.append(inst)

        # Call CTP UnSubscribeMarketData for the removed instruments
        if removed_instruments and self._unsubscribe_fn is not None:
            try:
                self._unsubscribe_fn(removed_instruments)
            except Exception:
                logger.warning("CTP unsubscribe failed for %s", removed_instruments, exc_info=True)

        return {"success": True, "removed": len(removed_instruments)}

    # ── Snapshot cache ────────────────────────────────────────────────

    @property
    def snapshot_count(self) -> int:
        return len(self._snapshots)

    def update_snapshot(self, data: dict) -> None:
        """Store or merge a market data snapshot. Thread-safe.

        Can be safely called from CTP worker threads (via ctp_bridge)
        and from async route handlers concurrently.
        """
        inst_id = data.get("instrumentID", "")
        if not inst_id:
            return

        with self._lock:
            if inst_id in self._snapshots:
                # Merge: new fields overwrite old, old fields preserved
                merged = dict(self._snapshots[inst_id])
                merged.update(data)
                self._snapshots[inst_id] = merged
            else:
                self._snapshots[inst_id] = dict(data)

    def get_snapshot(self, instrument_id: str) -> Optional[dict]:
        """Get a single snapshot by instrument ID. Returns None if missing."""
        return self._snapshots.get(instrument_id)

    def get_all_snapshots(self) -> List[dict]:
        """Return all cached snapshots as a list."""
        return list(self._snapshots.values())

    # ── Instrument refresh from CTP (PR-19) ──────────────────────────────

    def set_instruments_callback(self, callback) -> None:
        """Register a callback for when instruments refresh completes.

        Args:
            callback: Callable receiving the count of instruments loaded.
        """
        self._on_instruments_callback = callback

    def refresh_instruments_from_ctp(self, trader_api, callback=None) -> dict:
        """Start instrument query from CTP.

        Args:
            trader_api: TraderApi instance (must be logged in).
            callback: Optional callable(count) when refresh completes.

        Returns:
            dict with keys: success, message.
        """
        if trader_api.login_status != "logged_in":
            return {"success": False, "message": "TraderApi not logged in"}

        if callback is not None:
            self._on_instruments_callback = callback

        self._pending_instruments: List[dict] = []

        result = trader_api.query_instruments()
        if result < 0:
            return {"success": False, "message": "Query failed"}

        return {"success": True, "message": "Query started"}

    def on_instruments_result(self, instruments, is_last: bool, file_path: str = "") -> None:
        """Handle OnRspQryInstrument callback data.

        Args:
            instruments: List of CTP instrument objects (or dicts).
            is_last: True if this is the final batch.
            file_path: Path to save instruments.json. Empty = skip file write.
        """
        from services.field_mapping import map_instrument

        # Map each instrument (handles both CTP objects and plain dicts)
        for inst in instruments:
            if isinstance(inst, dict):
                self._pending_instruments.append(inst)
            else:
                self._pending_instruments.append(map_instrument(inst))

        if is_last:
            # Save to cache and file
            self.load_instruments(self._pending_instruments)
            if file_path:
                self._save_instruments_to_file(file_path, self._pending_instruments)
            count = len(self._pending_instruments)
            self._pending_instruments = []
            if hasattr(self, '_on_instruments_callback') and self._on_instruments_callback:
                self._on_instruments_callback(count)

    def _save_instruments_to_file(self, file_path: str, instruments: List[dict]) -> None:
        """Save instrument list to a JSON file."""
        import json
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(instruments, f, ensure_ascii=False, indent=2)
            logger.info("Saved %d instruments to %s", len(instruments), file_path)
        except OSError as exc:
            logger.warning("Failed to save instruments to %s: %s", file_path, exc)
