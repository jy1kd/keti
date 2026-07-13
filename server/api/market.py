"""Market data API — placeholder (full implementation in PR-5)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/instruments")
async def get_instruments():
    """Placeholder: return empty contract list."""
    return {"instruments": [], "count": 0}


@router.post("/subscribe")
async def subscribe():
    """Placeholder: subscribe market data."""
    return {"success": False, "message": "Not implemented (PR-5)"}


@router.get("/snapshots")
async def get_snapshots():
    """Placeholder: return market snapshots."""
    return {"snapshots": {}}
