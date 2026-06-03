namespace AgronomyStudio.Models;

public sealed class SolarData
{
    public SolarPotential? SolarPotential { get; set; }
}

public sealed class SolarPotential
{
    public float MaxSunshineHoursPerYear { get; set; }
    public float CarbonOffsetFactorKgPerMwh { get; set; }
    public int MaxArrayPanelsCount { get; set; }
    public float MaxArrayAreaMeters2 { get; set; }
    public float PanelCapacityWatts { get; set; }
}
