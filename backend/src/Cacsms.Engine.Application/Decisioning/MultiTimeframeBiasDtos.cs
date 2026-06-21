namespace Cacsms.Engine.Application.Decisioning;

public sealed record TimeframeBiasInput(
    string Timeframe,
    string Direction,
    decimal Strength,
    decimal Confidence);

public sealed record MultiTimeframeBiasRequest(
    TimeframeBiasInput Monthly,
    TimeframeBiasInput Weekly,
    TimeframeBiasInput Daily,
    TimeframeBiasInput H8,
    TimeframeBiasInput H4,
    TimeframeBiasInput H1,
    TimeframeBiasInput M15,
    string IntendedDirection = "Buy");

public sealed record MultiTimeframeBiasResponse(
    string FinalBias,
    decimal AlignmentScore,
    decimal HigherTimeframeConflictScore,
    decimal ExecutionTimeframeConfirmationScore,
    string TradePermission,
    IReadOnlyCollection<string> Reasons);

