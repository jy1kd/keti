# md_demo.py - CTP API 字段结构探测程序
# 根据 design.md 确定的19个关键API类，输出完整字段结构
# 用于角色A开发参考和前端mock数据生成

import ctp
import warnings


def pascal_to_camel(name):
    """PascalCase转camelCase"""
    if not name:
        return name
    return name[0].lower() + name[1:]


def inspect_ctp_class(cls_name):
    """探测CTP类的字段结构"""
    cls = getattr(ctp, cls_name, None)
    if cls is None:
        print(f"\n[跳过] {cls_name} - 类不存在")
        return []

    print(f"\n{'='*60}")
    print(f"[探测] {cls_name}")
    print(f"{'='*60}")

    try:
        obj = cls()
    except Exception as e:
        print(f"[错误] 无法创建实例: {e}")
        return []

    fields = []
    for attr in dir(obj):
        if attr.startswith('_'):
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                value = getattr(obj, attr)
            if callable(value):
                continue
            field_type = type(value).__name__
            default = repr(value) if value is not None else "null"
            fields.append((attr, field_type, value))
            print(f"  {attr:30s} | {field_type:10s} | {default}")
        except UnicodeDecodeError:
            fields.append((attr, "str(gbk)", "[GBK编码]"))
            print(f"  {attr:30s} | str(gbk)   | [GBK编码]")
        except Exception as e:
            print(f"  {attr:30s} | [读取失败: {e}]")

    print(f"{'='*60}")
    print(f"[统计] 共 {len(fields)} 个字段")
    return fields


def fields_to_typescript(fields, interface_name):
    """将CTP字段转换为TypeScript接口定义"""
    ts_map = {
        'str': 'string',
        'str(gbk)': 'string',
        'int': 'number',
        'float': 'number',
        'bool': 'boolean',
    }

    lines = [f"export interface {interface_name} {{"]
    for name, py_type, value in fields:
        camel = pascal_to_camel(name)
        ts_type = ts_map.get(py_type, 'any')
        lines.append(f"  {camel}: {ts_type};")
    lines.append("}")
    return "\n".join(lines)


def fields_to_mock(fields, interface_name):
    """生成mock数据"""
    lines = [f"export const mock{interface_name}: {interface_name} = {{"]
    for name, py_type, value in fields:
        camel = pascal_to_camel(name)
        if py_type in ('str', 'str(gbk)'):
            safe_value = str(value).replace('"', '\\"')
            lines.append(f'  {camel}: "{safe_value}",')
        elif py_type == 'bool':
            lines.append(f"  {camel}: {'true' if value else 'false'},")
        else:
            lines.append(f"  {camel}: {value},")
    lines.append("};")
    return "\n".join(lines)


# ============ 根据 design.md 确定的19个关键API类 ============

# 认证相关
AUTH_CLASSES = [
    "CThostFtdcReqAuthenticateField",           # 客户端认证请求
    "CThostFtdcRspAuthenticateField",           # 客户端认证响应
]

# 登录相关
LOGIN_CLASSES = [
    "CThostFtdcReqUserLoginField",              # 登录请求
    "CThostFtdcRspUserLoginField",              # 登录响应
]

# 结算确认
SETTLEMENT_CLASSES = [
    "CThostFtdcReqSettlementInfoConfirmField",  # 结算确认请求
    "CThostFtdcRspSettlementInfoConfirmField",  # 结算确认响应
]

# 行情相关
MARKET_CLASSES = [
    "CThostFtdcDepthMarketDataField",           # 行情数据（五档深度）
    "CThostFtdcSpecificInstrumentField",        # 订阅响应
]

# 报单/成交
ORDER_CLASSES = [
    "CThostFtdcInputOrderField",                # 报单请求
    "CThostFtdcOrderField",                     # 报单回报
    "CThostFtdcTradeField",                     # 成交回报
]

# 撤单
CANCEL_CLASSES = [
    "CThostFtdcInputOrderActionField",          # 撤单请求
    "CThostFtdcOrderActionField",               # 撤单回报
]

