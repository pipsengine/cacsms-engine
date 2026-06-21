namespace Cacsms.Engine.Application.Decisioning;

public sealed class AdvancedAlgorithmService : IAdvancedAlgorithmService
{
    public AdvancedAlgorithmResponse Evaluate(AdvancedAlgorithmRequest request)
    {
        var reasons = new List<string>();
        var ensemble = Math.Round(
            (Clamp(request.RulesModelScore) * 0.20m)
            + (Clamp(request.StatisticalModelScore) * 0.20m)
            + (Clamp(request.PatternClassifierScore) * 0.20m)
            + (Clamp(request.MacroModelScore) * 0.20m)
            + (Clamp(request.RegimeModelScore) * 0.20m),
            2);

        var bayesian = Math.Round((Clamp(request.BayesianPrior) * 0.40m) + (Clamp(request.EvidenceStrength) * 0.60m), 2);
        var advanced = Math.Round(
            (Clamp(request.RegimeModelScore) * 0.15m)
            + (ensemble * 0.25m)
            + (bayesian * 0.20m)
            + (Clamp(request.ProbabilityCalibrationScore) * 0.15m)
            + (Clamp(request.WalkForwardValidationScore) * 0.10m)
            + (Clamp(request.AnomalyScore) * 0.10m)
            + (Clamp(request.ExecutionQualityScore) * 0.05m),
            2);

        AddReason(ensemble, 65, "Ensemble prediction");
        AddReason(bayesian, 65, "Bayesian confidence");
        AddReason(request.ProbabilityCalibrationScore, 60, "Probability calibration");
        AddReason(request.WalkForwardValidationScore, 60, "Walk-forward validation");
        AddReason(request.AnomalyScore, 75, "Anomaly safety");
        AddReason(request.ExecutionQualityScore, 70, "Execution quality");
        AddReason(request.StrategyDecayScore, 60, "Strategy decay health");

        var recommendation = advanced >= 80
            && ensemble >= 65
            && bayesian >= 65
            && request.AnomalyScore >= 75
            && request.ExecutionQualityScore >= 70
                ? "AlgorithmApproved"
                : advanced >= 65
                    ? "AlgorithmReview"
                    : "AlgorithmBlocked";

        return new AdvancedAlgorithmResponse(ensemble, bayesian, advanced, recommendation, reasons);

        void AddReason(decimal value, decimal threshold, string label)
        {
            reasons.Add(value >= threshold
                ? $"{label} passed."
                : $"{label} is below threshold.");
        }
    }

    private static decimal Clamp(decimal value)
    {
        return Math.Clamp(value, 0, 100);
    }
}

