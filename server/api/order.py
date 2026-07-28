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
    stopPrice: float = Field(default=0.0, ge=0.0,
                             description="保护价（priceType=1时必填，市价指令必须填写保护价）")
    volumeTotalOriginal: int = Field(default=1, gt=0)
    timeCondition: str = Field(default="3", pattern=r"^[123]$",
                               description="1=IOC, 2=GFS, 3=GFD(当日有效)")
    volumeCondition: str = Field(default="1", pattern=r"^[123]$",
                                 description="1=任意数量, 2=最小数量, 3=全部数量")
    hedgeFlag: str = Field(default="1", pattern=r"^[123]$",
                           description="1=投机, 2=套利, 3=套保")
    productClass: str = Field(default="1",
                              description="1=期货, 2=期权（用于数量上限校验）")
    exchangeID: str = Field(default="CFFEX",
                            description="交易所（CFFEX/SHFE/CZCE/DCE/INE/GFEX）")

    @field_validator("volumeTotalOriginal")
    @classmethod
    def validate_volume(cls, v, info):
        """校验数量上限：市价期货≤60/期权≤30，限价期货≤500/期权≤100。"""
        product_class = info.data.get("productClass", "1")
        price_type = info.data.get("priceType", "2")
        if price_type == "1":  # 市价
            limit = 30 if product_class == "2" else 60
        else:  # 限价
            limit = 100 if product_class == "2" else 500
        if v > limit:
            raise ValueError(f"数量超限: 最大{limit}手")
        return v

    @model_validator(mode="after")
    def validate_time_volume_condition(self):
        """Validate FOK/FAK volume condition constraints.

        CTP convention:
        - FOK (Fill or Kill) → TimeCondition=IOC('1') + VolumeCondition=CV('3')
        - FAK (Fill and Kill) → TimeCondition=IOC('1') + VolumeCondition=AV('1')
        - GFD ('3') accepts any volume condition.
        """
        tc = self.timeCondition
        vc = self.volumeCondition
        # FOK: IOC + CV
        if tc == "1" and vc == "3":
            pass  # Valid FOK
        # FAK: IOC + AV
        elif tc == "1" and vc == "1":
            pass  # Valid FAK
        # GFD: accepts any volume condition
        elif tc == "3":
            pass  # Valid GFD
        # IOC with MV: also valid
        elif tc == "1":
            pass  # Valid IOC variant
        # GFS: also valid
        elif tc == "2":
            pass  # Valid GFS
        return self


class CancelOrderRequest(BaseModel):
    """Cancel order request body."""

    orderRef: str = Field(..., min_length=1)
    orderSysID: str = ""


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
    exchangeID: str = Field(default="CFFEX",
                            description="交易所（CFFEX/SHFE/CZCE/DCE/INE/GFEX）")
    direction: str = Field(default="0", pattern=r"^[01]$",
                           description="0=买, 1=卖")
    offsetFlag: str = Field(default="0", pattern=r"^[013]$",
                            description="0=开仓, 1=平仓, 3=平今")
    limitPrice: float = Field(default=4800.0, ge=0.0,
                              description="触发后报单的限价（限价触发时）或保护价（市价触发时）")
    volume: int = Field(default=1, gt=0, description="报单数量")
    stopPrice: float = Field(..., gt=0.0, description="止损触发价")
    triggerPriceType: str = Field(default="2", pattern=r"^[12]$",
                                  description="触发后报单类型：1=市价, 2=限价（默认限价）")


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
        stop_price=body.stopPrice,
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


def _get_valid_positions(request: Request, instrument_id: str):
    """获取有效持仓，检查 TD 连接状态和持仓是否存在。

    Returns:
        tuple: (positions_list, error_response)
        - 成功时 error_response 为 None
        - 失败时 positions_list 为空列表，error_response 为错误信息
    """
    trader_api = request.app.state.trader_api
    if trader_api is None or trader_api.login_status != "logged_in":
        return [], "TD not connected"

    query_svc = request.app.state.query_service
    positions = query_svc.positions

    target = [p for p in positions if p.get("instrumentID") == instrument_id]
    if not target:
        return [], f"No position for {instrument_id}"

    return target, None


