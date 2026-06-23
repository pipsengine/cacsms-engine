using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Application.Decisioning;

public sealed class LiveCurrencyStrengthHybridEvaluator
{
    private readonly IHybridDecisionService _hybridDecisionService;
    private readonly ICurrencyStrengthIntelligenceService _currencyStrengthService;

    public LiveCurrencyStrengthHybridEvaluator(
        IHybridDecisionService hybridDecisionService,
        ICurrencyStrengthIntelligenceService currencyStrengthService)
    {
        _hybridDecisionService = hybridDecisionService;
        _currencyStrengthService = currencyStrengthService;
    }

    public HybridDecisionResponse Evaluate(HybridDecisionRequest request)
    {
        var enrichment = _currencyStrengthService.EnrichForSymbol(request.Symbol);
        var enrichedRequest = request with
        {
            CurrencyStrengthScore = enrichment.CurrencyStrengthScore
        };

        var response = _hybridDecisionService.Evaluate(enrichedRequest);
        var evidence = response.Evidence.Concat(enrichment.Evidence).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var rejections = response.NoTradeReasons.Concat(enrichment.RejectionReasons).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        var recommendation = rejections.Length == 0 ? response.Recommendation : "NoTrade";
        var direction = recommendation == "Execute" ? response.Direction : "None";
        var approvedRisk = recommendation == "Execute" ? response.ApprovedRiskPercent : 0;

        return response with
        {
            Recommendation = recommendation,
            Direction = direction,
            ApprovedRiskPercent = approvedRisk,
            Evidence = evidence,
            NoTradeReasons = rejections
        };
    }
}
