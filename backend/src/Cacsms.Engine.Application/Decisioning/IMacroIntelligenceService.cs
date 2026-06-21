namespace Cacsms.Engine.Application.Decisioning;

public interface IMacroIntelligenceService
{
    MacroIntelligenceResponse Evaluate(MacroIntelligenceRequest request);
}

