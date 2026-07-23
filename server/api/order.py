"""Order API — submit, cancel, query orders (PR-9)."""

import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request models ───────────────────────────────────────────────────────

class InsertOrderRequest(BaseModel):
    """Submit order request body."""

    instrumentID: str = Field(..., min_length=1,
                              json_schema_extra={"examples": ["IF2608"]})
    direction: str = Field(default="0", pattern=r"^[01]$",
                           description="0=买, 1=卖")
    offsetFlag: str = Field(default="0", pattern=r"^[013]$",
                            description="0=开仓, 1=平仓, 3=平今")
    priceType: str = Field(default="2", pattern=r"^[12]$",
                           description="1=市价, 2=限价")
    limitPrice: float = Field(default=4100.0, ge=0.0,
                              description="限价（priceType=2时必填）")
    volumeTotalOriginal: int = Field(default=1, gt=0)
    timeCondition: str = Field(default="1", pattern=r"^[123]$",
                               description="1=当日有效GFD, 2=即时FOK, 3=即时FAK")
    volumeCondition: str = Field(default="1", pattern=r"^[123]$",
                                 description="1=任意数量, 2=最小数量, 3=全部数量")
    hedgeFlag: str = Field(default="1", pattern=r"^[123]$",
                           description="1=投机, 2=套利, 3=套保")
    exchangeID: str = Field(default="CFFEX",
                            description="交易所（CFFEX/SHFE/CZCE/DCE/INE/GFEX）")

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


class SubmitStopOrderRequest(BaseModel):
    """Submit stop order request body."""

    instrumentID: str = Field(..., min_length=1,
                              json_schema_extra={"examples": ["IF2608"]})
    direction: str = Field(default="0", pattern=r"^[01]$",
                           description="0=买, 1=卖")
    offsetFlag: str = Field(default="0", pattern=r"^[013]$",
                            description="0=开仓, 1=平仓, 3=平今")
    limitPrice: float = Field(default=4800.0, ge=0.0,
                              description="触发后报单的限价")
    volume: int = Field(default=1, gt=0, description="报单数量")
    stopPrice: float = Field(..., gt=0.0, description="止损触发价")


class CancelStopOrderRequest(BaseModel):
    """Cancel stop order request body."""

    stopOrderID: str = Field(..., min_length=1)


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/insert")
async def insert_order(request: Request, body: InsertOrderRequest):
    """Submit a new order.

    Validates parameters and delegates to OrderManager.insert().
    """
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return {"success": False, "orderRef": "", "message": "TD not connected — call /api/connection/login first"}

    om = request.app.state.order_manager
    result = om.insert(
        instrument_id=body.instrumentID,
        exchange_id=body.exchangeID,
        direction=body.direction,
        offset_flag=body.offsetFlag,
        price_type=body.priceType,
        limit_price=body.limitPrice,
        volume=body.volumeTotalOriginal,
        time_condition=body.timeCondition,
        volume_condition=body.volumeCondition,
        hedge_flag=body.hedgeFlag,
    )
    return result


@router.post("/cancel")
async def cancel_order(request: Request, body: CancelOrderRequest):
    """Cancel an existing order by orderRef."""
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return {"success": False, "orderRef": body.orderRef, "message": "TD not connected — call /api/connection/login first"}

    om = request.app.state.order_manager
    logger.info("CANCEL orderRef=%s orderSysID=%s client=%s",
                body.orderRef, body.orderSysID, request.client.host if request.client else "?")
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
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return {"success": False, "orderRef": "", "message": "TD not connected — call /api/connection/login first"}

    logger.info("CANCEL_ALL client=%s", request.client.host if request.client else "?")
    om = request.app.state.order_manager
    result = om.cancel_all()
    logger.info("CANCEL_ALL result=%s", result)
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


# ── Stop order routes (PR-13) ──────────────────────────────────────────────

@router.post("/stop")
async def submit_stop_order(request: Request, body: SubmitStopOrderRequest):
    """Submit a new stop order.

    Creates a stop order that monitors market data and automatically
    submits an order when the stop price is reached.
    """
    stop_service = getattr(request.app.state, "stop_service", None)
    if stop_service is None:
        return {"success": False, "message": "StopOrderService not available"}

    result = stop_service.submit(
        instrument_id=body.instrumentID,
        direction=body.direction,
        offset_flag=body.offsetFlag,
        limit_price=body.limitPrice,
        volume=body.volume,
        stop_price=body.stopPrice,
    )
    return result


@router.post("/stop/cancel")
async def cancel_stop_order(request: Request, body: CancelStopOrderRequest):
    """Cancel a pending stop order."""
    stop_service = getattr(request.app.state, "stop_service", None)
    if stop_service is None:
        return {"success": False, "message": "StopOrderService not available"}

    result = stop_service.cancel(body.stopOrderID)
    return result


@router.get("/stop/list")
async def list_stop_orders(request: Request):
    """List all stop orders (pending, triggered, canceled)."""
    stop_service = getattr(request.app.state, "stop_service", None)
    if stop_service is None:
        return {"orders": [], "count": 0}

    orders = stop_service.list_orders()
    return {"orders": orders, "count": len(orders)}
