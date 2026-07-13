"""Market data service — instrument cache, snapshot cache, subscription management.

Sits between API routes and CTP MdUserApi. Designed for testability:
all CTP-dependent operations accept the MdUserApi as an optional dependency.
"""

import json
import logging
from typing import Any, Dict, List, Optional, Set

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

        removed = 0
        for inst in instruments:
            if inst in self._subscriptions:
                self._subscriptions.discard(inst)
                removed += 1

        return {"success": True, "removed": removed}

    # ── Snapshot cache ────────────────────────────────────────────────

    @property
    def snapshot_count(self) -> int:
        return len(self._snapshots)

    def update_snapshot(self, data: dict) -> None:
        """Store or merge a market data snapshot."""
        inst_id = data.get("instrumentID", "")
        if not inst_id:
            return

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
