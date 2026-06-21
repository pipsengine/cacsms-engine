namespace Cacsms.Engine.Application.Decisioning;

public interface IHybridDecisionService
{
    HybridDecisionResponse Evaluate(HybridDecisionRequest request);
}

