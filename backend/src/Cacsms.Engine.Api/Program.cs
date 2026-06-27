using Cacsms.Engine.Api.Endpoints;
using Cacsms.Engine.Api.Hubs;
using Cacsms.Engine.Application.Realtime;
using Cacsms.Engine.Infrastructure.DependencyInjection;
using Cacsms.Engine.Infrastructure.Persistence;
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

builder.Services.AddCacsmsInfrastructure(builder.Configuration);
builder.Services.AddCacsmsDatabaseHealthChecks();
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

using (var scope = app.Services.CreateScope())
{
    var databaseInitializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
    await databaseInitializer.InitializeAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapWorkflowEndpoints();
app.MapTradingUniverseEndpoints();
app.MapDecisioningEndpoints();
app.MapDecisionHistoryEndpoints();
app.MapCurrencyStrengthEndpoints();
app.MapCurrencyStrengthDecisioningEndpoints();
app.MapHub<TradingHub>("/hubs/trading");

app.Run();
