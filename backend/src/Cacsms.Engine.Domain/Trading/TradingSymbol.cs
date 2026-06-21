namespace Cacsms.Engine.Domain.Trading;

public sealed record TradingSymbol(string Code, TradingStyle AllowedStyle)
{
    public static readonly IReadOnlyCollection<TradingSymbol> Approved =
    [
        new("GBPUSD", TradingStyle.IntradayAndSwing),
        new("EURUSD", TradingStyle.IntradayAndSwing),
        new("AUDUSD", TradingStyle.IntradayAndSwing),
        new("USDJPY", TradingStyle.IntradayAndSwing),
        new("GBPJPY", TradingStyle.IntradayAndSwing),
        new("EURJPY", TradingStyle.IntradayAndSwing),
        new("USDCAD", TradingStyle.IntradayAndSwing),
        new("XAUUSD", TradingStyle.ScalpOnly),
        new("US30", TradingStyle.IntradayAndSwing),
        new("SP500", TradingStyle.IntradayAndSwing),
        new("NASDAQ100", TradingStyle.IntradayAndSwing)
    ];
}

public enum TradingStyle
{
    IntradayAndSwing,
    ScalpOnly
}
