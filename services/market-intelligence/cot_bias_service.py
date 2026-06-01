"""Institutional bias scoring for COT positioning history."""
class CotBiasService:
    def score(self, record):
        long_positions = record["non_commercial_long"]
        short_positions = record["non_commercial_short"]
        net_positions = long_positions - short_positions
        open_interest = max(record["open_interest"], 1)
        net_percent = net_positions / open_interest * 100
        if net_percent >= 20:
            bias = "STRONG BULLISH"
        elif net_percent >= 5:
            bias = "BULLISH"
        elif net_percent <= -20:
            bias = "STRONG BEARISH"
        elif net_percent <= -5:
            bias = "BEARISH"
        else:
            bias = "NEUTRAL"
        return {**record, "long_positions": long_positions, "short_positions": short_positions, "net_positions": net_positions, "net_open_interest_percent": round(net_percent, 4), "bias": bias, "bias_confidence": min(95, 60 + round(abs(net_percent)))}
