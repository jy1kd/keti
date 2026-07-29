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
    # 平仓单参数
    closePriceType: str = Field(default="1", pattern=r"^[12]$",
                                description="平仓价格类型: 1=市价, 2=对价限价")
    closeLimitPrice: float = Field(default=0.0, ge=0.0,
                                   description="平仓限价（closePriceType=2时由前端计算填入）")
    closeTimeCondition: str = Field(default="3", pattern=r"^[13]$",
                                    description="平仓时间条件: 1=FAK(IOC), 3=GFD")
    # 开仓单参数
    openPriceType: str = Field(default="1", pattern=r"^[12]$",
                               description="开仓价格类型: 1=市价, 2=对价限价")
    openLimitPrice: float = Field(default=0.0, ge=0.0,
                                  description="开仓限价（openPriceType=2时由前端计算填入）")
    openTimeCondition: str = Field(default="3", pattern=r"^[13]$",
                                   description="开仓时间条件: 1=FAK(IOC), 3=GFD")
    # 执行模式
    executionMode: str = Field(default="serial", pattern=r"^(serial|parallel)$",
                               description="执行模式: serial=串行(平仓成交后再开仓), parallel=并行(同时下发)")


class LockOrderRequest(BaseModel):
    """Lock position request body."""

    instrumentID: str = Field(..., min_length=1)
    priceType: str = Field(default="1", pattern=r"^[12]$",
                           description="价格类型: 1=市价, 2=对价限价")
    limitPrice: float = Field(default=0.0, ge=0.0,
                              description="限价（priceType=2时由前端计算填入）")
    timeCondition: str = Field(default="3", pattern=r"^[13]$",
                               description="时间条件: 1=FAK(IOC), 3=GFD")


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


def _get_protection_price(request: Request, instrument_id: str) -> tuple:
    """获取市价单保护价（从行情快照获取，带回退链）。

    回退顺序：lastPrice → preClosePrice → openPrice

    Returns:
        tuple: (price, error_message)
        - 成功时 error_message 为 None
        - 失败时 price 为 0.0，error_message 为错误信息
    """
    market_svc = getattr(request.app.state, "market_service", None)
    snapshot = market_svc.get_snapshot(instrument_id) if market_svc else None
    if snapshot:
        for key in ("lastPrice", "preClosePrice", "openPrice"):
            price = snapshot.get(key, 0.0)
            if price > 0:
                return price, None
    return 0.0, f"无法获取 {instrument_id} 的行情，请先订阅行情"


def _volume_condition_for(time_condition: str) -> str:
    """根据时间条件返回对应的成交量条件。

    GFD → "1"（任意数量），FAK/IOC → "3"（FOK，全部成交否则撤）。
    """
    if time_condition == "1":
        return "3"  # FAK: IOC + 全部成交否则撤
    return "1"  # GFD: 任意数量


def _build_close_order_params(
    instrument_id: str,
    exchange_id: str,
    close_dir: str,
    offset_flag: str,
    volume: int,
    price_type: str,
    limit_price: float,
    time_condition: str,
    protection_price: float,
) -> dict:
    """构建平仓单参数。"""
    if price_type == "2":
        # 限价模式
        return dict(
            instrument_id=instrument_id,
            exchange_id=exchange_id,
            direction=close_dir,
            offset_flag=offset_flag,
            price_type="2",
            limit_price=limit_price,
            volume=volume,
            time_condition=time_condition,
            volume_condition=_volume_condition_for(time_condition),
            hedge_flag="1",
            stop_price=0.0,
        )
    else:
        # 市价模式
        return dict(
            instrument_id=instrument_id,
            exchange_id=exchange_id,
            direction=close_dir,
            offset_flag=offset_flag,
            price_type="1",
            limit_price=0.0,
            volume=volume,
            time_condition=time_condition,
            volume_condition=_volume_condition_for(time_condition),
            hedge_flag="1",
            stop_price=protection_price,
        )


def _build_open_order_params(
    instrument_id: str,
    exchange_id: str,
    open_dir: str,
    volume: int,
    price_type: str,
    limit_price: float,
    time_condition: str,
    protection_price: float,
) -> dict:
    """构建开仓单参数。"""
    if price_type == "2":
        return dict(
            instrument_id=instrument_id,
            exchange_id=exchange_id,
            direction=open_dir,
            offset_flag="0",
            price_type="2",
            limit_price=limit_price,
            volume=volume,
            time_condition=time_condition,
            volume_condition=_volume_condition_for(time_condition),
            hedge_flag="1",
            stop_price=0.0,
        )
    else:
        return dict(
            instrument_id=instrument_id,
            exchange_id=exchange_id,
            direction=open_dir,
            offset_flag="0",
            price_type="1",
            limit_price=0.0,
            volume=volume,
            time_condition=time_condition,
            volume_condition=_volume_condition_for(time_condition),
            hedge_flag="1",
            stop_price=protection_price,
        )


