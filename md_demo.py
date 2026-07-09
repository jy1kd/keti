# md_demo.py - CTP API 字段结构探测程序
# 通过Python运行时自省获取真实字段，不依赖头文件
import ctp
import time
import json


def inspect_object(obj, name="对象"):
    """打印CTP对象的所有字段、类型、值"""
    import warnings
    print(f"\n{'='*60}")
    print(f"[探测] {name}")
    print(f"{'='*60}")

    fields = []
    for attr in dir(obj):
        if attr.startswith('_'):
            continue
        try:
            # 抑制编码警告
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                value = getattr(obj, attr)
            if callable(value):
                continue
            field_type = type(value).__name__
            fields.append((attr, field_type, value))
            print(f"  {attr:30s} | {field_type:10s} | {value}")
        except UnicodeDecodeError:
            # GBK编码字段，尝试手动解码
            try:
                raw = object.__getattribute__(obj, attr)
                if isinstance(raw, bytes):
                    value = raw.decode('gbk', errors='replace')
                else:
                    value = str(raw)
                field_type = "str(gbk)"
                fields.append((attr, field_type, value))
                print(f"  {attr:30s} | {field_type:10s} | {value}")
            except:
                fields.append((attr, "bytes", "[GBK编码，无法显示]"))
                print(f"  {attr:30s} | bytes      | [GBK编码，无法显示]")
        except Exception as e:
            print(f"  {attr:30s} | [读取失败: {e}]")

    print(f"{'='*60}")
    print(f"[统计] 共 {len(fields)} 个字段")
    return fields


def pascal_to_camel(name):
    """PascalCase转camelCase"""
    if not name:
        return name
    return name[0].lower() + name[1:]


def fields_to_typescript(fields, interface_name="MarketSnapshot"):
    """将CTP字段转换为TypeScript接口定义"""
    ts_map = {
        'str': 'string',
        'str(gbk)': 'string',
        'int': 'number',
        'float': 'number',
    }

    lines = [f"interface {interface_name} {{"]
    for name, py_type, value in fields:
        camel = pascal_to_camel(name)
        ts_type = ts_map.get(py_type, 'any')
        lines.append(f"  {camel}: {ts_type};  // {value}")
    lines.append("}")
    return "\n".join(lines)


def fields_to_mock(fields, interface_name="MarketSnapshot"):
    """生成mock数据"""
    lines = [f"const mock{interface_name} = {{"]
    for name, py_type, value in fields:
        camel = pascal_to_camel(name)
        if py_type in ('str', 'str(gbk)'):
            # 转义字符串中的引号
            safe_value = str(value).replace('"', '\\"')
            lines.append(f'  {camel}: "{safe_value}",')
        else:
            lines.append(f"  {camel}: {value},")
    lines.append("};")
    return "\n".join(lines)


