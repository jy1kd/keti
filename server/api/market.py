"""Market data API — instruments, subscribe, unsubscribe, snapshots, kline, depth.

Uses MarketService from app.state.market_service for business logic.
"""

import asyncio
from pathlib import Path
from typing import List

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

router = APIRouter()


# ── Request models ──────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    instruments: List[str] = Field(..., min_length=1)


class UnsubscribeRequest(BaseModel):
    instruments: List[str] = Field(..., min_length=1)


# ── Helpers ─────────────────────────────────────────────────────────────

def _get_service(request: Request):
    """Dependency: get MarketService from app state."""
    return request.app.state.market_service


# ── Instruments ─────────────────────────────────────────────────────────

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


# ── Subscribe ───────────────────────────────────────────────────────────
@router.post("/subscribe")
async def subscribe(body: SubscribeRequest, request: Request):
    """Subscribe to market data for a list of instrument IDs.

    Returns: { success, added, alreadySubscribed, message? }
    """
    svc = _get_service(request)
    return svc.subscribe(body.instruments)


# ── Unsubscribe ─────────────────────────────────────────────────────────

@router.post("/unsubscribe")
async def unsubscribe(body: UnsubscribeRequest, request: Request):
    """Unsubscribe from market data for a list of instrument IDs.

    Returns: { success, removed }
    """
    svc = _get_service(request)
    return svc.unsubscribe(body.instruments)


# ── Snapshots ───────────────────────────────────────────────────────────

@router.get("/snapshots")
async def get_snapshots(request: Request, instruments: str = ""):
    """Get market data snapshots, optionally filtered by instrument IDs.

    Query param: instruments (comma-separated, e.g. "IF2608,IF2609")
    """
    svc = _get_service(request)

    if instruments:
        ids = [i.strip() for i in instruments.split(",") if i.strip()]
        result: dict = {}
        for inst_id in ids:
            snap = svc.get_snapshot(inst_id)
            if snap is not None:
                result[inst_id] = snap
        return {"snapshots": result}

    all_snaps = svc.get_all_snapshots()
    return {"snapshots": {s["instrumentID"]: s for s in all_snaps}}


# ── K-line ──────────────────────────────────────────────────────────────

@router.get("/kline")
async def get_kline(
    request: Request,
    instrument: str = Query(..., min_length=1),
    period: str = Query("1m"),
    count: int = Query(100, ge=1, le=500),
):
    """Get K-line (candlestick) data for an instrument.

    Returns real-time aggregated bars from the K-line service.
    Bars accumulate from server start (no historical data).

    Args:
        instrument: Instrument ID (e.g. "IF2608")
        period: Bar period — "1m", "5m", "15m", "30m", "1h"
        count: Number of bars to return (1-500, default 100)
    """
    kline_svc = getattr(request.app.state, "kline_service", None)
    if kline_svc is None:
        return {"instrumentID": instrument, "period": period, "bars": []}

    bars = kline_svc.get_klines(instrument, period, count)
    return {"instrumentID": instrument, "period": period, "bars": bars}


# ── Depth (5-level order book) ──────────────────────────────────────────

@router.post("/instruments/refresh")
async def refresh_instruments(request: Request):
    """Trigger instrument list refresh from CTP.

    Starts an async query to CTP ReqQryInstrument. Results arrive via
    OnRspQryInstrument callback and are saved to instruments.json.
    Returns immediately with {status: "started"} on success.
    """
    svc = _get_service(request)
    trader_api = getattr(request.app.state, "trader_api", None)

    if trader_api is None:
        return {"success": False, "message": "TraderApi not available"}

    # Build file path for saving results
    file_path = str(Path(__file__).parent.parent / "data" / "instruments.json")

    # Capture event loop in async context (callback runs in CTP thread)
    loop = asyncio.get_running_loop()

    # Wire callback: when CTP responds, save to file + notify
    def _on_complete(count: int):
        ws_manager = getattr(request.app.state, "ws_manager", None)
        if ws_manager:
            asyncio.run_coroutine_threadsafe(
                ws_manager.broadcast("system", "instruments_refreshed", {
                    "count": count,
                }),
                loop,
            )

    # The ctp_startup wiring will call on_instruments_result when data arrives
    result = svc.refresh_instruments_from_ctp(
        trader_api,
        callback=_on_complete,
    )

    if not result["success"]:
        return result

    return {"status": "started"}


@router.get("/depth")
async def get_depth(
    request: Request,
    instrument: str = Query(..., min_length=1),
):
    """Get 5-level bid/ask depth for an instrument.

    Pulls from the latest snapshot cache.
    """
    svc = _get_service(request)
    snap = svc.get_snapshot(instrument)

    if snap is None:
        return {
            "instrumentID": instrument,
            "bids": [],
            "asks": [],
        }

    bids = []
    asks = []
    for i in range(1, 6):
        b_vol = snap.get(f"bidVolume{i}", 0)
        if b_vol > 0:
            bids.append({
                "price": snap.get(f"bidPrice{i}", 0.0),
                "volume": b_vol,
            })
        a_vol = snap.get(f"askVolume{i}", 0)
        if a_vol > 0:
            asks.append({
                "price": snap.get(f"askPrice{i}", 0.0),
                "volume": a_vol,
            })

    return {
        "instrumentID": instrument,
        "bids": bids,
        "asks": asks,
    }
