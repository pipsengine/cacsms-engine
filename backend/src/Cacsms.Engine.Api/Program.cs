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
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseStartup");
    var hasDatabasePassword =
        !string.IsNullOrWhiteSpace(app.Configuration["Database:Password"])
        || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CACSMS_DB_PASSWORD"));

    if (!hasDatabasePassword)
    {
        logger.LogWarning(
            "Database initialization skipped because no database password is configured. The API will continue in degraded mode.");
    }
    else
    {
        try
        {
            var databaseInitializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
            await databaseInitializer.InitializeAsync();
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Database initialization failed. The API will continue in degraded mode and database health will report unhealthy.");
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapMt5BridgeEndpoints();
app.MapEngineOperationsEndpoints();
app.MapWorkflowEndpoints();
app.MapTradingUniverseEndpoints();
app.MapDecisioningEndpoints();
app.MapDecisionHistoryEndpoints();
app.MapCurrencyStrengthEndpoints();
app.MapCotPositioningEndpoints();
app.MapCurrencyStrengthDecisioningEndpoints();
app.MapHub<TradingHub>("/hubs/trading");

app.Run();
