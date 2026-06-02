using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class AiSearchService
{
    private readonly HttpClient _http;

    public AiSearchService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.AiSearch);
    }

    public async Task<AgronomySearchResult?> SearchAsync(string query, CancellationToken ct = default)
    {
        var response = await _http.PostAsJsonAsync("api/search", new { query }, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AgronomySearchResult>(cancellationToken: ct);
    }
}
