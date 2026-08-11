"""Market data service — instrument cache, snapshot cache, subscription management.

Sits between API routes and CTP MdUserApi. Designed for testability:
all CTP-dependent operations accept the MdUserApi as an optional dependency.
"""

import json
import logging
import threading
from collections import defaultdict
from datetime import datetime
from pathlib import Path
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

    def _is_expired(self, inst: dict) -> bool:
        """过期判定：expireDate < 今天（YYYYMMDD）视为过期；缺失/当天/未来保留。

        CTP ReqQryInstrument 会返回历史/已过期合约，若不过滤，刷新后过期合约仍残留。
        """
        raw = str(inst.get("expireDate", "") or "").replace("-", "")
        if not raw:
            return False
        today = datetime.now().strftime("%Y%m%d")
        return raw < today

    def load_instruments(self, instruments: List[dict]) -> None:
        """Replace the instrument cache with a new list (过滤过期合约)."""
        self._instruments = [i for i in instruments if not self._is_expired(i)]

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
        return len(self._instruments)

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

    # ── Preset instruments ─────────────────────────────────────────────

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
        data = {"instruments": preset, "updatedAt": datetime.now().isoformat()}
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.warning("Failed to save preset to %s: %s", file_path, exc)
            return {"success": False, "message": str(exc)}

        return {"success": True, "instruments": preset}

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

        with self._lock:
            already: List[str] = []
            new_instruments: List[str] = []

            for inst in instruments:
                if inst in self._subscriptions:
                    already.append(inst)
                else:
                    new_instruments.append(inst)

            # Check limit BEFORE calling CTP (atomic check for batch)
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

        # CTP 订阅成功后才写入本地跟踪（先验证后记录）：
        # 避免「假成功」——本地已记录但 CTP 实际未订阅 → 前端永不重试 → 永久无数据。
        # 契约：subscribe_fn 返回 0=成功；非 0=失败；None 兼容旧测试钩子视为成功。
        if new_instruments and self._subscribe_fn is not None:
            try:
                ctp_result = self._subscribe_fn(new_instruments)
            except Exception as exc:
                logger.warning("CTP subscribe failed for %s", new_instruments, exc_info=True)
                return {
                    "success": False,
                    "added": 0,
                    "alreadySubscribed": already,
                    "message": f"CTP subscribe failed: {exc}",
                }
            if ctp_result is not None and ctp_result != 0:
                logger.warning("CTP subscribe returned %s for %s", ctp_result, new_instruments)
                return {
                    "success": False,
                    "added": 0,
                    "alreadySubscribed": already,
                    "message": f"CTP subscribe failed (code={ctp_result})",
                }

        if new_instruments:
            with self._lock:
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

        with self._lock:
            # Identify instruments to remove
            removed_instruments: List[str] = []
            for inst in instruments:
                if inst in self._subscriptions:
                    removed_instruments.append(inst)
            # 先从本地跟踪移除
            for inst in removed_instruments:
                self._subscriptions.discard(inst)

        # Call CTP UnSubscribeMarketData
        if removed_instruments and self._unsubscribe_fn is not None:
            try:
                self._unsubscribe_fn(removed_instruments)
            except Exception as exc:
                logger.warning("CTP unsubscribe failed for %s", removed_instruments, exc_info=True)
                # 本地已移除，即使 CTP 失败也保持本地状态一致
                return {
                    "success": False,
                    "removed": 0,
                    "message": f"CTP unsubscribe failed: {exc}",
                }

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
        with self._lock:
            return self._snapshots.get(instrument_id)

    def get_all_snapshots(self) -> List[dict]:
        """Return all cached snapshots as a list."""
        with self._lock:
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

        self._pending_instruments = []

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
            if self._on_instruments_callback:
                self._on_instruments_callback(count)

    def _save_instruments_to_file(self, file_path: str, instruments: List[dict]) -> None:
        """Save instrument list to a JSON file (过滤过期合约，保证落盘数据干净)."""
        import json
        try:
            instruments = [i for i in instruments if not self._is_expired(i)]
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(instruments, f, ensure_ascii=False, indent=2)
            logger.info("Saved %d instruments to %s", len(instruments), file_path)
        except OSError as exc:
            logger.warning("Failed to save instruments to %s: %s", file_path, exc)
