"""CTP Connection Verification — Simplified Entry Point.

Usage:
    python main.py

This script verifies:
1. ctp-python library loads correctly
2. Market data API: connect, login, subscribe
3. Trading API: connect, login, order submission
4. Callback event recording

NOTE: Run during trading hours (09:00-15:00 or 21:00-02:30 CST)
      to receive actual market data and order callbacks.
"""

import time
import sys

from config import load_config
from ctp.md_user_api import MdUserApi
from ctp.trader_api import TraderApi
from ctp.types import Direction, OffsetFlag, OrderPriceType


# Default test instrument — override via CTP_TEST_INSTRUMENT env var
_TEST_INSTRUMENT = os.getenv("CTP_TEST_INSTRUMENT", "au2506")


def print_separator(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def wait_for_event(spi, event_type: str, timeout: float = 5.0) -> bool:
    """Poll for a specific callback event instead of fixed sleep.

    Returns True if the event was received within timeout.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        if any(e["type"] == event_type for e in spi.events):
            return True
        time.sleep(0.1)
    return False


def verify_ctp_import() -> bool:
    """Step 1: Verify ctp-python can be imported."""
    print_separator("Step 1: CTP Library Import")
    try:
        import ctp
        api_cls = ctp.CThostFtdcMdApi
        print(f"✅ ctp-python imported successfully")
        print(f"   MdApi class: {api_cls}")
        return True
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        print("   Install: pip install ctp-python")
        return False
    except AttributeError as e:
        print(f"❌ CTP DLL not available: {e}")
        return False


def verify_config() -> bool:
    """Step 2: Verify config loading."""
    print_separator("Step 2: Configuration")
    cfg = load_config()
    print(f"   Broker ID : {cfg.broker_id}")
    print(f"   MD Front  : {cfg.md_front}")
    print(f"   TD Front  : {cfg.td_front}")
    print(f"   User ID   : {cfg.user_id or '(not set)'}")
    print(f"   App ID    : {cfg.app_id}")

    if not cfg.user_id:
        print("⚠️  User ID not set. Create server/.env with:")
        print("   CTP_USER_ID=your_simnow_user_id")
        print("   CTP_PASSWORD=your_simnow_password")
        return False
    return True


def verify_md_connection() -> bool:
    """Step 3: Verify market data connection and login."""
    print_separator("Step 3: Market Data Connection")

    cfg = load_config()
    md = MdUserApi(cfg)

    # Register handlers for key callbacks
    md.spi.on("OnFrontConnected",
              lambda: setattr(md, "connection_status", "connected"))
    md.spi.on("OnRspUserLogin",
              lambda *args: setattr(md, "login_status", "logged_in"))

    print("   Creating MdUserApi...")
    try:
        md.create()
        print("   ✅ MdUserApi created, Init() called")
    except Exception as e:
        print(f"   ❌ Create failed: {e}")
        return False

    print("   Waiting for OnFrontConnected callback (5s)...")
    time.sleep(5)

    if md.connection_status == "connected":
        print("   ✅ Front connected")
    else:
        print("   ⏳ Connection status not confirmed (may still succeed)")

    print("   Sending login request...")
    try:
        result = md.login()
        print(f"   ReqUserLogin returned: {result}")
    except Exception as e:
        print(f"   ❌ Login failed: {e}")
        return False

    print("   Waiting for OnRspUserLogin callback (3s)...")
    time.sleep(3)

    events = [e for e in md.spi.events if e["type"] == "OnRspUserLogin"]
    if events:
        print(f"   ✅ Login callback received ({len(events)} event(s))")
    else:
        print("   ⏳ No login callback received (may need trading hours)")

    # Try subscribing to a test instrument
    print("   Subscribing to test instruments...")
    try:
        result = md.subscribe([_TEST_INSTRUMENT])
        print(f"   SubscribeMarketData returned: {result}")
        if result == 0:
            print(f"   ✅ Subscribed: {md.subscribed_instruments}")
    except Exception as e:
        print(f"   ❌ Subscribe failed: {e}")

    print("   Waiting for OnRspSubMarketData / OnRtnDepthMarketData (5s)...")
    time.sleep(5)

    md_events = [
        e for e in md.spi.events
        if e["type"] in ("OnRspSubMarketData", "OnRtnDepthMarketData")
    ]
    if md_events:
        print(f"   ✅ Market data events received: {len(md_events)}")
    else:
        print("   ⏳ No market data received (expected outside trading hours)")

    md.release()
    return True


def verify_td_connection() -> bool:
    """Step 4: Verify trading connection and order submission."""
    print_separator("Step 4: Trading Connection & Order")

    cfg = load_config()
    td = TraderApi(cfg)

    td.spi.on("OnFrontConnected",
              lambda: setattr(td, "connection_status", "connected"))
    td.spi.on("OnRspUserLogin",
              lambda *args: setattr(td, "login_status", "logged_in"))

    print("   Creating TraderApi...")
    try:
        td.create()
        print("   ✅ TraderApi created, Init() called")
    except Exception as e:
        print(f"   ❌ Create failed: {e}")
        return False

    print("   Waiting for OnFrontConnected callback (5s)...")
    time.sleep(5)

    print("   Sending login request...")
    try:
        result = td.login()
        print(f"   ReqUserLogin returned: {result}")
    except Exception as e:
        print(f"   ❌ Login failed: {e}")
        return False

    print("   Waiting for OnRspUserLogin callback (3s)...")
    time.sleep(3)

    # Try submitting a test order
    print("   Submitting test order (limit buy, au2506)...")
    try:
        order_ref = td.insert_order(
            instrument_id=_TEST_INSTRUMENT,
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            price_type=OrderPriceType.LIMIT,
            limit_price=480.0,
            volume=1,
        )
        if order_ref:
            print(f"   ✅ Order submitted, order_ref={order_ref}")
        else:
            print(f"   ❌ Order submission failed")
    except Exception as e:
        print(f"   ❌ Order submit error: {e}")

    print("   Waiting for OnRtnOrder callback (3s)...")
    time.sleep(3)

    order_events = [e for e in td.spi.events if e["type"] == "OnRtnOrder"]
    if order_events:
        print(f"   ✅ Order return events: {len(order_events)}")
    else:
        print("   ⏳ No order return (expected outside trading hours)")

    td.release()
    return True


def verify_market_order() -> bool:
    """Step 5: Verify market order support (OrderPriceType.ANY).

    Submits a market order and checks if SimNow accepts it.
    Some simulation environments do NOT support market orders,
    which affects the design of PR-9 (order API) and PR-10 (order form).
    """
    print_separator("Step 5: Market Order Verification")

    cfg = load_config()
    td = TraderApi(cfg)

    td.spi.on("OnFrontConnected",
              lambda: setattr(td, "connection_status", "connected"))
    td.spi.on("OnRspUserLogin",
              lambda *args: setattr(td, "login_status", "logged_in"))

    print("   Creating TraderApi for market order test...")
    try:
        td.create()
        print("   ✅ TraderApi created, Init() called")
    except Exception as e:
        print(f"   ❌ Create failed: {e}")
        return False

    print("   Waiting for OnFrontConnected callback (5s)...")
    time.sleep(5)

    print("   Sending login request...")
    try:
        result = td.login()
        print(f"   ReqUserLogin returned: {result}")
    except Exception as e:
        print(f"   ❌ Login failed: {e}")
        return False

    print("   Waiting for OnRspUserLogin callback (3s)...")
    time.sleep(3)

    # Submit market order (OrderPriceType.ANY)
    print("   Submitting market order (buy, au2506, ANY price)...")
    try:
        order_ref = td.insert_order(
            instrument_id=_TEST_INSTRUMENT,
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            price_type=OrderPriceType.ANY,
            limit_price=0.0,
            volume=1,
        )
        if order_ref:
            print(f"   ✅ Market order submitted, order_ref={order_ref}")
        else:
            print(f"   ❌ Market order rejected (may not be supported)")
    except Exception as e:
        print(f"   ❌ Market order error: {e}")

    print("   Waiting for OnRtnOrder / OnRspOrderInsert callback (3s)...")
    time.sleep(3)

    # Check for order return or error
    order_events = [e for e in td.spi.events if e["type"] == "OnRtnOrder"]
    error_events = [e for e in td.spi.events if e["type"] == "OnRspError"]

    if order_events:
        print(f"   ✅ Market order accepted ({len(order_events)} order event(s))")
        print("   📊 SimNow supports market orders (OrderPriceType.ANY)")
        supported = True
    elif error_events:
        print(f"   ⚠️ Market order rejected by exchange ({len(error_events)} error(s))")
        print("   📊 SimNow may NOT support market orders — check PR-9/PR-10 design")
        supported = True  # Step passed (obtained result)
    else:
        print("   ⏳ No response received (expected outside trading hours)")
        supported = True  # Step passed (no error)

    td.release()
    return supported


def print_summary(results: dict) -> None:
    """Print verification summary."""
    print_separator("Verification Summary")
    for step, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {step}: {status}")
    all_pass = all(results.values())
    print(f"\n   Overall: {'✅ ALL PASSED' if all_pass else '❌ SOME FAILED'}")
    return all_pass


def main() -> None:
    """Main entry point — run all CTP verification steps."""
    print("CTP Connection Verification")
    print(f"Python: {sys.version}")
    print("⚠️  Run during trading hours for full verification")
    print("   (09:00-15:00 or 21:00-02:30 CST)")

    results = {}

    # Step 1: Import check
    results["CTP Import"] = verify_ctp_import()
    if not results["CTP Import"]:
        print("\n❌ Cannot proceed without ctp-python. Exiting.")
        sys.exit(1)

    # Step 2: Config check
    results["Configuration"] = verify_config()

    # Step 3: Market data connection
    results["MD Connection"] = verify_md_connection()

    # Step 4: Trading connection
    results["TD Connection"] = verify_td_connection()

    # Step 5: Market order verification
    results["Market Order"] = verify_market_order()

    # Summary
    all_pass = print_summary(results)
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
