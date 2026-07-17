"""Order API — submit, cancel, query orders (PR-9)."""

from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

router = APIRouter()


# ── Request models ───────────────────────────────────────────────────────

class InsertOrderRequest(BaseModel):
    """Submit order request body."""

    instrumentID: str = Field(..., min_length=1)
    direction: str = Field(default="0", pattern=r"^[01]$")
    offsetFlag: str = Field(default="0", pattern=r"^[013]$")
    priceType: str = Field(default="2", pattern=r"^[12]$")
    limitPrice: float = Field(default=0.0, ge=0.0)
    volumeTotalOriginal: int = Field(default=1, gt=0)
    timeCondition: str = Field(default="1", pattern=r"^[123]$")
    volumeCondition: str = Field(default="1", pattern=r"^[123]$")
    hedgeFlag: str = Field(default="1", pattern=r"^[123]$")

    @model_validator(mode="after")
    def validate_time_volume_condition(self):
        """Validate FOK/FAK volume condition constraints.

        CTP convention:
        - FOK (Fill or Kill, "2") → VolumeCondition CV ("3")
        - FAK (Fill and Kill, "3") → VolumeCondition AV ("1")
        - GFD ("1") accepts any volume condition.
        """
        tc = self.timeCondition
        vc = self.volumeCondition
        if tc == "2" and vc != "3":
            raise ValueError(
                "FOK (timeCondition=2) requires volumeCondition=CV (3)"
            )
        if tc == "3" and vc != "1":
            raise ValueError(
                "FAK (timeCondition=3) requires volumeCondition=AV (1)"
            )
        return self


class CancelOrderRequest(BaseModel):
    """Cancel order request body."""

    orderRef: str = Field(..., min_length=1)
    orderSysID: Optional[str] = ""


class ReverseOrderRequest(BaseModel):
    """Reverse position request body."""

    instrumentID: str = Field(..., min_length=1)


class LockOrderRequest(BaseModel):
    """Lock position request body."""

    instrumentID: str = Field(..., min_length=1)


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/insert")
async def insert_order(request: Request, body: InsertOrderRequest):
    """Submit a new order.

    Validates parameters and delegates to OrderManager.insert().
    """
    om = request.app.state.order_manager
    result = om.insert(
        instrument_id=body.instrumentID,
        direction=body.direction,
        offset_flag=body.offsetFlag,
        price_type=body.priceType,
        limit_price=body.limitPrice,
        volume=body.volumeTotalOriginal,
        time_condition=body.timeCondition,
        hedge_flag=body.hedgeFlag,
    )
    return result


@router.post("/cancel")
async def cancel_order(request: Request, body: CancelOrderRequest):
    """Cancel an existing order by orderRef."""
    om = request.app.state.order_manager
    return om.cancel(order_ref=body.orderRef, order_sys_id=body.orderSysID or "")


@router.get("/status/{order_ref}")
async def order_status(request: Request, order_ref: str):
    """Query order status by orderRef."""
    om = request.app.state.order_manager
    order = om.get_order(order_ref)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"success": True, "order": order}


@router.post("/cancel_all")
async def cancel_all_orders(request: Request):
    """Cancel all active orders."""
    om = request.app.state.order_manager
    result = om.cancel_all()
    return {"success": True, **result}


@router.post("/reverse")
async def reverse_position(request: Request, body: ReverseOrderRequest):
    """Reverse position — placeholder (PR-11).

    Requires position data from query API to determine current holding.
    """
    raise HTTPException(
        status_code=501,
        detail="Not implemented — position data needed (PR-11)",
    )


@router.post("/lock")
async def lock_position(request: Request, body: LockOrderRequest):
    """Lock position — placeholder (PR-11).

    Requires position data from query API to determine current holding.
    """
    raise HTTPException(
        status_code=501,
        detail="Not implemented — position data needed (PR-11)",
    )
