namespace Cacsms.Engine.Application.Decisioning;

public sealed record MacroIntelligenceRequest(
    string BaseCurrency,
    string QuoteCurrency,
    decimal BaseCurrencyStrength,
    decimal QuoteCurrencyStrength,
    decimal InterestRateDifferentialScore,
    decimal CotPositioningScore,
    decimal CentralBankBiasScore,
    decimal MacroRiskScore);

public sealed record MacroIntelligenceResponse(
    string Pair,
    decimal MacroBiasScore,
    decimal CurrencyStrengthScore,
    decimal InterestRateDifferentialScore,
    decimal CotPositioningScore,
    decimal CentralBankBiasScore,
    decimal MacroRiskScore,
    string Recommendation,
    IReadOnlyCollection<string> Reasons);

