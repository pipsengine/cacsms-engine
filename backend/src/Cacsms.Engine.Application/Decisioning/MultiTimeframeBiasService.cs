namespace Cacsms.Engine.Application.Decisioning;

public sealed class MultiTimeframeBiasService : IMultiTimeframeBiasService
{
    public MultiTimeframeBiasResponse Evaluate(MultiTimeframeBiasRequest request)
    {
        var frames = new[]
        {
            (Input: request.Monthly, Weight: 0.10m),
            (Input: request.Weekly, Weight: 0.15m),
            (Input: request.Daily, Weight: 0.25m),
            (Input: request.H8, Weight: 0.15m),
            (Input: request.H4, Weight: 0.15m),
            (Input: request.H1, Weight: 0.10m),
            (Input: request.M15, Weight: 0.10m)
        };

        var bullish = WeightedDirection(frames, "Bullish");
        var bearish = WeightedDirection(frames, "Bearish");
        var finalDirection = bullish > bearish ? "Bullish" : bearish > bullish ? "Bearish" : "Neutral";
        var alignment = Math.Round(Math.Max(bullish, bearish), 2);
        var intendedBias = NormalizeDirection(request.IntendedDirection);
        var htfConflict = CalculateHigherTimeframeConflict(request, finalDirection);
        var executionConfirmation = CalculateExecutionConfirmation(request, finalDirection);
        var reasons = BuildReasons(request, finalDirection, htfConflict, executionConfirmation);

        var tradePermission = finalDirection == "Neutral"
            ? "No Trade"
            : !finalDirection.Equals(intendedBias, StringComparison.OrdinalIgnoreCase)
                ? "Opposite Bias"
                : htfConflict < 70
                    ? "Wait for Alignment"
                    : executionConfirmation < 60
                        ? "Wait for Entry Confirmation"
                        : "Trade Allowed";

        var finalBias = finalDirection == "Neutral"
            ? "Neutral / mixed timeframe structure"
            : $"{finalDirection} bias across weighted timeframe stack";

        return new MultiTimeframeBiasResponse(
            finalBias,
            alignment,
            htfConflict,
            executionConfirmation,
            tradePermission,
            reasons);
    }

    private static decimal WeightedDirection(IEnumerable<(TimeframeBiasInput Input, decimal Weight)> frames, string direction)
    {
        return frames
            .Where(frame => frame.Input.Direction.Equals(direction, StringComparison.OrdinalIgnoreCase))
            .Sum(frame => frame.Weight * Clamp(frame.Input.Strength) * Clamp(frame.Input.Confidence) / 100m);
    }

    private static decimal CalculateHigherTimeframeConflict(MultiTimeframeBiasRequest request, string finalDirection)
    {
        if (finalDirection == "Neutral")
        {
            return 50;
        }

        var higherFrames = new[] { request.Monthly, request.Weekly, request.Daily, request.H8, request.H4 };
        var aligned = higherFrames.Count(frame => frame.Direction.Equals(finalDirection, StringComparison.OrdinalIgnoreCase));
        return Math.Round((aligned / (decimal)higherFrames.Length) * 100m, 2);
    }

    private static decimal CalculateExecutionConfirmation(MultiTimeframeBiasRequest request, string finalDirection)
    {
        if (finalDirection == "Neutral")
        {
            return 50;
        }

        var executionFrames = new[] { request.H1, request.M15 };
        var score = executionFrames.Sum(frame =>
            frame.Direction.Equals(finalDirection, StringComparison.OrdinalIgnoreCase)
                ? (Clamp(frame.Strength) + Clamp(frame.Confidence)) / 2m
                : 0);

        return Math.Round(score / executionFrames.Length, 2);
    }

    private static IReadOnlyCollection<string> BuildReasons(MultiTimeframeBiasRequest request, string finalDirection, decimal htfConflict, decimal executionConfirmation)
    {
        var reasons = new List<string>
        {
            $"MN={request.Monthly.Direction}, W1={request.Weekly.Direction}, D1={request.Daily.Direction}, H8={request.H8.Direction}, H4={request.H4.Direction}, H1={request.H1.Direction}, M15={request.M15.Direction}."
        };

        reasons.Add(htfConflict >= 70
            ? "Higher-timeframe stack is sufficiently aligned."
            : "Higher-timeframe stack has meaningful conflict.");

        reasons.Add(executionConfirmation >= 60
            ? "Execution timeframes confirm the final bias."
            : "Execution timeframes do not yet confirm the final bias.");

        reasons.Add(finalDirection == "Neutral"
            ? "No dominant weighted direction was found."
            : $"{finalDirection} is the dominant weighted direction.");

        return reasons;
    }

    private static string NormalizeDirection(string direction)
    {
        if (direction.Equals("Buy", StringComparison.OrdinalIgnoreCase) || direction.Equals("Bullish", StringComparison.OrdinalIgnoreCase))
        {
            return "Bullish";
        }

        if (direction.Equals("Sell", StringComparison.OrdinalIgnoreCase) || direction.Equals("Bearish", StringComparison.OrdinalIgnoreCase))
        {
            return "Bearish";
        }

        return "Neutral";
    }

    private static decimal Clamp(decimal value)
    {
        return Math.Clamp(value, 0, 100);
    }
}

