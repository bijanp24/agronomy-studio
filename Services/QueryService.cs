using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class QueryException : Exception
{
    public QueryException(string message) : base(message) { }
}

public sealed class QueryService
{
    private readonly HttpClient _http;

    public QueryService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Query);
    }

    public async Task<QueryResponse> QueryAsync(
        string question,
        string provider = "mock",
        CancellationToken ct = default)
    {
        var request = new QueryRequest { Question = question, Provider = provider };
        var response = await _http.PostAsJsonAsync("api/query", request, ct);

        if (!response.IsSuccessStatusCode)
        {
            string? message = null;
            try
            {
                var error = await response.Content.ReadFromJsonAsync<QueryErrorResponse>(ct);
                message = error?.Error;
            }
            catch
            {
                // Body was not the expected error shape; fall back to a generic message.
            }

            throw new QueryException(message ?? "An unexpected error occurred. Please try again.");
        }

        var result = await response.Content.ReadFromJsonAsync<QueryResponse>(ct);
        return result ?? throw new QueryException("Empty response from query service.");
    }
}
