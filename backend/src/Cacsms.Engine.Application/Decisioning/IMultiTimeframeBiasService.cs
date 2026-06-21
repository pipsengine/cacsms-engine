namespace Cacsms.Engine.Application.Decisioning;

public interface IMultiTimeframeBiasService
{
    MultiTimeframeBiasResponse Evaluate(MultiTimeframeBiasRequest request);
}

