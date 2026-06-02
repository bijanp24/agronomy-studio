using System.Globalization;
using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class WeatherForecastService
{
    private const string DailyFields =
        "temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,et0_fao_evapotranspiration";

    private const string CurrentFields =
        "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code";

    private readonly HttpClient _http;

    public WeatherForecastService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Forecast);
    }

    public Task<OpenMeteoForecast?> GetForecastAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default)
    {
        var lat = latitude.ToString(CultureInfo.InvariantCulture);
        var lon = longitude.ToString(CultureInfo.InvariantCulture);
        var url =
            $"v1/forecast?latitude={lat}&longitude={lon}" +
            $"&current={CurrentFields}&daily={DailyFields}" +
            "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" +
            "&timezone=auto&forecast_days=7";
        return _http.GetFromJsonAsync<OpenMeteoForecast>(url, ct);
    }
}
