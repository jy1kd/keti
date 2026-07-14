"""Connection management API — login, logout, status.

POST /api/connection/login  — trigger CTP connection with credentials
POST /api/connection/logout — clear session state
GET  /api/connection/status — real CTP connection status
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from services.ctp_startup import connect_ctp

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
    """Trigger CTP connection with the provided credentials.

    If CTP is already connected with the same user, returns success immediately.
    If CTP is connected with a different user, returns error.
    If not connected, starts a background connection thread.
    The frontend should poll GET /status to monitor connection progress.
    """
    md_api = getattr(request.app.state, "md_api", None)

    # Already connected — check if same user
    if md_api is not None and md_api.login_status == "logged_in":
        connected_user = getattr(md_api, "config", None)
        if connected_user and getattr(connected_user, "user_id", None) == body.userID:
            return {"success": True, "message": "Already connected", "userID": body.userID}
        return {
            "success": False,
            "message": f"Already connected as different user. Restart to switch accounts.",
        }

    # Start CTP connection with provided credentials (non-blocking)
    try:
        connect_ctp(request.app, body.brokerID, body.userID, body.password)
    except Exception as exc:
        return {"success": False, "message": f"Connection failed: {exc}"}

    return {
        "success": True,
        "message": "Connection initiated. Poll /api/connection/status for progress.",
        "userID": body.userID,
    }


@router.post("/logout", response_model=LoginResponse)
async def logout(request: Request):
    """Clear session state.

    Note: CTP connections are long-lived. This only clears the HTTP-level state.
    The CTP connection remains active until the process restarts.
    """
    return {"success": True, "message": "Logged out. CTP connection remains active until restart."}


@router.get("/status", response_model=StatusResponse)
async def status(request: Request):
    """Return current CTP connection status.

    Reads real connection state from app.state.md_api when available
    (after auto-startup or /login). Falls back to disconnected otherwise.
    """
    md_api = getattr(request.app.state, "md_api", None)
    if md_api is not None:
        return {
            "loggedIn": md_api.login_status == "logged_in",
            "mdConnected": md_api.connection_status == "connected",
            "tdConnected": False,  # TD not started until PR-9
        }
    return {
        "loggedIn": False,
        "mdConnected": False,
        "tdConnected": False,
    }
