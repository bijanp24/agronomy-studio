using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

/// <summary>
/// Classifies user questions and routes them to the correct spatial learning block.
/// The AI layer interprets intent and explains results — it does NOT compute
/// field measurements, acreage, slope, or any safety-critical value.
/// See docs/ai-orchestration.md for the full architecture note.
/// </summary>
public sealed class AiOrchestrationService
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public AiOrchestrationService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Spatial);
    }

    /// <summary>
    /// Classify a user question and receive a structured action plan with a plain-English
    /// explanation. The explanation comes from the AI layer; all numbers are computed by
    /// deterministic services.
    /// </summary>
    public Task<OrchestrationResult?> OrchestrateAsync(
        string query,
        string? explanationLevel = null,
        CancellationToken ct = default)
    {
        var body = new { query, explanationLevel };
        return PostAsync<OrchestrationResult>("api/orchestrate", body, ct);
    }

    private async Task<T?> PostAsync<T>(string path, object body, CancellationToken ct)
    {
        var content = new StringContent(
            JsonSerializer.Serialize(body, JsonOpts),
            Encoding.UTF8,
            "application/json");
        var response = await _http.PostAsync(path, content, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOpts, ct);
    }
}
