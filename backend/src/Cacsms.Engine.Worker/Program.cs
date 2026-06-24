using Cacsms.Engine.Infrastructure.DependencyInjection;
using Cacsms.Engine.Worker.Jobs;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Services.AddSerilog();
builder.Services.AddCacsmsInfrastructure(builder.Configuration);
builder.Services.AddHostedService<MarketScanningWorker>();
builder.Services.AddHostedService<TradeMonitoringWorker>();

var host = builder.Build();
host.Run();