# 查询相关
QUERY_CLASSES = [
    "CThostFtdcQryInstrumentField",             # 合约查询请求
    "CThostFtdcInstrumentField",                # 合约查询响应
    "CThostFtdcQryInvestorPositionField",       # 持仓查询请求
    "CThostFtdcInvestorPositionField",          # 持仓查询响应
    "CThostFtdcQryTradingAccountField",         # 资金查询请求
    "CThostFtdcTradingAccountField",            # 资金查询响应
]

ALL_CLASSES = AUTH_CLASSES + LOGIN_CLASSES + SETTLEMENT_CLASSES + MARKET_CLASSES + ORDER_CLASSES + CANCEL_CLASSES + QUERY_CLASSES


if __name__ == "__main__":
    print("=" * 60)
    print("CTP API 字段结构探测程序")
    print("=" * 60)
    print(f"ctp路径: {ctp.__file__}")
    print(f"待探测类: {len(ALL_CLASSES)} 个")
    print("=" * 60)

    # 探测所有类
    all_fields = {}
    for cls_name in ALL_CLASSES:
        fields = inspect_ctp_class(cls_name)
        if fields:
            all_fields[cls_name] = fields

    # 生成TypeScript接口
    print("\n\n" + "=" * 60)
    print("[生成] TypeScript接口")
    print("=" * 60)

    ts_map = {
        # 认证
        "CThostFtdcReqAuthenticateField": "AuthenticateRequest",
        "CThostFtdcRspAuthenticateField": "AuthenticateResponse",
        # 登录
        "CThostFtdcReqUserLoginField": "LoginRequest",
        "CThostFtdcRspUserLoginField": "LoginResponse",
        # 结算
        "CThostFtdcReqSettlementInfoConfirmField": "SettlementConfirmRequest",
        "CThostFtdcRspSettlementInfoConfirmField": "SettlementConfirmResponse",
        # 行情
        "CThostFtdcDepthMarketDataField": "MarketSnapshot",
        "CThostFtdcSpecificInstrumentField": "SubscribeResponse",
        # 报单
        "CThostFtdcInputOrderField": "OrderRequest",
        "CThostFtdcOrderField": "OrderReturn",
        "CThostFtdcTradeField": "TradeReturn",
        # 撤单
        "CThostFtdcInputOrderActionField": "CancelOrderRequest",
        "CThostFtdcOrderActionField": "CancelOrderReturn",
        # 查询
        "CThostFtdcQryInstrumentField": "QueryInstrumentRequest",
        "CThostFtdcInstrumentField": "InstrumentInfo",
        "CThostFtdcQryInvestorPositionField": "QueryPositionRequest",
        "CThostFtdcInvestorPositionField": "PositionInfo",
        "CThostFtdcQryTradingAccountField": "QueryAccountRequest",
        "CThostFtdcTradingAccountField": "AccountInfo",
    }

    for cls_name, fields in all_fields.items():
        ts_name = ts_map.get(cls_name, cls_name)
        print(f"\n// {cls_name}")
        print(fields_to_typescript(fields, ts_name))

    # 生成mock数据（仅核心类）
    print("\n\n" + "=" * 60)
    print("[生成] Mock数据（核心类）")
    print("=" * 60)

    mock_classes = [
        "CThostFtdcDepthMarketDataField",  # MarketSnapshot
        "CThostFtdcInputOrderField",       # OrderRequest
        "CThostFtdcOrderField",            # OrderReturn
        "CThostFtdcTradeField",            # TradeReturn
        "CThostFtdcInvestorPositionField", # PositionInfo
        "CThostFtdcTradingAccountField",   # AccountInfo
    ]

    for cls_name in mock_classes:
        if cls_name in all_fields:
            ts_name = ts_map.get(cls_name, cls_name)
            print(f"\n// {cls_name}")
            print(fields_to_mock(all_fields[cls_name], ts_name))

    print("\n\n" + "=" * 60)
    print("[完成] 所有字段结构已输出")
    print("=" * 60)
