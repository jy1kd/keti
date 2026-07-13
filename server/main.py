"""FastAPI Application Entry Point.

Usage:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import load_config
from api.connection import router as connection_router
from api.market import router as market_router
from api.order import router as order_router
from api.query import router as query_router
from ws.manager import WebSocketManager
from services.market_service import MarketService
from ws.handlers import (
    handle_market_ws,
    handle_order_ws,
    handle_position_ws,
    handle_stop_ws,
    handle_system_ws,
)


def create_app() -> FastAPI:
    """Factory: build and configure the FastAPI application."""
    app = FastAPI(title="Simnow Trader API", version="1.0.0")

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # REST routes
    app.include_router(connection_router, prefix="/api/connection", tags=["connection"])
    app.include_router(market_router, prefix="/api/market", tags=["market"])
    app.include_router(order_router, prefix="/api/order", tags=["order"])
    app.include_router(query_router, prefix="/api/query", tags=["query"])

    # WebSocket endpoints
    @app.websocket("/ws/market")
    async def ws_market(websocket: WebSocket):
        await handle_market_ws(websocket)

    @app.websocket("/ws/order")
    async def ws_order(websocket: WebSocket):
        await handle_order_ws(websocket)

    @app.websocket("/ws/position")
    async def ws_position(websocket: WebSocket):
        await handle_position_ws(websocket)

    @app.websocket("/ws/stop")
    async def ws_stop(websocket: WebSocket):
        await handle_stop_ws(websocket)

    @app.websocket("/ws/system")
    async def ws_system(websocket: WebSocket):
        await handle_system_ws(websocket)

    # Create and store ws_manager and market_service on app state
    ws_manager = WebSocketManager()
    app.state.ws_manager = ws_manager

    market_service = MarketService()
    # Load instrument cache from file (if available)
    import os as _os
    _instruments_path = _os.path.join(
        _os.path.dirname(__file__), "data", "instruments.json"
    )
    market_service.load_instruments_from_file(_instruments_path)
    app.state.market_service = market_service

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(exc),
                },
            },
        )

    return app


# ── Application instance ──────────────────────────────────────────────

app = create_app()
config = load_config()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
