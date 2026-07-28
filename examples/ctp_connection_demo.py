import ctp
import os
import time
from pathlib import Path

# 从环境变量读取配置
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / "server" / ".env")

BROKER_ID = os.getenv("CTP_BROKER_ID", "9999")
USER_ID = os.getenv("CTP_USER_ID", "")
PASSWORD = os.getenv("CTP_PASSWORD", "")
MD_FRONT = os.getenv("CTP_MD_FRONT", "tcp://182.254.243.31:40011")
INSTRUMENTS = [s.strip() for s in os.getenv("CTP_TEST_INSTRUMENT", "au2506").split(",")]

# 品种名称映射（合约前缀 → 品种名称）
PRODUCT_NAMES = {
    # === 中金所 股指 ===
    "IF": "沪深300", "IC": "中证500", "IH": "上证50", "IM": "中证1000",
    # === 中金所 国债 ===
    "T": "10年期国债", "TF": "5年期国债", "TS": "2年期国债", "TL": "30年期国债",
    # === 中金所 股指期权 ===
    "IO": "沪深300期权", "MO": "中证1000期权", "HO": "上证50期权",
    # === 上期所 有色金属 ===
    "cu": "铜", "al": "铝", "zn": "锌", "pb": "铅", "ni": "镍", "sn": "锡",
    "bc": "国际铜", "ao": "氧化铝", "br": "丁二烯橡胶", "nr": "20号胶",
    # === 上期所 贵金属 ===
    "au": "黄金", "ag": "白银",
    # === 上期所 黑色系 ===
    "rb": "螺纹钢", "hc": "热卷", "ss": "不锈钢", "wr": "线材", "ru": "天然橡胶",
    # === 上期所 能化 ===
    "fu": "燃油", "bu": "沥青", "sp": "纸浆", "lu": "低硫燃油", "sc": "原油",
    # === 上期所 期权 ===
    "au_o": "黄金期权", "cu_o": "铜期权",
    # === 上期能源 ===
    "ec": "集运指数", "lc": "碳酸锂", "si": "工业硅",
    # === 大商所 农产品 ===
    "m": "豆粕", "y": "豆油", "p": "棕榈油", "c": "玉米", "cs": "玉米淀粉",
    "a": "豆一", "b": "豆二", "jd": "鸡蛋", "lh": "生猪", "rr": "粳米",
    "bb": "胶合板", "fb": "纤维板",
    # === 大商所 化工 ===
    "l": "塑料", "v": "PVC", "pp": "聚丙烯", "eb": "苯乙烯", "eg": "乙二醇",
    "pg": "LPG", "j": "焦炭", "jm": "焦煤", "i": "铁矿石",
    # === 大商所 期权 ===
    "m_o": "豆粕期权", "i_o": "铁矿石期权",
    # === 郑商所 农产品 ===
    "CF": "棉花", "SR": "白糖", "OI": "菜油", "RM": "菜粕",
    "AP": "苹果", "CJ": "红枣", "PK": "花生", "CY": "棉纱",
    "RI": "粳稻", "WH": "强麦", "PM": "普麦", "RS": "菜籽",
    "JR": "粳稻", "LR": "晚稻",
    # === 郑商所 化工 ===
    "MA": "甲醇", "TA": "PTA", "FG": "玻璃", "SA": "纯碱", "UR": "尿素",
    "ZC": "动力煤", "SF": "硅铁", "SM": "锰硅", "PF": "涤纶短纤",
    "PX": "对二甲苯", "SH": "烧碱", "PR": "瓶片", "PL": "铂金",
    # === 郑商所 期权 ===
    "CF_o": "棉花期权", "SR_o": "白糖期权",
    # === 广期所 ===
    "lc": "碳酸锂", "si": "工业硅", "ps": "聚苯乙烯", "pd": "钯金", "pt": "铂金",
    "pl": "铂金", "lc_o": "碳酸锂期权",
    # === SimNow 新增（无中文名，按交易所推测）===
    "ad": "AD品种", "bz": "BZ品种", "lg": "LG品种", "op": "OP品种",
}


def get_product_name(instrument_id: str) -> str:
    """从合约代码提取品种名称，如 IF2608 → 沪深300"""
    # 提取字母前缀
    prefix = ""
    for ch in instrument_id:
        if ch.isalpha():
            prefix += ch
        else:
            break
    return PRODUCT_NAMES.get(prefix, prefix)


# 1. 创建自定义的SPI类，用于处理服务器回调
class MyMdSpi(ctp.CThostFtdcMdSpi):
    def __init__(self, api):
        super().__init__()
        self.api = api
        self.request_id = 0

    def OnFrontConnected(self):
        """成功连接到行情前置机时触发"""
        print("行情前置机连接成功，开始登录")
        # 构造登录请求字段
        login_field = ctp.CThostFtdcReqUserLoginField()
        login_field.BrokerID = BROKER_ID
        login_field.UserID = USER_ID
        login_field.Password = PASSWORD
        # 发送登录请求
        self.api.ReqUserLogin(login_field, self.request_id)
        self.request_id += 1

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录请求的响应"""
        if pRspInfo is not None and pRspInfo.ErrorID != 0:
            print(f"行情登录失败，错误代码: {pRspInfo.ErrorID}, 错误信息: {pRspInfo.ErrorMsg}")
            return
        print("行情服务器登录成功")
        # 登录成功后，订阅合约行情
        self.api.SubscribeMarketData(INSTRUMENTS)

    def OnRtnDepthMarketData(self, pDepthMarketData):
        """接收到深度行情数据推送"""
        # CTP-Python已自动将GBK编码的字符串转换为UTF-8[^8]
        name = get_product_name(pDepthMarketData.InstrumentID)
        print(f"合约: {pDepthMarketData.InstrumentID}({name}), "
              f"最新价: {pDepthMarketData.LastPrice}, "
              f"成交量: {pDepthMarketData.Volume}")


# 2. 主程序流程
if __name__ == "__main__":
    # 创建行情API实例
    md_api = ctp.CThostFtdcMdApi.CreateFtdcMdApi()
    # 创建我们的SPI实例并注册
    md_spi = MyMdSpi(md_api)
    md_api.RegisterSpi(md_spi)

    # 注册行情前置机地址
    md_api.RegisterFront(MD_FRONT)

    # 初始化API，开始连接
    md_api.Init()
    print(f"行情API初始化完成，前置地址: {MD_FRONT}，等待连接事件...")

    # 保持程序运行，等待回调事件
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n用户中断，释放API资源...")
        md_api.Release()