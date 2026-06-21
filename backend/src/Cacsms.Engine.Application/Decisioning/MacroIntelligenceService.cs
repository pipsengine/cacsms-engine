namespace Cacsms.Engine.Application.Decisioning;

public sealed class MacroIntelligenceService : IMacroIntelligenceService
{
    public MacroIntelligenceResponse Evaluate(MacroIntelligenceRequest request)
    {
        var reasons = new List<string>();
        var pair = $"{request.BaseCurrency.Trim().ToUpperInvariant()}{request.QuoteCurrency.Trim().ToUpperInvariant()}";
        var strengthSpread = Math.Clamp(request.BaseCurrencyStrength - request.QuoteCurrencyStrength, -100, 100);
        var currencyStrengthScore = Math.Clamp(50 + strengthSpread, 0, 100);

        if (currencyStrengthScore >= 70)
        {
            reasons.Add("Base currency is meaningfully stronger than quote currency.");
        }
        else if (currencyStrengthScore <= 40)
        {
            reasons.Add("Currency strength is against the proposed long pair bias.");
        }
        else
        {
            reasons.Add("Currency strength is neutral or mixed.");
        }

        AddReason(request.InterestRateDifferentialScore, "Interest-rate differential");
        AddReason(request.CotPositioningScore, "COT positioning");
        AddReason(request.CentralBankBiasScore, "Central-bank bias");

        if (request.MacroRiskScore < 45)
        {
            reasons.Add("Macro event risk is too high for autonomous execution.");
        }

        var macroBiasScore = Math.Round(
            (currencyStrengthScore * 0.30m)
            + (Math.Clamp(request.InterestRateDifferentialScore, 0, 100) * 0.25m)
            + (Math.Clamp(request.CentralBankBiasScore, 0, 100) * 0.20m)
            + (Math.Clamp(request.CotPositioningScore, 0, 100) * 0.15m)
            + (Math.Clamp(request.MacroRiskScore, 0, 100) * 0.10m),
            2);

        var recommendation = macroBiasScore >= 70 && request.MacroRiskScore >= 45
            ? "MacroAligned"
            : macroBiasScore >= 55 && request.MacroRiskScore >= 45
                ? "MacroNeutral"
                : "MacroBlocked";

        return new MacroIntelligenceResponse(
            pair,
            macroBiasScore,
            currencyStrengthScore,
            Math.Clamp(request.InterestRateDifferentialScore, 0, 100),
            Math.Clamp(request.CotPositioningScore, 0, 100),
            Math.Clamp(request.CentralBankBiasScore, 0, 100),
            Math.Clamp(request.MacroRiskScore, 0, 100),
            recommendation,
            reasons);

        void AddReason(decimal value, string label)
        {
            if (value >= 70)
            {
                reasons.Add($"{label} supports the pair.");
            }
            else if (value < 45)
            {
                reasons.Add($"{label} is weak or conflicts with the pair.");
            }
        }
    }
}