def _execute_reverse_parallel(
    om, target: list, body: ReverseOrderRequest, protection_price: float
) -> dict:
    """并行模式：平仓和开仓同时下发。"""
    results = []

    for pos in target:
        pos_dir = pos.get("posiDirection", "")
        volume = pos.get("position", 0)
        today_volume = pos.get("todayPosition", 0)
        yd_volume = pos.get("ydPosition", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        close_dir = "1" if pos_dir == "2" else "0"
        open_dir = "1" if pos_dir == "2" else "0"
        SHFE_EXCHANGES = {"SHFE", "INE"}
        close_success = True

        if exchange_id in SHFE_EXCHANGES and today_volume > 0:
            if yd_volume > 0:
                # 分两笔：先平今，再平昨
                params = _build_close_order_params(
                    body.instrumentID, exchange_id, close_dir, "3", today_volume,
                    body.closePriceType, body.closeLimitPrice,
                    body.closeTimeCondition, protection_price,
                )
                close_today_result = om.insert(**params)
                results.append({"action": "close_today", **close_today_result})
                if not close_today_result.get("success"):
                    close_success = False

                if yd_volume > 0 and close_success:
                    params = _build_close_order_params(
                        body.instrumentID, exchange_id, close_dir, "1", yd_volume,
                        body.closePriceType, body.closeLimitPrice,
                        body.closeTimeCondition, protection_price,
                    )
                    close_yd_result = om.insert(**params)
                    results.append({"action": "close_yesterday", **close_yd_result})
                    if not close_yd_result.get("success"):
                        close_success = False
            else:
                params = _build_close_order_params(
                    body.instrumentID, exchange_id, close_dir, "3", today_volume,
                    body.closePriceType, body.closeLimitPrice,
                    body.closeTimeCondition, protection_price,
                )
                close_result = om.insert(**params)
                results.append({"action": "close_today", **close_result})
                if not close_result.get("success"):
                    close_success = False
        else:
            params = _build_close_order_params(
                body.instrumentID, exchange_id, close_dir, "1", volume,
                body.closePriceType, body.closeLimitPrice,
                body.closeTimeCondition, protection_price,
            )
            close_result = om.insert(**params)
            results.append({"action": "close", **close_result})
            if not close_result.get("success"):
                close_success = False

        if not close_success:
            continue

        params = _build_open_order_params(
            body.instrumentID, exchange_id, open_dir, volume,
            body.openPriceType, body.openLimitPrice,
            body.openTimeCondition, protection_price,
        )
        open_result = om.insert(**params)
        results.append({"action": "open", **open_result})

    return {"success": True, "orders": results}


def _execute_reverse_serial(
    om, target: list, body: ReverseOrderRequest, protection_price: float
) -> dict:
    """串行模式：平仓全部成交后再发开仓委托。"""
    results = []

    for pos in target:
        pos_dir = pos.get("posiDirection", "")
        volume = pos.get("position", 0)
        today_volume = pos.get("todayPosition", 0)
        yd_volume = pos.get("ydPosition", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        close_dir = "1" if pos_dir == "2" else "0"
        open_dir = "1" if pos_dir == "2" else "0"
        SHFE_EXCHANGES = {"SHFE", "INE"}
        close_success = True
        total_close_volume = 0  # 平仓总手数

        # ── 平仓阶段 ──
        if exchange_id in SHFE_EXCHANGES and today_volume > 0:
            if yd_volume > 0:
                # 平今
                params = _build_close_order_params(
                    body.instrumentID, exchange_id, close_dir, "3", today_volume,
                    body.closePriceType, body.closeLimitPrice,
                    body.closeTimeCondition, protection_price,
                )
                close_today_result = om.insert(**params)
                results.append({"action": "close_today", **close_today_result})
                if close_today_result.get("success"):
                    total_close_volume += today_volume
                else:
                    close_success = False

                # 平昨
                if yd_volume > 0 and close_success:
                    params = _build_close_order_params(
                        body.instrumentID, exchange_id, close_dir, "1", yd_volume,
                        body.closePriceType, body.closeLimitPrice,
                        body.closeTimeCondition, protection_price,
                    )
                    close_yd_result = om.insert(**params)
                    results.append({"action": "close_yesterday", **close_yd_result})
                    if close_yd_result.get("success"):
                        total_close_volume += yd_volume
                    else:
                        close_success = False
            else:
                params = _build_close_order_params(
                    body.instrumentID, exchange_id, close_dir, "3", today_volume,
                    body.closePriceType, body.closeLimitPrice,
                    body.closeTimeCondition, protection_price,
                )
                close_result = om.insert(**params)
                results.append({"action": "close_today", **close_result})
                if close_result.get("success"):
                    total_close_volume += today_volume
                else:
                    close_success = False
        else:
            params = _build_close_order_params(
                body.instrumentID, exchange_id, close_dir, "1", volume,
                body.closePriceType, body.closeLimitPrice,
                body.closeTimeCondition, protection_price,
            )
            close_result = om.insert(**params)
            results.append({"action": "close", **close_result})
            if close_result.get("success"):
                total_close_volume += volume
            else:
                close_success = False

        if not close_success or total_close_volume <= 0:
            results.append({"action": "open_skipped", "reason": "平仓未成功"})
            continue

        # ── 开仓阶段 ──
        # 串行模式：平仓报单被接受后立即发开仓单
        # （wait_response 只等待报单回报，不等待成交）
        # 后续 Phase 2 可增加等待成交终态的逻辑
        params = _build_open_order_params(
            body.instrumentID, exchange_id, open_dir, total_close_volume,
            body.openPriceType, body.openLimitPrice,
            body.openTimeCondition, protection_price,
        )
        open_result = om.insert(**params)
        results.append({"action": "open", **open_result})

    return {"success": True, "orders": results}


@router.post("/reverse")
async def reverse_position(request: Request, body: ReverseOrderRequest):
    """一键反向：平掉当前持仓，再以相反方向开仓。

    支持两种执行模式：
    - serial（串行）：先平仓，平仓被接受后再发开仓单
    - parallel（并行）：平仓和开仓同时下发

    支持两种价格模式：
    - 市价（priceType="1"）：使用行情快照保护价
    - 对价限价（priceType="2"）：使用前端传入的限价

    CTP posiDirection: "2"=多头(买), "3"=空头(卖)
    """
    target, error = _get_valid_positions(request, body.instrumentID)
    if error:
        return {"success": False, "message": error}

    om = request.app.state.order_manager

    # 市价模式需要保护价
    protection_price = 0.0
    need_market_price = (
        body.closePriceType == "1" or body.openPriceType == "1"
    )
    if need_market_price:
        protection_price, price_error = _get_protection_price(request, body.instrumentID)
        if price_error:
            return {"success": False, "message": price_error}

    if body.executionMode == "serial":
        result = _execute_reverse_serial(om, target, body, protection_price)
    else:
        result = _execute_reverse_parallel(om, target, body, protection_price)

    return result


@router.post("/lock")
async def lock_position(request: Request, body: LockOrderRequest):
    """一键锁仓：在反方向开同等数量仓位，不平原有持仓。

    适用场景：对冲风险，保留原有持仓的同时建立反向仓位。
    操作顺序：仅反方向开仓，不平原有持仓。

    支持两种价格模式：
    - 市价（priceType="1"）：使用行情快照保护价
    - 对价限价（priceType="2"）：使用前端传入的限价

    CTP posiDirection: "2"=多头(买), "3"=空头(卖)
    """
    target, error = _get_valid_positions(request, body.instrumentID)
    if error:
        return {"success": False, "message": error}

    om = request.app.state.order_manager

    # 市价模式需要保护价
    protection_price = 0.0
    if body.priceType == "1":
        protection_price, price_error = _get_protection_price(request, body.instrumentID)
        if price_error:
            return {"success": False, "message": price_error}

    results = []

    for pos in target:
        pos_dir = pos.get("posiDirection", "")  # "2"=多, "3"=空
        volume = pos.get("position", 0)
        exchange_id = pos.get("exchangeID", "")
        if volume <= 0:
            continue

        # 锁仓：反方向开仓
        lock_dir = "1" if pos_dir == "2" else "0"
        params = _build_open_order_params(
            body.instrumentID, exchange_id, lock_dir, volume,
            body.priceType, body.limitPrice,
            body.timeCondition, protection_price,
        )
        result = om.insert(**params)
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
