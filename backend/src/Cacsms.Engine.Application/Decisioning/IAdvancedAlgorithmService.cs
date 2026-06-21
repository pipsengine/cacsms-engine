namespace Cacsms.Engine.Application.Decisioning;

public interface IAdvancedAlgorithmService
{
    AdvancedAlgorithmResponse Evaluate(AdvancedAlgorithmRequest request);
}

