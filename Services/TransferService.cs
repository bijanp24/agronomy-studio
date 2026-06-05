using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

/// <summary>
/// Calls the transfer-api Netlify function for CSV/GeoJSON import, preview,
/// normalisation, validation, and export.
/// </summary>
public sealed class TransferService
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public TransferService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Transfer);
    }

    public Task<ImportPreview?> PreviewCsvAsync(string csvText, string? sourceSystem = null, CancellationToken ct = default)
    {
        var body = new { csvText, sourceSystem = sourceSystem ?? "CSV Import" };
        return PostAsync<ImportPreview>("api/transfer/preview", body, ct);
    }

    public Task<MigrationReport?> ImportCsvAsync(
        string csvText,
        IEnumerable<ColumnMapping>? columnMappings = null,
        IEnumerable<UnitConversion>? unitConversions = null,
        string? sourceSystem = null,
        CancellationToken ct = default)
    {
        var body = new
        {
            csvText,
            sourceSystem = sourceSystem ?? "CSV Import",
            columnMappings = columnMappings?.ToArray() ?? Array.Empty<ColumnMapping>(),
            unitConversions = unitConversions?.ToArray() ?? Array.Empty<UnitConversion>(),
        };
        return PostAsync<MigrationReport>("api/transfer/import", body, ct);
    }

    public Task<MigrationReport?> ImportGeoJsonAsync(object geojson, string? sourceSystem = null, CancellationToken ct = default)
    {
        var body = new { geojson, sourceSystem = sourceSystem ?? "GeoJSON Import" };
        return PostAsync<MigrationReport>("api/transfer/geojson", body, ct);
    }

    public Task<ExportResult?> ExportAsync(string? importId = null, string format = "csv", CancellationToken ct = default)
    {
        var url = $"api/transfer/export?format={Uri.EscapeDataString(format)}";
        if (!string.IsNullOrEmpty(importId)) url += $"&importId={Uri.EscapeDataString(importId)}";
        return _http.GetFromJsonAsync<ExportResult>(url, ct);
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
