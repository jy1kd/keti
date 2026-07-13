"""Query API — placeholder (full implementation in PR-11)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/positions")
async def get_positions():
    """Placeholder: return positions."""
    return {"positions": [], "count": 0}


@router.get("/account")
async def get_account():
    """Placeholder: return account info."""
    return {"balance": 0.0, "available": 0.0}


@router.get("/orders")
async def get_orders():
    """Placeholder: return order list."""
    return {"orders": [], "count": 0}
