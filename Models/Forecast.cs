using System.Text.Json.Serialization;

namespace AgronomyStudio.Models;

public sealed record OpenMeteoForecast
{
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public string Timezone { get; init; } = "";
    public CurrentWeather? Current { get; init; }
    public DailyForecast? Daily { get; init; }
}

public sealed record CurrentWeather
{
    public string Time { get; init; } = "";

    [JsonPropertyName("temperature_2m")]
    public double Temperature { get; init; }

    [JsonPropertyName("relative_humidity_2m")]
    public double RelativeHumidity { get; init; }

    [JsonPropertyName("wind_speed_10m")]
    public double WindSpeed { get; init; }

    public double Precipitation { get; init; }

    [JsonPropertyName("weather_code")]
    public int WeatherCode { get; init; }
}

public sealed record DailyForecast
{
    public List<string> Time { get; init; } = new();

    [JsonPropertyName("temperature_2m_max")]
    public List<double> TemperatureMax { get; init; } = new();

    [JsonPropertyName("temperature_2m_min")]
    public List<double> TemperatureMin { get; init; } = new();

    [JsonPropertyName("precipitation_sum")]
    public List<double> PrecipitationSum { get; init; } = new();

    [JsonPropertyName("uv_index_max")]
    public List<double> UvIndexMax { get; init; } = new();

    [JsonPropertyName("et0_fao_evapotranspiration")]
    public List<double> Et0Evapotranspiration { get; init; } = new();
}
