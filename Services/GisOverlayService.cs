using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

/// <summary>
/// Calls the gis-api Netlify function for deterministic GIS overlay data.
/// All numeric results (NDVI, GDD, ET, soil moisture) originate in the
/// TypeScript spatial engine. The provider-adapter seam is in netlify/lib/gis.ts.
/// See docs/gis-overlays.md for architecture notes.
/// </summary>
public sealed class GisOverlayService
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public GisOverlayService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Gis);
    }

    // ---------------------------------------------------------------------------
    // Phase 1 — Vegetation indices
    // ---------------------------------------------------------------------------

    public Task<VegetationOverlayResponse?> GetVegetationAsync(
        IEnumerable<BlockOverlayInput> blocks,
        string indexType = "ndvi",
        CancellationToken ct = default)
    {
        var body = new { blocks, indexType };
        return PostAsync<VegetationOverlayResponse>("api/gis/vegetation", body, ct);
    }

    // ---------------------------------------------------------------------------
    // Phase 2 — GDD and microclimate
    // ---------------------------------------------------------------------------

    public Task<GddOverlayResponse?> GetGddAsync(
        IEnumerable<BlockOverlayInput> blocks,
        CancellationToken ct = default)
    {
        var body = new { blocks };
        return PostAsync<GddOverlayResponse>("api/gis/gdd", body, ct);
    }

    public Task<MicroclimateOverlayResponse?> GetMicroclimateAsync(
        IEnumerable<BlockOverlayInput> blocks,
        CancellationToken ct = default)
    {
        var body = new { blocks };
        return PostAsync<MicroclimateOverlayResponse>("api/gis/microclimate", body, ct);
    }

    // ---------------------------------------------------------------------------
    // Phase 3 — Soil moisture
    // ---------------------------------------------------------------------------

    public Task<SoilMoistureOverlayResponse?> GetSoilMoistureAsync(
        IEnumerable<BlockOverlayInput> blocks,
        CancellationToken ct = default)
    {
        var body = new { blocks };
        return PostAsync<SoilMoistureOverlayResponse>("api/gis/soil-moisture", body, ct);
    }

    // ---------------------------------------------------------------------------
    // Phase 4 — Season timeline
    // ---------------------------------------------------------------------------

    public Task<TimelineOverlayResponse?> GetTimelineAsync(
        IEnumerable<BlockOverlayInput> blocks,
        IEnumerable<string>? seasons = null,
        CancellationToken ct = default)
    {
        var body = new
        {
            blocks,
            seasons = seasons ?? new[] { "2021", "2022", "2023", "2024", "2025" },
        };
        return PostAsync<TimelineOverlayResponse>("api/gis/timeline", body, ct);
    }

    // ---------------------------------------------------------------------------
    // Phase 5 — VRA prescription export
    // ---------------------------------------------------------------------------

    public Task<VraExportResult?> ExportVraAsync(
        VraExportRequest request,
        CancellationToken ct = default)
    {
        return PostAsync<VraExportResult>("api/gis/vra/export", request, ct);
    }

    // ---------------------------------------------------------------------------
    // Shared
    // ---------------------------------------------------------------------------

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
