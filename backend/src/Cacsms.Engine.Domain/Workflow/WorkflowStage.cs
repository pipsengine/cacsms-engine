using Cacsms.Engine.Domain.Abstractions;

namespace Cacsms.Engine.Domain.Workflow;

public sealed class WorkflowStage : AggregateRoot
{
    private WorkflowStage()
    {
    }

    public WorkflowStage(string code, string name, TradingModule module, WorkflowStatus status, int progress)
    {
        Code = code;
        Name = name;
        Module = module;
        SetStatus(status, progress);
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public TradingModule Module { get; private set; }
    public WorkflowStatus Status { get; private set; }
    public int Progress { get; private set; }

    public void SetStatus(WorkflowStatus status, int progress)
    {
        if (progress is < 0 or > 100)
        {
            throw new ArgumentOutOfRangeException(nameof(progress), "Progress must be between 0 and 100.");
        }

        Status = status;
        Progress = progress;
        MarkUpdated();
    }
}
