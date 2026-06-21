using Cacsms.Engine.Infrastructure.DependencyInjection;
using Cacsms.Engine.Mt5Bridge.Bridge;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Services.AddSerilog();
builder.Services.AddCacsmsInfrastructure();
builder.Services.AddSingleton<Mt5MessageRouter>();
builder.Services.AddHostedService<Mt5BridgeWorker>();

var host = builder.Build();
host.Run();
