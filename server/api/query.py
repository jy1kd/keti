"""Query API — orders, trades, positions, account, contracts.

Uses QueryService from app.state.query_service for business logic.
Uses MarketService from app.state.market_service for instrument queries.
"""

import asyncio
import logging

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────────────────

def _get_query_service(request: Request):
    """Dependency: get QueryService from app state."""
    return request.app.state.query_service


def _get_market_service(request: Request):
    """Dependency: get MarketService from app state."""
    return request.app.state.market_service


def _get_trader_api(request: Request):
    """Dependency: get TraderApi from app state."""
    return getattr(request.app.state, "trader_api", None)


# ── Positions ───────────────────────────────────────────────────────────

@router.get("/positions")
async def get_positions(request: Request):
    """Query investor positions from CTP.

    Returns cached positions from the last query. Use POST /positions/refresh
    to trigger a new CTP query.
    """
    svc = _get_query_service(request)
    positions = svc.positions
    return {"positions": positions, "count": len(positions)}


@router.post("/positions/refresh")
async def refresh_positions(request: Request):
    """Trigger a fresh position query from CTP.

    Blocks until CTP responds (up to 10s). Returns the results.
    """
    trader = _get_trader_api(request)
    if trader is None:
        return {"success": False, "message": "TraderApi not available"}
    if trader.login_status != "logged_in":
        return {"success": False, "message": "TraderApi not logged in"}

    svc = _get_query_service(request)
    loop = asyncio.get_running_loop()

    # Run blocking query in a thread to avoid blocking the event loop
    positions = await loop.run_in_executor(None, svc.query_positions, trader)

    if positions is None:
        return {"success": False, "message": "Position query failed or timed out"}

    # Push to WebSocket if available
    ws_manager = getattr(request.app.state, "ws_manager", None)
    if ws_manager and positions:
        await ws_manager.broadcast("position", "position_update", {
            "positions": positions,
            "count": len(positions),
        })

    return {"positions": positions, "count": len(positions)}


# ── Account ─────────────────────────────────────────────────────────────

@router.get("/account")
async def get_account(request: Request):
    """Query trading account funds from CTP.

    Returns cached account from the last query. Use POST /account/refresh
    to trigger a new CTP query.
    """
    svc = _get_query_service(request)
    account = svc.account
    return account or {"success": False, "message": "No account data cached"}


@router.post("/account/refresh")
async def refresh_account(request: Request):
    """Trigger a fresh account query from CTP.

    Blocks until CTP responds (up to 10s). Returns the results.
    """
    trader = _get_trader_api(request)
    if trader is None:
        return {"success": False, "message": "TraderApi not available"}
    if trader.login_status != "logged_in":
        return {"success": False, "message": "TraderApi not logged in"}

    svc = _get_query_service(request)
    loop = asyncio.get_running_loop()

    account = await loop.run_in_executor(None, svc.query_account, trader)

    if account is None:
        return {"success": False, "message": "Account query failed or timed out"}

    return account


# ── Orders ──────────────────────────────────────────────────────────────

@router.get("/orders")
async def get_orders(request: Request):
    """Query order list from CTP.

    Returns cached orders from the last query. Use POST /orders/refresh
    to trigger a new CTP query.
    """
    svc = _get_query_service(request)
    orders = svc.orders
    return {"orders": orders, "count": len(orders)}


@router.post("/orders/refresh")
async def refresh_orders(request: Request):
    """Trigger a fresh order query from CTP.

    Blocks until CTP responds (up to 10s). Returns the results.
    """
    trader = _get_trader_api(request)
    if trader is None:
        return {"success": False, "message": "TraderApi not available"}
    if trader.login_status != "logged_in":
        return {"success": False, "message": "TraderApi not logged in"}

    svc = _get_query_service(request)
    loop = asyncio.get_running_loop()

    orders = await loop.run_in_executor(None, svc.query_orders, trader)

    if orders is None:
        return {"success": False, "message": "Order query failed or timed out"}

    return {"orders": orders, "count": len(orders)}


# ── Trades ──────────────────────────────────────────────────────────────

@router.get("/trades")
async def get_trades(request: Request):
    """Query trade list from CTP.

    Returns cached trades from the last query. Use POST /trades/refresh
    to trigger a new CTP query.
    """
    svc = _get_query_service(request)
    trades = svc.trades
    return {"trades": trades, "count": len(trades)}


@router.post("/trades/refresh")
async def refresh_trades(request: Request):
    """Trigger a fresh trade query from CTP.

    Blocks until CTP responds (up to 10s). Returns the results.
    """
    trader = _get_trader_api(request)
    if trader is None:
        return {"success": False, "message": "TraderApi not available"}
    if trader.login_status != "logged_in":
        return {"success": False, "message": "TraderApi not logged in"}

    svc = _get_query_service(request)
    loop = asyncio.get_running_loop()

    trades = await loop.run_in_executor(None, svc.query_trades, trader)

    if trades is None:
        return {"success": False, "message": "Trade query failed or timed out"}

    return {"trades": trades, "count": len(trades)}


# ── Contracts ───────────────────────────────────────────────────────────

@router.get("/contracts")
async def get_contracts(request: Request, keyword: str = ""):
    """Query instrument/contract list.

    Searches across instrumentID, instrumentName, exchangeID, productID.
    Data comes from MarketService instrument cache (populated via
    POST /api/market/instruments/refresh).
    """
    svc = _get_market_service(request)
    contracts = svc.get_instruments(keyword=keyword)
    return {"contracts": contracts, "count": len(contracts)}
