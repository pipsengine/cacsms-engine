namespace Cacsms.Engine.Application.Decisioning;

public sealed class HybridDecisionService : IHybridDecisionService
{
    private static readonly HashSet<string> ValidModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Institutional",
        "Retail",
        "Hybrid"
    };

    public HybridDecisionResponse Evaluate(HybridDecisionRequest request)
    {
        var noTradeReasons = new List<string>();
        var evidence = new List<string>();

        if (string.IsNullOrWhiteSpace(request.Symbol))
        {
            noTradeReasons.Add("Symbol is required.");
        }

        if (!ValidModes.Contains(request.TradingMode))
        {
            noTradeReasons.Add("Trading mode must be Institutional, Retail, or Hybrid.");
        }

        var topDownBiasScore = ScoreTopDownBias(request, evidence);
        var macroScore = ScoreMacro(request, evidence);
        var marketMemoryScore = ScoreMarketMemory(request, evidence);
        var advancedAlgorithmScore = ScoreAdvancedAlgorithms(request, evidence);
        var institutionalScore = ScoreInstitutional(request, evidence);
        var retailScore = ScoreRetail(request, evidence);
        var hybridScore = request.TradingMode.Equals("Institutional", StringComparison.OrdinalIgnoreCase)
            ? Math.Round((macroScore * 0.18m) + (marketMemoryScore * 0.12m) + (advancedAlgorithmScore * 0.20m) + (institutionalScore * 0.50m), 2)
            : request.TradingMode.Equals("Retail", StringComparison.OrdinalIgnoreCase)
                ? Math.Round((macroScore * 0.12m) + (marketMemoryScore * 0.18m) + (advancedAlgorithmScore * 0.20m) + (retailScore * 0.50m), 2)
                : Math.Round((macroScore * 0.18m) + (marketMemoryScore * 0.17m) + (advancedAlgorithmScore * 0.22m) + (institutionalScore * 0.28m) + (retailScore * 0.15m), 2);

        ApplyRiskGates(request, hybridScore, noTradeReasons);

        var confidenceScore = Math.Clamp(hybridScore, 0, 100);
        if (confidenceScore < 85)
        {
            noTradeReasons.Add("Confidence is below the 85% execution gate.");
        }

        var recommendation = noTradeReasons.Count == 0 ? "Execute" : "NoTrade";
        var direction = ResolveDirection(request);
        var approvedRisk = recommendation == "Execute" ? ResolveRiskPercent(request, confidenceScore) : 0;

        return new HybridDecisionResponse(
            request.Symbol.Trim().ToUpperInvariant(),
            NormalizeMode(request.TradingMode),
            recommendation,
            recommendation == "Execute" ? direction : "None",
            confidenceScore,
            topDownBiasScore,
            macroScore,
            advancedAlgorithmScore,
            marketMemoryScore,
            institutionalScore,
            retailScore,
            hybridScore,
            approvedRisk,
            ResolveStrategy(request),
            ResolveLiquidityTarget(request, direction),
            ResolveInvalidation(request, direction),
            recommendation == "Execute" ? 15 : 0,
            noTradeReasons.Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
            evidence.Distinct(StringComparer.OrdinalIgnoreCase).ToArray());
    }

    private static decimal ScoreTopDownBias(HybridDecisionRequest request, ICollection<string> evidence)
    {
        var alignment = Math.Clamp(request.MultiTimeframeAlignmentScore, 0, 100);
        var conflictSafety = Math.Clamp(request.HigherTimeframeConflictScore, 0, 100);
        var executionConfirmation = Math.Clamp(request.ExecutionTimeframeConfirmationScore, 0, 100);
        var biasDirectionBonus = BiasAligned(request) ? 10 : 0;

        var score = Math.Round(
            (alignment * 0.50m)
            + (conflictSafety * 0.25m)
            + (executionConfirmation * 0.25m)
            + biasDirectionBonus,
            2);

        if (alignment >= 70)
        {
            evidence.Add("Multi-timeframe stack supports the trade direction.");
        }

        if (conflictSafety >= 80)
        {
            evidence.Add("Higher-timeframe conflict detector is clear.");
        }

        if (executionConfirmation >= 70)
        {
            evidence.Add("Execution timeframe confirms the higher-timeframe bias.");
        }

        return Math.Clamp(score, 0, 100);
    }

    private static decimal ScoreMarketMemory(HybridDecisionRequest request, ICollection<string> evidence)
    {
        var history = Math.Clamp(request.HistoricalSimilarityScore, 0, 100);
        var candle = Math.Clamp(request.CandleIntelligenceScore, 0, 100);
        var h8D1 = Math.Clamp(request.H8D1ProjectionScore, 0, 100);

        var score = Math.Round((history * 0.40m) + (candle * 0.35m) + (h8D1 * 0.25m), 2);

        if (history >= 70)
        {
            evidence.Add("Historical pattern memory supports this setup.");
        }

        if (candle >= 70)
        {
            evidence.Add("Candle intelligence confirms directional pressure.");
        }

        if (h8D1 >= 70)
        {
            evidence.Add("H8-to-D1 projection supports the daily candle direction.");
        }

        return Math.Clamp(score, 0, 100);
    }

    private static decimal ScoreAdvancedAlgorithms(HybridDecisionRequest request, ICollection<string> evidence)
    {
        var regime = Math.Clamp(request.RegimeModelScore, 0, 100);
        var marketMemory = ScoreMarketMemory(request, evidence);
        var ensemble = Math.Clamp(request.EnsemblePredictionScore, 0, 100);
        var bayesian = Math.Clamp(request.BayesianConfidenceScore, 0, 100);
        var calibration = Math.Clamp(request.ProbabilityCalibrationScore, 0, 100);
        var anomalySafety = Math.Clamp(request.AnomalyScore, 0, 100);
        var executionQuality = Math.Clamp(request.ExecutionQualityScore, 0, 100);

        var score = Math.Round(
            (regime * 0.12m)
            + (marketMemory * 0.18m)
            + (ensemble * 0.22m)
            + (bayesian * 0.20m)
            + (calibration * 0.12m)
            + (anomalySafety * 0.10m)
            + (executionQuality * 0.08m),
            2);

        if (ensemble >= 75)
        {
            evidence.Add("Ensemble prediction supports the trade.");
        }

        if (bayesian >= 75)
        {
            evidence.Add("Bayesian confidence update supports the trade.");
        }

        if (calibration >= 70)
        {
            evidence.Add("Probability calibration is healthy.");
        }

        if (anomalySafety >= 80)
        {
            evidence.Add("Anomaly detection is clear.");
        }

        if (executionQuality >= 75)
        {
            evidence.Add("Execution quality supports autonomous routing.");
        }

        return Math.Clamp(score, 0, 100);
    }

    private static decimal ScoreMacro(HybridDecisionRequest request, ICollection<string> evidence)
    {
        var macroBias = Math.Clamp(request.MacroBiasScore, 0, 100);
        var rateDifferential = Math.Clamp(request.InterestRateDifferentialScore, 0, 100);
        var cotPositioning = Math.Clamp(request.CotPositioningScore, 0, 100);
        var currencyStrength = Math.Clamp(request.CurrencyStrengthScore, 0, 100);
        var macroRisk = Math.Clamp(request.MacroRiskScore, 0, 100);

        var score = Math.Round(
            (macroBias * 0.30m)
            + (rateDifferential * 0.25m)
            + (currencyStrength * 0.25m)
            + (cotPositioning * 0.10m)
            + (macroRisk * 0.10m),
            2);

        if (macroBias >= 70)
        {
            evidence.Add("Macro bias supports the trade direction.");
        }

        if (rateDifferential >= 70)
        {
            evidence.Add("Interest-rate differential supports the selected pair.");
        }

        if (currencyStrength >= 70)
        {
            evidence.Add("Currency strength matrix confirms strong-vs-weak alignment.");
        }

        if (cotPositioning >= 70)
        {
            evidence.Add("COT positioning supports the slow-bias context.");
        }

        return Math.Clamp(score, 0, 100);
    }

    private static decimal ScoreInstitutional(HybridDecisionRequest request, ICollection<string> evidence)
    {
        decimal score = 20;

        AddIf(request.LiquiditySweep, 18, "Liquidity sweep detected.");
        AddIf(request.Displacement, 16, "Displacement confirms institutional intent.");
        AddIf(request.FairValueGap, 12, "Fair value gap provides continuation imbalance.");
        AddIf(request.OrderBlockRetest, 12, "Order block mitigation is present.");
        AddIf(request.BreakOfStructure, 10, "Break of structure confirms directional shift.");
        AddIf(BiasAligned(request), 8, "Higher timeframe and entry timeframe biases align.");
        AddIf(IsInstitutionalSession(request.Session), 6, "Session liquidity is suitable.");
        AddIf(IsTradableRegime(request.MarketRegime), 6, "Market regime supports active execution.");

        return Math.Clamp(score, 0, 100);

        void AddIf(bool condition, decimal points, string message)
        {
            if (!condition)
            {
                return;
            }

            score += points;
            evidence.Add(message);
        }
    }

    private static decimal ScoreRetail(HybridDecisionRequest request, ICollection<string> evidence)
    {
        decimal score = 18;

        AddIf(request.RetailTrendAligned, 18, "Retail trend alignment is present.");
        AddIf(request.SupportResistanceConfirmation, 16, "Support or resistance confirmation is present.");
        AddIf(request.PullbackConfirmation, 14, "Pullback continuation confirmation is present.");
        AddIf(BiasAligned(request), 12, "Retail and higher timeframe direction are aligned.");
        AddIf(request.RiskReward >= 2, 12, "Risk/reward clears the minimum 1:2 threshold.");
        AddIf(request.VolatilityScore is >= 35 and <= 75, 10, "Volatility is tradable.");

        return Math.Clamp(score, 0, 100);

        void AddIf(bool condition, decimal points, string message)
        {
            if (!condition)
            {
                return;
            }

            score += points;
            evidence.Add(message);
        }
    }

    private static void ApplyRiskGates(HybridDecisionRequest request, decimal score, ICollection<string> reasons)
    {
        if (request.NewsRisk)
        {
            reasons.Add("High-impact news risk is active.");
        }

        if (request.SpreadPoints > MaxSpreadFor(request.Symbol))
        {
            reasons.Add("Spread is above the allowed execution limit.");
        }

        if (request.SlippagePoints > 5)
        {
            reasons.Add("Slippage is above the allowed execution limit.");
        }

        if (request.RiskReward < 2)
        {
            reasons.Add("Risk/reward is below 1:2.");
        }

        if (request.MultiTimeframeAlignmentScore < 65)
        {
            reasons.Add("Multi-timeframe bias alignment is below threshold.");
        }

        if (request.HigherTimeframeConflictScore < 70)
        {
            reasons.Add("Higher-timeframe conflict is too high.");
        }

        if (request.ExecutionTimeframeConfirmationScore < 60)
        {
            reasons.Add("Execution timeframe confirmation is below threshold.");
        }

        if (request.MacroRiskScore < 45)
        {
            reasons.Add("Macro risk score is below the tradable threshold.");
        }

        if (request.MacroBiasScore < 50)
        {
            reasons.Add("Macro bias is not aligned with the trade idea.");
        }

        if (request.CurrencyStrengthScore < 55)
        {
            reasons.Add("Currency strength matrix does not confirm the pair.");
        }

        if (request.StrategyHealthScore < 60)
        {
            reasons.Add("Strategy health is below promotion threshold.");
        }

        if (request.HistoricalSimilarityScore < 55)
        {
            reasons.Add("Historical pattern similarity is below threshold.");
        }

        if (request.CandleIntelligenceScore < 60)
        {
            reasons.Add("Candle intelligence does not confirm directional pressure.");
        }

        if (request.H8D1ProjectionScore < 55)
        {
            reasons.Add("H8-to-D1 projection does not support the setup.");
        }

        if (request.RegimeModelScore < 55)
        {
            reasons.Add("Regime classifier does not support this setup.");
        }

        if (request.EnsemblePredictionScore < 65)
        {
            reasons.Add("Ensemble prediction score is below threshold.");
        }

        if (request.BayesianConfidenceScore < 65)
        {
            reasons.Add("Bayesian confidence is below threshold.");
        }

        if (request.ProbabilityCalibrationScore < 60)
        {
            reasons.Add("Probability calibration is below threshold.");
        }

        if (request.AnomalyScore < 75)
        {
            reasons.Add("Anomaly detection flagged unsafe market or execution behavior.");
        }

        if (request.ExecutionQualityScore < 70)
        {
            reasons.Add("Execution quality is below autonomous routing threshold.");
        }

        if (request.AccountDrawdownPercent >= 6)
        {
            reasons.Add("Account drawdown guardrail is active.");
        }

        if (request.DailyLossPercent >= 2)
        {
            reasons.Add("Daily loss guardrail is active.");
        }

        if (request.ConsecutiveLosses >= 3)
        {
            reasons.Add("Consecutive loss circuit breaker is active.");
        }

        if (request.VolatilityScore < 25 || request.VolatilityScore > 85)
        {
            reasons.Add("Volatility is outside the tradable band.");
        }

        if (score >= 85 && !request.Displacement && !request.RetailTrendAligned)
        {
            reasons.Add("Execution needs either institutional displacement or retail trend alignment.");
        }
    }

    private static decimal ResolveRiskPercent(HybridDecisionRequest request, decimal confidenceScore)
    {
        var baseRisk = Math.Clamp(request.RequestedRiskPercent, 0.10m, 0.25m);

        if (confidenceScore < 90 || request.AccountDrawdownPercent > 3 || request.ConsecutiveLosses > 0)
        {
            return Math.Min(baseRisk, 0.10m);
        }

        return baseRisk;
    }

    private static string ResolveDirection(HybridDecisionRequest request)
    {
        if (request.HigherTimeframeBias.Equals("Bullish", StringComparison.OrdinalIgnoreCase)
            && request.EntryTimeframeBias.Equals("Bullish", StringComparison.OrdinalIgnoreCase))
        {
            return "Buy";
        }

        if (request.HigherTimeframeBias.Equals("Bearish", StringComparison.OrdinalIgnoreCase)
            && request.EntryTimeframeBias.Equals("Bearish", StringComparison.OrdinalIgnoreCase))
        {
            return "Sell";
        }

        return "Wait";
    }

    private static string ResolveStrategy(HybridDecisionRequest request)
    {
        if (request.LiquiditySweep && request.Displacement)
        {
            return "Liquidity Sweep Continuation";
        }

        if (request.OrderBlockRetest)
        {
            return "Order Block Mitigation";
        }

        if (request.FairValueGap)
        {
            return "Fair Value Gap Continuation";
        }

        if (request.PullbackConfirmation)
        {
            return "Pullback Continuation";
        }

        return "A-Grade Confluence";
    }

    private static string ResolveLiquidityTarget(HybridDecisionRequest request, string direction)
    {
        if (direction == "Buy")
        {
            return $"{request.Symbol.ToUpperInvariant()} buy-side liquidity";
        }

        if (direction == "Sell")
        {
            return $"{request.Symbol.ToUpperInvariant()} sell-side liquidity";
        }

        return "None";
    }

    private static string ResolveInvalidation(HybridDecisionRequest request, string direction)
    {
        if (direction == "Buy")
        {
            return "Below sweep low or protected order block.";
        }

        if (direction == "Sell")
        {
            return "Above sweep high or protected order block.";
        }

        return "No executable invalidation.";
    }

    private static bool BiasAligned(HybridDecisionRequest request)
    {
        return !request.HigherTimeframeBias.Equals("Neutral", StringComparison.OrdinalIgnoreCase)
            && request.HigherTimeframeBias.Equals(request.EntryTimeframeBias, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsInstitutionalSession(string session)
    {
        return session.Equals("London", StringComparison.OrdinalIgnoreCase)
            || session.Equals("New York", StringComparison.OrdinalIgnoreCase)
            || session.Equals("London-New York Overlap", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsTradableRegime(string marketRegime)
    {
        return marketRegime.Equals("Trending", StringComparison.OrdinalIgnoreCase)
            || marketRegime.Equals("Breakout", StringComparison.OrdinalIgnoreCase)
            || marketRegime.Equals("Pullback", StringComparison.OrdinalIgnoreCase);
    }

    private static decimal MaxSpreadFor(string symbol)
    {
        return symbol.Equals("XAUUSD", StringComparison.OrdinalIgnoreCase) ? 35 : 20;
    }

    private static string NormalizeMode(string tradingMode)
    {
        if (tradingMode.Equals("Institutional", StringComparison.OrdinalIgnoreCase))
        {
            return "Institutional";
        }

        if (tradingMode.Equals("Retail", StringComparison.OrdinalIgnoreCase))
        {
            return "Retail";
        }

        return "Hybrid";
    }
}
