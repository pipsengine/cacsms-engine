using System.Text.Json;
using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Decisioning;
using Cacsms.Engine.Domain.Abstractions;
using Cacsms.Engine.Domain.Decisioning;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class DecisionHistoryService(
    IHybridDecisionService hybridDecisionService,
    IDecisionRecordRepository decisionRecordRepository,
    IUnitOfWork unitOfWork) : IDecisionHistoryService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<PersistedHybridDecisionResponse> EvaluateAndSaveAsync(
        HybridDecisionRequest request,
        CancellationToken cancellationToken = default)
    {
        var decision = hybridDecisionService.Evaluate(request);
        var requestJson = JsonSerializer.Serialize(request, JsonOptions);
        var responseJson = JsonSerializer.Serialize(decision, JsonOptions);

        var record = DecisionRecord.Create(
            decision.Symbol,
            decision.TradingMode,
            decision.Recommendation,
            decision.Direction,
            decision.ConfidenceScore,
            requestJson,
            responseJson);

        await decisionRecordRepository.AddAsync(record, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new PersistedHybridDecisionResponse(record.Id, record.CreatedAt, decision);
    }

    public async Task<IReadOnlyCollection<DecisionHistoryItemDto>> ListRecentAsync(
        int limit,
        CancellationToken cancellationToken = default)
    {
        var records = await decisionRecordRepository.ListRecentAsync(limit, cancellationToken);

        return records
            .Select(record => new DecisionHistoryItemDto(
                record.Id,
                record.CreatedAt,
                record.Symbol,
                record.TradingMode,
                record.Recommendation,
                record.Direction,
                record.ConfidenceScore))
            .ToArray();
    }
}