class MyMdSpi(ctp.CThostFtdcMdSpi):
    def __init__(self, api):
        super().__init__()
        self.api = api
        self.request_id = 0
        self.connected = False
        self.logged_in = False

    def OnFrontConnected(self):
        try:
            self.connected = True
            print("\n[回调] 连接成功，开始登录...")
            login_field = ctp.CThostFtdcReqUserLoginField()

            # 探测登录请求对象
            inspect_object(login_field, "CThostFtdcReqUserLoginField (登录请求)")

            login_field.BrokerID = "9999"
            login_field.UserID = "268326"
            login_field.Password = "703495jy!!!"
            ret = self.api.ReqUserLogin(login_field, self.request_id)
            print(f"[请求] 登录返回值: {ret}")
            self.request_id += 1
        except Exception as e:
            print(f"[异常] OnFrontConnected: {e}")

    def OnFrontDisconnected(self, nReason):
        print(f"[回调] 断开连接，原因码: {nReason}")

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        try:
            if pRspInfo is not None and pRspInfo.ErrorID != 0:
                print(f"[错误] 登录失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
                return
            self.logged_in = True
            print("\n[回调] 登录成功！")

            # 探测登录响应对象
            if pRspUserLogin is not None:
                inspect_object(pRspUserLogin, "CThostFtdcRspUserLoginField (登录响应)")

            # 探测错误信息对象
            if pRspInfo is not None:
                inspect_object(pRspInfo, "CThostFtdcRspInfoField (响应信息)")

            # 订阅行情
            instruments = ["au2506", "ag2506", "rb2510"]
            print(f"\n[请求] 订阅: {instruments}")
            ret = self.api.SubscribeMarketData(instruments)
            print(f"[请求] 订阅返回值: {ret}")
        except Exception as e:
            print(f"[异常] OnRspUserLogin: {e}")
            import traceback
            traceback.print_exc()

    def OnRspSubMarketData(self, pSpecificInstrument, pRspInfo, nRequestID, bIsLast):
        try:
            if pRspInfo is not None and pRspInfo.ErrorID != 0:
                print(f"[错误] 订阅失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            else:
                print(f"[回调] 订阅成功: {pSpecificInstrument.InstrumentID}")

            # 探测订阅响应对象
            if pSpecificInstrument is not None:
                inspect_object(pSpecificInstrument, "CThostFtdcSpecificInstrumentField (订阅响应)")
        except Exception as e:
            print(f"[异常] OnRspSubMarketData: {e}")

    def OnRtnDepthMarketData(self, pDepthMarketData):
        import warnings
        try:
            # 抑制编码警告
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")

                # 第一条数据：完整探测
                if not hasattr(self, '_market_data_inspected'):
                    self._market_data_inspected = True

                    fields = inspect_object(pDepthMarketData, "CThostFtdcDepthMarketDataField (行情数据)")

                    # 生成TypeScript接口
                    ts_code = fields_to_typescript(fields, "MarketSnapshot")
                    print(f"\n[生成] TypeScript接口:\n")
                    print(ts_code)

                    # 生成mock数据
                    mock_code = fields_to_mock(fields, "MarketSnapshot")
                    print(f"\n[生成] Mock数据:\n")
                    print(mock_code)

                    print("\n" + "="*60)
                    print("[提示] 已输出TypeScript接口和Mock数据")
                    print("[提示] 后续行情精简显示，Ctrl+C退出")
                    print("="*60 + "\n")
                else:
                    # 后续数据精简显示
                    print(f"[行情] {pDepthMarketData.InstrumentID} | "
                          f"最新: {pDepthMarketData.LastPrice} | "
                          f"买一: {pDepthMarketData.BidPrice1}x{pDepthMarketData.BidVolume1} | "
                          f"卖一: {pDepthMarketData.AskPrice1}x{pDepthMarketData.AskVolume1} | "
                          f"量: {pDepthMarketData.Volume}")
        except Exception as e:
            print(f"[异常] OnRtnDepthMarketData: {e}")
            import traceback
            traceback.print_exc()


def inspect_ctp_class(cls_name):
    """直接探测CTP类的字段结构（不需要连接）"""
    import warnings
    cls = getattr(ctp, cls_name, None)
    if cls is None:
        print(f"[错误] 类 {cls_name} 不存在")
        return []

    print(f"\n{'='*60}")
    print(f"[探测] {cls_name}")
    print(f"{'='*60}")

    # 创建空实例
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
            # 获取默认值
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


if __name__ == "__main__":
    print("=" * 50)
    print("CTP API 字段结构探测程序")
    print("=" * 50)

    # 探测API版本信息
    print("\n[探测] ctp模块信息:")
    print(f"  ctp版本: {getattr(ctp, '__version__', '未知')}")
    print(f"  ctp路径: {ctp.__file__}")

    # 列出所有CTP类
    print("\n[探测] ctp中可用的类:")
    ctp_classes = [x for x in dir(ctp) if x.startswith('CThostFtdc')]
    print(f"  共 {len(ctp_classes)} 个类")

    # 探测关键数据结构（不需要连接）
    key_classes = [
        # 行情相关
        "CThostFtdcDepthMarketDataField",       # 行情数据
        "CThostFtdcReqUserLoginField",           # 登录请求
        "CThostFtdcRspUserLoginField",           # 登录响应
        "CThostFtdcSpecificInstrumentField",     # 订阅响应
        # 交易相关
        "CThostFtdcInputOrderField",             # 报单请求
        "CThostFtdcOrderField",                  # 报单回报
        "CThostFtdcTradeField",                  # 成交回报
        "CThostFtdcInputOrderActionField",       # 撤单请求
        # 查询相关
        "CThostFtdcQryInvestorPositionField",    # 持仓查询请求
        "CThostFtdcInvestorPositionField",       # 持仓查询响应
        "CThostFtdcQryTradingAccountField",      # 资金查询请求
        "CThostFtdcTradingAccountField",         # 资金查询响应
    ]

    print(f"\n[探测] 关键数据结构（共{len(key_classes)}个）:")
    for cls_name in key_classes:
        inspect_ctp_class(cls_name)

    # 生成完整的TypeScript接口
    print("\n" + "="*60)
    print("[生成] TypeScript接口")
    print("="*60)

    # 行情数据接口
    fields = inspect_ctp_class("CThostFtdcDepthMarketDataField")
    if fields:
        print("\n// MarketSnapshot - 行情快照")
        print(fields_to_typescript(fields, "MarketSnapshot"))

    # 报单请求接口
    fields = inspect_ctp_class("CThostFtdcInputOrderField")
    if fields:
        print("\n// OrderRequest - 报单请求")
        print(fields_to_typescript(fields, "OrderRequest"))

    print("\n" + "="*60)
    print("[完成] 所有字段结构已输出")
    print("="*60)
