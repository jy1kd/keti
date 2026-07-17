"""CTP mapping utilities — convert between frontend human-readable strings and CTP char codes."""

# Direction mapping
DIRECTION_MAP = {
    'buy': '0',
    'sell': '1',
}
DIRECTION_REVERSE = {v: k for k, v in DIRECTION_MAP.items()}

# Offset flag mapping
OFFSET_FLAG_MAP = {
    'open': '0',
    'close': '1',
    'close_today': '3',
}
OFFSET_FLAG_REVERSE = {v: k for k, v in OFFSET_FLAG_MAP.items()}

# Order price type mapping
ORDER_PRICE_TYPE_MAP = {
    'market': '1',
    'limit': '2',
}
ORDER_PRICE_TYPE_REVERSE = {v: k for k, v in ORDER_PRICE_TYPE_MAP.items()}

# Time condition mapping
TIME_CONDITION_MAP = {
    'gfd': '1',  # Good For Day
    'fok': '2',  # Fill or Kill
    'fak': '3',  # Fill and Kill
}
TIME_CONDITION_REVERSE = {v: k for k, v in TIME_CONDITION_MAP.items()}

# Order status mapping
ORDER_STATUS_MAP = {
    'all_traded': '0',
    'partial': '1',
    'no_traded': '2',
    'canceled': '5',
}
ORDER_STATUS_REVERSE = {v: k for k, v in ORDER_STATUS_MAP.items()}

# Position direction mapping
POSITION_DIRECTION_MAP = {
    'long': '2',
    'short': '3',
}
POSITION_DIRECTION_REVERSE = {v: k for k, v in POSITION_DIRECTION_MAP.items()}


def direction_to_ctp(direction: str) -> str:
    """Convert frontend direction to CTP code."""
    return DIRECTION_MAP.get(direction, direction)


def direction_from_ctp(code: str) -> str:
    """Convert CTP direction code to frontend string."""
    return DIRECTION_REVERSE.get(code, code)


def offset_flag_to_ctp(flag: str) -> str:
    """Convert frontend offset flag to CTP code."""
    return OFFSET_FLAG_MAP.get(flag, flag)


def offset_flag_from_ctp(code: str) -> str:
    """Convert CTP offset flag code to frontend string."""
    return OFFSET_FLAG_REVERSE.get(code, code)


def order_price_type_to_ctp(price_type: str) -> str:
    """Convert frontend order price type to CTP code."""
    return ORDER_PRICE_TYPE_MAP.get(price_type, price_type)


def order_price_type_from_ctp(code: str) -> str:
    """Convert CTP order price type code to frontend string."""
    return ORDER_PRICE_TYPE_REVERSE.get(code, code)


def time_condition_to_ctp(condition: str) -> str:
    """Convert frontend time condition to CTP code."""
    return TIME_CONDITION_MAP.get(condition, condition)


def time_condition_from_ctp(code: str) -> str:
    """Convert CTP time condition code to frontend string."""
    return TIME_CONDITION_REVERSE.get(code, code)


def order_status_from_ctp(code: str) -> str:
    """Convert CTP order status code to frontend string."""
    return ORDER_STATUS_REVERSE.get(code, code)


def position_direction_from_ctp(code: str) -> str:
    """Convert CTP position direction code to frontend string."""
    return POSITION_DIRECTION_REVERSE.get(code, code)


def convert_order_request_to_ctp(data: dict) -> dict:
    """Convert frontend OrderRequest to CTP format.

    Frontend sends human-readable strings:
        direction: 'buy' | 'sell'
        combOffsetFlag: 'open' | 'close' | 'close_today'
        orderPriceType: 'limit' | 'market'
        timeCondition: 'gfd' | 'fok' | 'fak'

    CTP expects char codes:
        direction: '0' (buy) | '1' (sell)
        combOffsetFlag: '0' (open) | '1' (close) | '3' (close_today)
        orderPriceType: '1' (market) | '2' (limit)
        timeCondition: '1' (GFD) | '2' (FOK) | '3' (FAK)
    """
    result = data.copy()

    if 'direction' in result:
        result['direction'] = direction_to_ctp(result['direction'])

    if 'combOffsetFlag' in result:
        result['offsetFlag'] = offset_flag_to_ctp(result.pop('combOffsetFlag'))

    if 'orderPriceType' in result:
        result['priceType'] = order_price_type_to_ctp(result.pop('orderPriceType'))

    if 'timeCondition' in result:
        result['timeCondition'] = time_condition_to_ctp(result['timeCondition'])

    return result


def convert_order_return_from_ctp(data: dict) -> dict:
    """Convert CTP OrderReturn to frontend format.

    CTP sends char codes:
        direction: '0' | '1'
        orderStatus: '0' | '1' | '2' | '5'

    Frontend expects:
        direction: 'buy' | 'sell'
        orderStatus: 'all_traded' | 'partial' | 'no_traded' | 'canceled'
    """
    result = data.copy()

    if 'direction' in result:
        result['direction'] = direction_from_ctp(result['direction'])

    if 'orderStatus' in result:
        result['orderStatus'] = order_status_from_ctp(result['orderStatus'])

    if 'offsetFlag' in result:
        result['combOffsetFlag'] = offset_flag_from_ctp(result.pop('offsetFlag'))

    return result


def convert_position_from_ctp(data: dict) -> dict:
    """Convert CTP position data to frontend format.

    CTP sends:
        posiDirection: '2' (long) | '3' (short)

    Frontend expects:
        posiDirection: 'long' | 'short'
    """
    result = data.copy()

    if 'posiDirection' in result:
        result['posiDirection'] = position_direction_from_ctp(result['posiDirection'])

    return result
