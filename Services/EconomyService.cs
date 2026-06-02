using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class EconomyService
{
    private readonly HttpClient _http;

    public EconomyService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Economy);
    }

    public Task<FredIndicatorsResponse?> GetIndicatorsAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<FredIndicatorsResponse>("api/indicators", ct);
}
