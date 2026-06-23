using Cacsms.Engine.Api.Endpoints;
using Cacsms.Engine.Api.Hubs;
using Cacsms.Engine.Application.Realtime;
using Cacsms.Engine.Infrastructure.DependencyInjection;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console();
});

builder.Services.AddCacsmsInfrastructure();
builder.Services.AddSignalR();
builder.Services.AddSingleton<ITradingEventPublisher, SignalRTradingEventPublisher>();
builder.Services.AddAuthorization();

builder.Services
    .AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("Cacsms.Engine.Api"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation());

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "Cacsms Engine API" }));
app.MapWorkflowEndpoints();
app.MapTradingUniverseEndpoints();
app.MapDecisioningEndpoints();
app.MapDecisionHistoryEndpoints();
app.MapCurrencyStrengthEndpoints();
app.MapCurrencyStrengthDecisioningEndpoints();
app.MapHub<TradingHub>("/hubs/trading");

app.Run();