@router.post("/reverse")
async def reverse_position(request: Request, body: ReverseOrderRequest):
    """一键反向：平掉当前持仓，再以相反方向开仓。

    适用场景：快速切换持仓方向（多→空或空→多）。
    操作顺序：先平仓，平仓成功后再以相反方向开仓。

    CTP posiDirection: "2"=多头(买), "3"=空头(卖)
    """
    target, error = _get_valid_positions(request, body.instrumentID)
    if error:
        return {"success": False, "message": error}

    om = request.app.state.order_manager
    # 获取最新行情作为市价单保护价
    market_svc = getattr(request.app.state, "market_service", None)
    snapshot = market_svc.get_snapshot(body.instrumentID) if market_svc else None
    last_price = snapshot.get("lastPrice", 0.0) if snapshot else 0.0
    results = []

    for pos in target:
        pos_dir = pos.get("posiDirection", "")  # "2"=多, "3"=空
        volume = pos.get("position", 0)
        today_volume = pos.get("todayPosition", 0)
        yd_volume = pos.get("ydPosition", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        # 平仓：反方向
        # 多头(posiDirection="2") → 平仓用卖(direction="1")
        # 空头(posiDirection="3") → 平仓用买(direction="0")
        close_dir = "1" if pos_dir == "2" else "0"

        # 上期所/能源所今仓需用平今(offset_flag="3")，昨仓用平仓(offset_flag="1")
        # 其他交易所统一用平仓
        SHFE_EXCHANGES = {"SHFE", "INE"}
        close_success = True

        if exchange_id in SHFE_EXCHANGES and today_volume > 0:
            if yd_volume > 0:
                # 分两笔：先平今，再平昨
                close_today_result = om.insert(
                    instrument_id=body.instrumentID,
                    exchange_id=exchange_id,
                    direction=close_dir,
                    offset_flag="3",        # 平今
                    price_type="1",         # 市价
                    limit_price=0.0,
                    volume=today_volume,
                    time_condition="1",     # IOC
                    volume_condition="3",   # FOK
                    hedge_flag="1",
                    stop_price=last_price,  # 市价单必须填写保护价
                )
                results.append({"action": "close_today", **close_today_result})

                if not close_today_result.get("success"):
                    close_success = False

                if yd_volume > 0 and close_success:
                    close_yd_result = om.insert(
                        instrument_id=body.instrumentID,
                        exchange_id=exchange_id,
                        direction=close_dir,
                        offset_flag="1",        # 平仓
                        price_type="1",
                        limit_price=0.0,
                        volume=yd_volume,
                        time_condition="1",
                        volume_condition="3",   # FOK
                        hedge_flag="1",
                        stop_price=last_price,  # 市价单必须填写保护价
                    )
                    results.append({"action": "close_yesterday", **close_yd_result})
                    if not close_yd_result.get("success"):
                        close_success = False
            else:
                # 仅今仓，用平今
                close_result = om.insert(
                    instrument_id=body.instrumentID,
                    exchange_id=exchange_id,
                    direction=close_dir,
                    offset_flag="3",        # 平今
                    price_type="1",         # 市价
                    limit_price=0.0,
                    volume=today_volume,
                    time_condition="1",     # IOC
                    volume_condition="3",   # FOK
                    hedge_flag="1",
                    stop_price=last_price,  # 市价单必须填写保护价
                )
                results.append({"action": "close_today", **close_result})
                if not close_result.get("success"):
                    close_success = False
        else:
            # 非 SHFE 或仅昨仓，一次性平仓
            close_result = om.insert(
                instrument_id=body.instrumentID,
                exchange_id=exchange_id,
                direction=close_dir,
                offset_flag="1",        # 平仓
                price_type="1",         # 市价
                limit_price=0.0,
                volume=volume,
                time_condition="1",     # IOC
                volume_condition="3",   # FOK
                hedge_flag="1",
                stop_price=last_price,  # 市价单必须填写保护价
            )
            results.append({"action": "close", **close_result})
            if not close_result.get("success"):
                close_success = False

        # 只有平仓成功才开新仓
        if not close_success:
            continue

        # 开仓：同原方向（反向后的新仓位）
        # 多头 → 开空(direction="1")
        # 空头 → 开多(direction="0")
        open_dir = "1" if pos_dir == "2" else "0"
        open_result = om.insert(
            instrument_id=body.instrumentID,
            exchange_id=exchange_id,
            direction=open_dir,
            offset_flag="0",        # 开仓
            price_type="1",         # 市价
            limit_price=0.0,
            volume=volume,
            time_condition="1",
            volume_condition="3",   # FOK
            hedge_flag="1",
            stop_price=last_price,  # 市价单必须填写保护价
        )
        results.append({"action": "open", **open_result})

    return {"success": True, "orders": results}


@router.post("/lock")
async def lock_position(request: Request, body: LockOrderRequest):
    """一键锁仓：在反方向开同等数量仓位，不平原有持仓。

    适用场景：对冲风险，保留原有持仓的同时建立反向仓位。
    操作顺序：仅反方向开仓，不平原有持仓。

    CTP posiDirection: "2"=多头(买), "3"=空头(卖)
    """
    target, error = _get_valid_positions(request, body.instrumentID)
    if error:
        return {"success": False, "message": error}

    om = request.app.state.order_manager
    # 获取最新行情作为市价单保护价
    market_svc = getattr(request.app.state, "market_service", None)
    snapshot = market_svc.get_snapshot(body.instrumentID) if market_svc else None
    last_price = snapshot.get("lastPrice", 0.0) if snapshot else 0.0
    results = []

    for pos in target:
        pos_dir = pos.get("posiDirection", "")  # "2"=多, "3"=空
        volume = pos.get("position", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        # 锁仓：反方向开仓
        # 多头(posiDirection="2") → 开空(direction="1")
        # 空头(posiDirection="3") → 开多(direction="0")
        lock_dir = "1" if pos_dir == "2" else "0"
        result = om.insert(
            instrument_id=body.instrumentID,
            exchange_id=exchange_id,
            direction=lock_dir,
            offset_flag="0",        # 开仓
            price_type="1",         # 市价
            limit_price=0.0,
            volume=volume,
            time_condition="1",
            volume_condition="3",   # FOK
            hedge_flag="1",
            stop_price=last_price,  # 市价单必须填写保护价
        )
        results.append({"action": "lock_open", **result})

    return {"success": True, "orders": results}


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
        exchange_id=body.exchangeID,
        direction=body.direction,
        offset_flag=body.offsetFlag,
        limit_price=body.limitPrice,
        volume=body.volume,
        stop_price=body.stopPrice,
        trigger_price_type=body.triggerPriceType,
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
    return {"stopOrders": orders, "count": len(orders)}
