using AgronomyStudio;
using AgronomyStudio.Services;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var fieldApi = builder.Configuration["Api:FieldApi"] ?? "/field-api";
var weatherApi = builder.Configuration["Api:WeatherApi"] ?? "/weather-api";
var queryApi = builder.Configuration["Api:QueryApi"] ?? "/query-api";
var fredApi = builder.Configuration["Api:FredApi"] ?? "/fred-api";
var datagovApi = builder.Configuration["Api:DatagovApi"] ?? "/datagov-api";
var nasaApi = builder.Configuration["Api:NasaApi"] ?? "https://api.nasa.gov";
var openMeteoApi = builder.Configuration["Api:OpenMeteoApi"] ?? "https://api.open-meteo.com";
var agronomyApi = builder.Configuration["Api:AgronomyApi"] ?? "/agronomy-api";
var aiSearchApi = builder.Configuration["Api:AiSearchApi"] ?? "/ai-search-api";

builder.Services.AddSingleton<LogService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddTransient(sp => new ApiErrorHandler(
    sp.GetRequiredService<NotificationService>(),
    sp.GetRequiredService<LogService>()));

string Absolute(string value)
{
    var withSlash = value.EndsWith('/') ? value : value + "/";
    return Uri.IsWellFormedUriString(withSlash, UriKind.Absolute)
        ? withSlash
        : new Uri(new Uri(builder.HostEnvironment.BaseAddress), withSlash.TrimStart('/')).ToString();
}

void AddApiClient(string name, string baseUrl) =>
    builder.Services.AddHttpClient(name, client => client.BaseAddress = new Uri(Absolute(baseUrl)))
        .AddHttpMessageHandler(sp => sp.GetRequiredService<ApiErrorHandler>());

AddApiClient(ApiClients.Field, fieldApi);
AddApiClient(ApiClients.Weather, weatherApi);
AddApiClient(ApiClients.Query, queryApi);
AddApiClient(ApiClients.Economy, fredApi);
AddApiClient(ApiClients.Datasets, datagovApi);
AddApiClient(ApiClients.Space, nasaApi);
AddApiClient(ApiClients.Forecast, openMeteoApi);
AddApiClient(ApiClients.Agronomy, agronomyApi);
AddApiClient(ApiClients.AiSearch, aiSearchApi);

builder.Services.AddHttpClient(ApiClients.AirQuality,
    c => c.BaseAddress = new Uri("https://airquality.googleapis.com/"));
builder.Services.AddHttpClient(ApiClients.Solar,
    c => c.BaseAddress = new Uri("https://solar.googleapis.com/"));

builder.Services.AddScoped<FieldIntelligenceService>();
builder.Services.AddScoped<WeatherService>();
builder.Services.AddScoped<QueryService>();
builder.Services.AddScoped<BrowserStorage>();
builder.Services.AddScoped<EconomyService>();
builder.Services.AddScoped<DatasetsService>();
builder.Services.AddScoped<SpaceService>();
builder.Services.AddScoped<WeatherForecastService>();
builder.Services.AddScoped<AgronomyService>();
builder.Services.AddScoped<AiSearchService>();
builder.Services.AddScoped<AirQualityService>();
builder.Services.AddScoped<SolarService>();
builder.Services.AddScoped<DemoFieldData>();

await builder.Build().RunAsync();
