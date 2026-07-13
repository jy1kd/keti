"""Order API — placeholder (full implementation in PR-9)."""

from fastapi import APIRouter

router = APIRouter()


@router.post("/insert")
async def insert_order():
    """Placeholder: submit order."""
    return {"success": False, "message": "Not implemented (PR-9)"}


@router.post("/cancel")
async def cancel_order():
    """Placeholder: cancel order."""
    return {"success": False, "message": "Not implemented (PR-9)"}
