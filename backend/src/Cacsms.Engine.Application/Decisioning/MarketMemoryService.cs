namespace Cacsms.Engine.Application.Decisioning;

public sealed class MarketMemoryService : IMarketMemoryService
{
    public MarketMemoryResponse Evaluate(MarketMemoryRequest request)
    {
        var reasons = new List<string>();
        var historical = Math.Round((Clamp(request.HistoricalSimilarityScore) * 0.55m) + (Clamp(request.SimilarCaseWinRate) * 0.45m), 2);
        var candle = Math.Round(
            (Clamp(request.CandleBodyScore) * 0.30m)
            + (Clamp(request.WickRejectionScore) * 0.25m)
            + (Clamp(request.CloseLocationScore) * 0.25m)
            + (Clamp(request.CandleSequenceScore) * 0.20m),
            2);
        var h8D1 = Math.Round(
            (Clamp(request.AsianH8Score) * 0.20m)
            + (Clamp(request.LondonH8Score) * 0.35m)
            + (Clamp(request.NewYorkH8Score) * 0.25m)
            + (Clamp(request.D1ProjectionConfidence) * 0.20m),
            2);
        var memory = Math.Round((historical * 0.40m) + (candle * 0.35m) + (h8D1 * 0.25m), 2);

        AddReason(historical, 60, "Historical pattern memory");
        AddReason(candle, 60, "Candle intelligence");
        AddReason(h8D1, 60, "H8-to-D1 projection");

        var recommendation = memory >= 75
            ? "MemoryAligned"
            : memory >= 60
                ? "MemoryNeutral"
                : "MemoryBlocked";

        return new MarketMemoryResponse(historical, candle, h8D1, memory, recommendation, reasons);

        void AddReason(decimal value, decimal threshold, string label)
        {
            reasons.Add(value >= threshold ? $"{label} passed." : $"{label} is below threshold.");
        }
    }

    private static decimal Clamp(decimal value)
    {
        return Math.Clamp(value, 0, 100);
    }
}

