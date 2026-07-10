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


# ============ 自定义业务接口（CTP无原生接口，由后端实现） ============
CUSTOM_INTERFACES = """
// ============ 自定义业务接口 ============
// 以下接口CTP无原生API，由后端自行实现

// 期权T型报价（后端从合约列表 + 行情数据聚合）
export interface OptionChain {
  underlying: string;           // 标的合约
  expireDate: string;           // 到期日
  calls: OptionQuote[];         // 看涨期权列表（按行权价排序）
  puts: OptionQuote[];          // 看跌期权列表（按行权价排序）
  updateTime: string;           // 更新时间
}

export interface OptionQuote {
  instrumentID: string;         // 合约代码
  strikePrice: number;          // 行权价
  lastPrice: number;            // 最新价
  bidPrice: number;             // 买一价
  askPrice: number;             // 卖一价
  volume: number;               // 成交量
  openInterest: number;         // 持仓量
  impliedVolatility: number;    // 隐含波动率（Black-Scholes模型计算）
}

// 隐含波动率（后端Black-Scholes模型计算）
export interface VolatilityData {
  instrumentID: string;         // 合约代码
  impliedVolatility: number;    // 隐含波动率
  underlyingPrice: number;      // 标的资产价格
  strikePrice: number;          // 行权价
  timeToExpiry: number;         // 到期时间（年）
  riskFreeRate: number;         // 无风险利率
  optionType: string;           // 期权类型（'call'/'put'）
  updateTime: string;           // 更新时间
}
"""


def run_and_save():
    """运行探测并保存到文件"""
    import sys
    import os
    from datetime import datetime

    # 输出文件路径
    output_file = os.path.join(os.path.dirname(__file__), "docs", "ctp-api-structure.txt")

    # 同时输出到控制台和文件
    class Tee:
        def __init__(self, *files):
            self.files = files
        def write(self, obj):
            for f in self.files:
                f.write(obj)
                f.flush()
        def flush(self):
            for f in self.files:
                f.flush()

    with open(output_file, 'w', encoding='utf-8') as f:
        tee = Tee(sys.stdout, f)

        def print_tee(*args, **kwargs):
            print(*args, **kwargs, file=tee)

        print_tee("=" * 60)
        print_tee("CTP API 字段结构探测程序")
        print_tee(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print_tee("=" * 60)
        print_tee(f"ctp路径: {ctp.__file__}")
        print_tee(f"待探测类: {len(ALL_CLASSES)} 个")
        print_tee("=" * 60)

        # 探测所有类
        all_fields = {}
        for cls_name in ALL_CLASSES:
            fields = inspect_ctp_class(cls_name)
            if fields:
                all_fields[cls_name] = fields

        # 生成TypeScript接口
        print_tee("\n\n" + "=" * 60)
        print_tee("[生成] TypeScript接口")
        print_tee("=" * 60)

        ts_map = {
            "CThostFtdcReqAuthenticateField": "AuthenticateRequest",
            "CThostFtdcRspAuthenticateField": "AuthenticateResponse",
            "CThostFtdcReqUserLoginField": "LoginRequest",
            "CThostFtdcRspUserLoginField": "LoginResponse",
            "CThostFtdcReqSettlementInfoConfirmField": "SettlementConfirmRequest",
            "CThostFtdcRspSettlementInfoConfirmField": "SettlementConfirmResponse",
            "CThostFtdcDepthMarketDataField": "MarketSnapshot",
            "CThostFtdcSpecificInstrumentField": "SubscribeResponse",
            "CThostFtdcInputOrderField": "OrderRequest",
            "CThostFtdcOrderField": "OrderReturn",
            "CThostFtdcTradeField": "TradeReturn",
            "CThostFtdcInputOrderActionField": "CancelOrderRequest",
            "CThostFtdcOrderActionField": "CancelOrderReturn",
            "CThostFtdcQryInstrumentField": "QueryInstrumentRequest",
            "CThostFtdcInstrumentField": "InstrumentInfo",
            "CThostFtdcQryInvestorPositionField": "QueryPositionRequest",
            "CThostFtdcInvestorPositionField": "PositionInfo",
            "CThostFtdcQryTradingAccountField": "QueryAccountRequest",
            "CThostFtdcTradingAccountField": "AccountInfo",
        }

        for cls_name, fields in all_fields.items():
            ts_name = ts_map.get(cls_name, cls_name)
            print_tee(f"\n// {cls_name}")
            print_tee(fields_to_typescript(fields, ts_name))

        # 生成mock数据（仅核心类）
        print_tee("\n\n" + "=" * 60)
        print_tee("[生成] Mock数据（核心类）")
        print_tee("=" * 60)

        mock_classes = [
            "CThostFtdcDepthMarketDataField",
            "CThostFtdcInputOrderField",
            "CThostFtdcOrderField",
            "CThostFtdcTradeField",
            "CThostFtdcInvestorPositionField",
            "CThostFtdcTradingAccountField",
        ]

        for cls_name in mock_classes:
            if cls_name in all_fields:
                ts_name = ts_map.get(cls_name, cls_name)
                print_tee(f"\n// {cls_name}")
                print_tee(fields_to_mock(all_fields[cls_name], ts_name))

        # 输出自定义业务接口
        print_tee("\n\n" + "=" * 60)
        print_tee("[生成] 自定义业务接口（CTP无原生接口）")
        print_tee("=" * 60)
        print_tee(CUSTOM_INTERFACES)

        print_tee("\n\n" + "=" * 60)
        print_tee("[完成] 所有字段结构已输出")
        print_tee(f"[保存] 文件已保存到: {output_file}")
        print_tee("=" * 60)

    return output_file


if __name__ == "__main__":
    output = run_and_save()
    print(f"\n✅ 输出已保存到: {output}")
