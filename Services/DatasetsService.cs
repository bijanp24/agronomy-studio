using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class DatasetsService
{
    private readonly HttpClient _http;

    public DatasetsService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Datasets);
    }

    public Task<CatalogSearchResponse?> SearchAsync(
        string query,
        int perPage = 12,
        CancellationToken ct = default) =>
        _http.GetFromJsonAsync<CatalogSearchResponse>(
            $"api/search?q={Uri.EscapeDataString(query)}&perPage={perPage}",
            ct);
}
