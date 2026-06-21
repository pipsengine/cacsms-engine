using Cacsms.Engine.Domain.Workflow;

namespace Cacsms.Engine.Application.Workflow;

public sealed record WorkflowStageDto(
    string Code,
    string Name,
    TradingModule Module,
    WorkflowStatus Status,
    int Progress);
