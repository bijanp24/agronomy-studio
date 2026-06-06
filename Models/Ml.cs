namespace AgronomyStudio.Models;

// ---------------------------------------------------------------------------
// ML service contract types.
//
// PRINCIPLE: All numeric values originate from trained ML models or
// deterministic computations. The AI layer explains these values; it never
// invents, adjusts, or fabricates numbers.
//
// Disclaimer property is always present and surfaced in the UI.
// ---------------------------------------------------------------------------

public sealed record MlYieldPrediction
{
    public string FieldId { get; init; } = "";
    public string CropName { get; init; } = "";
    public int CropYear { get; init; }
    public double PredictedYieldKgHa { get; init; }
    public double YieldLowerKgHa { get; init; }
    public double YieldUpperKgHa { get; init; }
    public double BaselineYieldKgHa { get; init; }
    public string Confidence { get; init; } = "";
    public double FactorWater { get; init; }
    public double FactorNutrient { get; init; }
    public double FactorHeat { get; init; }
    public double FactorUv { get; init; }
    public double FactorSeed { get; init; }
    public double FactorPlanting { get; init; }
    public List<string> LimitingFactors { get; init; } = new();
    public string Explanation { get; init; } = "";
    public string Disclaimer { get; init; } = "";
}

public sealed record MlOptimizationResult
{
    public string FieldId { get; init; } = "";
    public int CropYear { get; init; }
    public double CurrentIrrigationIn { get; init; }
    public double RecIrrigationIn { get; init; }
    public double IrrigationDeltaIn { get; init; }
    public double CurrentNitrogenLbAc { get; init; }
    public double RecNitrogenLbAc { get; init; }
    public double NitrogenDeltaLbAc { get; init; }
    public double ExpectedYieldKgHa { get; init; }
    public double ExpectedYieldGainPct { get; init; }
    public double BaselineYieldKgHa { get; init; }
    public string Confidence { get; init; } = "";
    public string Explanation { get; init; } = "";
    public string Disclaimer { get; init; } = "";
}

public sealed record MlRiskAssessment
{
    public string FieldId { get; init; } = "";
    public int CropYear { get; init; }
    public double AnomalyScore { get; init; }
    public string RiskLabel { get; init; } = "";
    public double ResidualZscore { get; init; }
    public List<string> TopRiskFactors { get; init; } = new();
    public int CohortId { get; init; }
    public string CohortName { get; init; } = "";
    public string Explanation { get; init; } = "";
    public string Disclaimer { get; init; } = "";
}

public sealed record MlRiskSummary
{
    public int CropYear { get; init; }
    public List<MlRiskAssessment> Fields { get; init; } = new();
}

public sealed record MlBenchmarkResult
{
    public string FieldId { get; init; } = "";
    public int CropYear { get; init; }
    public int ClusterLabel { get; init; }
    public string ClusterName { get; init; } = "";
    public double YieldKgHa { get; init; }
    public double PercentileRank { get; init; }
    public int CohortSize { get; init; }
    public string Explanation { get; init; } = "";
    public string Disclaimer { get; init; } = "";
}

public sealed record MlClusterInfo
{
    public int ClusterLabel { get; init; }
    public string ClusterName { get; init; } = "";
}

public sealed record MlClustersResponse
{
    public List<MlClusterInfo> Clusters { get; init; } = new();
}

public sealed record MlHealthStatus
{
    public string Status { get; init; } = "";
    public bool DemoMode { get; init; }
    public Dictionary<string, string?> ActiveModels { get; init; } = new();
}

public sealed record MlTrainRequest
{
    public string ModelType { get; init; } = "all";
}
