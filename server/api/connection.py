"""Connection management API — login, logout, status.

POST /api/connection/login  — trigger TD connection with credentials
POST /api/connection/logout — disconnect both MD and TD
GET  /api/connection/status — real MD + TD connection status

Design:
  - MD (market data) does not require validated credentials;
    it connects at startup and runs regardless.
  - TD (trading) requires valid credentials.  /login triggers
    a TD connection and blocks until the result is known.
  - loggedIn reflects the TD login state (the "real" login).
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from services.ctp_startup import connect_trading

router = APIRouter()


class LoginRequest(BaseModel):
    brokerID: str = Field(..., min_length=1)
    userID: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    success: bool
    message: str = ""
    userID: str = ""


class StatusResponse(BaseModel):
    loggedIn: bool
    mdConnected: bool = False
    tdConnected: bool = False


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request):
    """Trigger TD connection with the provided credentials.

    MD runs independently — this endpoint only manages the trading
    connection (the one that actually validates credentials).

    Guards:
    - Already logged in with same user → return success
    - Connection thread already running → prevent re-entry
    """
    trader_api = getattr(request.app.state, "trader_api", None)

    # Already connected — check if same user
    if trader_api is not None and trader_api.login_status == "logged_in":
        connected_user = getattr(trader_api.config, "user_id", None)
        if connected_user == body.userID:
            return {"success": True, "message": "Already connected", "userID": body.userID}
        # Different user — connect_trading handles disconnect internally
        return {
            "success": False,
            "message": "Already connected as different user. Call /logout first.",
        }

    # Connection thread already running — prevent re-entry
    td_thread = getattr(request.app.state, "td_thread", None)
    if td_thread is not None and td_thread.is_alive():
        return {
            "success": False,
            "message": "Connection in progress. Poll /api/connection/status.",
        }

    # Start TD connection and wait for result
    try:
        result = connect_trading(
            request.app, body.brokerID, body.userID, body.password,
            wait=True,
        )
        return result
    except Exception as exc:
        return {"success": False, "message": f"Connection failed: {exc}"}


@router.post("/logout", response_model=LoginResponse)
async def logout(request: Request):
    """Disconnect both MD and TD connections.

    Releases CTP resources and clears app state.  The frontend
    should call login again to reconnect.
    """
    # Disconnect TD
    trader_api = getattr(request.app.state, "trader_api", None)
    if trader_api is not None:
        try:
            trader_api.release()
        except Exception:
            pass
        request.app.state.trader_api = None
        request.app.state.order_manager = None

    # Disconnect MD
    md_api = getattr(request.app.state, "md_api", None)
    if md_api is not None:
        try:
            md_api.release()
        except Exception:
            pass
        request.app.state.md_api = None

    # Clear thread references
    if hasattr(request.app.state, "ctp_thread"):
        request.app.state.ctp_thread = None
    if hasattr(request.app.state, "td_thread"):
        request.app.state.td_thread = None

    return {"success": True, "message": "Logged out — MD and TD disconnected"}


@router.get("/status", response_model=StatusResponse)
async def status(request: Request):
    """Return current CTP connection status.

    - mdConnected: whether the MD (market data) front is connected
    - tdConnected: whether the TD (trading) front is connected
    - loggedIn:    whether TD has authenticated (the real login state)
    """
    md_api = getattr(request.app.state, "md_api", None)
    trader_api = getattr(request.app.state, "trader_api", None)

    logged_in = False
    md_connected = False
    td_connected = False

    if md_api is not None:
        md_connected = md_api.connection_status == "connected"

    if trader_api is not None:
        td_connected = trader_api.connection_status == "connected"
        logged_in = trader_api.login_status == "logged_in"

    return {
        "loggedIn": logged_in,
        "mdConnected": md_connected,
        "tdConnected": td_connected,
    }
