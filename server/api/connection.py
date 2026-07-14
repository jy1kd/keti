"""Connection management API — login, logout, status.

POST /api/connection/login  — trigger CTP connection with credentials
POST /api/connection/logout — disconnect CTP and clear state
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

    Guards against:
    - Already logged in with same user → return success
    - Already logged in with different user → return error
    - Connection thread already running → return error (prevent re-entry)
    """
    md_api = getattr(request.app.state, "md_api", None)

    # Already connected — check if same user
    if md_api is not None and md_api.login_status == "logged_in":
        connected_user = getattr(md_api, "config", None)
        if connected_user and getattr(connected_user, "user_id", None) == body.userID:
            return {"success": True, "message": "Already connected", "userID": body.userID}
        return {
            "success": False,
            "message": "Already connected as different user. Restart to switch accounts.",
        }

    # Connection thread already running — prevent re-entry
    ctp_thread = getattr(request.app.state, "ctp_thread", None)
    if ctp_thread is not None and ctp_thread.is_alive():
        return {
            "success": False,
            "message": "Connection in progress. Poll /api/connection/status.",
        }

    # Start CTP connection and wait for result
    try:
        result = connect_ctp(
            request.app, body.brokerID, body.userID, body.password,
            wait=True,
        )
        return result
    except Exception as exc:
        return {"success": False, "message": f"Connection failed: {exc}"}


@router.post("/logout", response_model=LoginResponse)
async def logout(request: Request):
    """Disconnect CTP and clear state.

    Releases the CTP API resources and clears app.state.md_api.
    The frontend should call login again to reconnect.
    """
    md_api = getattr(request.app.state, "md_api", None)
    if md_api is not None:
        try:
            md_api.release()
        except Exception:
            pass
        request.app.state.md_api = None

    # Clear the thread reference
    if hasattr(request.app.state, "ctp_thread"):
        request.app.state.ctp_thread = None

    return {"success": True, "message": "Logged out and CTP disconnected"}


@router.get("/status", response_model=StatusResponse)
async def status(request: Request):
    """Return current CTP connection status.

    Reads real connection state from app.state.md_api when available.
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
