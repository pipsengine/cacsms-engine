namespace Cacsms.Engine.Application.Decisioning;

public sealed record AdvancedAlgorithmRequest(
    decimal RegimeModelScore,
    decimal RulesModelScore,
    decimal StatisticalModelScore,
    decimal PatternClassifierScore,
    decimal MacroModelScore,
    decimal BayesianPrior,
    decimal EvidenceStrength,
    decimal ProbabilityCalibrationScore,
    decimal WalkForwardValidationScore,
    decimal AnomalyScore,
    decimal ExecutionQualityScore,
    decimal StrategyDecayScore);

public sealed record AdvancedAlgorithmResponse(
    decimal EnsemblePredictionScore,
    decimal BayesianConfidenceScore,
    decimal AdvancedAlgorithmScore,
    string Recommendation,
    IReadOnlyCollection<string> Reasons);

