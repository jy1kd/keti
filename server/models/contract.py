"""Contract / instrument models."""

from pydantic import BaseModel


class InstrumentInfo(BaseModel):
    """CTP instrument / contract info (camelCase)."""

    instrumentID: str
    instrumentName: str = ""
    exchangeID: str = ""
    productID: str = ""
    productClass: str = "1"  # "1"=futures, "2"=options, "3"=combination
    volumeMultiple: int = 1
    priceTick: float = 0.0
    expireDate: str = ""
    openDate: str = ""
    isTrading: int = 0
    longMarginRatio: float = 0.0
    shortMarginRatio: float = 0.0

    # Options fields
    optionsType: str = ""  # "1"=call, "2"=put
    strikePrice: float = 0.0
    underlyingInstrID: str = ""
    underlyingMultiple: float = 0.0
