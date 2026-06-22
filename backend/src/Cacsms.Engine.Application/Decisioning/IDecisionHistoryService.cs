namespace Cacsms.Engine.Application.Decisioning;

public interface IDecisionHistoryService
{
    Task<PersistedHybridDecisionResponse> EvaluateAndSaveAsync(
        HybridDecisionRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyCollection<DecisionHistoryItemDto>> ListRecentAsync(
        int limit,
        CancellationToken cancellationToken = default);
}
