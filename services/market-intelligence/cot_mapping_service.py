"""Configurable CFTC market-name to CACSMS currency mapping."""
DEFAULT_MAPPINGS = {
    "AUD": "AUSTRALIAN DOLLAR", "CAD": "CANADIAN DOLLAR", "CHF": "SWISS FRANC",
    "EUR": "EURO FX", "GBP": "BRITISH POUND", "JPY": "JAPANESE YEN",
    "NZD": "NEW ZEALAND DOLLAR", "USD": "U.S. DOLLAR INDEX", "XAU": "GOLD",
}

class CotMappingService:
    def __init__(self, mappings=None):
        self.mappings = mappings or DEFAULT_MAPPINGS

    def filter_target_currencies(self, records):
        matched = []
        for record in records:
            market = record["market_name"].upper()
            for currency_code, expected_name in self.mappings.items():
                if expected_name in market:
                    matched.append({**record, "currency_code": currency_code, "currency_name": expected_name})
                    break
        return matched
