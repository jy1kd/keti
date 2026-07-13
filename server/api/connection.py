"""Connection management API — login, logout, status.

POST /api/connection/login
POST /api/connection/logout
GET  /api/connection/status
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter()


class LoginRequest(BaseModel):
    brokerID: str = Field(..., min_length=1)
    userID: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str = ""
    userID: str = ""


class StatusResponse(BaseModel):
    loggedIn: bool
    mdConnected: bool = False
    tdConnected: bool = False


# ── In-memory state (persists per app instance) ──────────────────────

_logged_in: bool = False
_user_id: str = ""


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, body: LoginRequest):
    """Handle CTP login request."""
    global _logged_in, _user_id
    _logged_in = True
    _user_id = body.userID
    return {"success": True, "message": "Login successful", "userID": body.userID}


@router.post("/logout", response_model=LoginResponse)
async def logout(request: Request):
    """Handle logout — clears session state."""
    global _logged_in, _user_id
    _logged_in = False
    _user_id = ""
    return {"success": True, "message": "Logged out"}


@router.get("/status", response_model=StatusResponse)
async def status(request: Request):
    """Return current connection status."""
    return {
        "loggedIn": _logged_in,
        "mdConnected": _logged_in,  # Simplified: same as login until PR-5
        "tdConnected": _logged_in,
    }
