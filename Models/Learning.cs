namespace AgronomyStudio.Models;

// ---------------------------------------------------------------------------
// Learning-block domain models — provider-neutral, vendor-agnostic.
// See docs/learning-blocks.md for the full architecture note.
// ---------------------------------------------------------------------------

public sealed record LearningBlockInput
{
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public string Unit { get; init; } = "";
    public bool Required { get; init; } = true;
}

public sealed record LearningBlockOutput
{
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public string Unit { get; init; } = "";
}

public sealed record RecommendationRule
{
    public string Condition { get; init; } = "";
    public string Recommendation { get; init; } = "";
}

public sealed record LearningBlock
{
    public string Id { get; init; } = "";
    public string Title { get; init; } = "";
    public string Concept { get; init; } = "";
    public string? Formula { get; init; }
    public List<LearningBlockInput> Inputs { get; init; } = new();
    public List<LearningBlockOutput> Outputs { get; init; } = new();
    public List<string> MapLayers { get; init; } = new();
    public List<string> SimulationSteps { get; init; } = new();
    public List<RecommendationRule> RecommendationRules { get; init; } = new();
    public string DifficultyLevel { get; init; } = "beginner";
    public List<string> Tags { get; init; } = new();
}

// ---------------------------------------------------------------------------
// FieldLayer — provider-neutral map/field layer model.
// External providers are adapted into this model via thin adapters;
// no vendor name appears here.
// ---------------------------------------------------------------------------

public sealed record FieldLayerGeometry
{
    public string Type { get; init; } = "";
    public object? Coordinates { get; init; }
}

public sealed record FieldLayer
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";

    /// <summary>
    /// boundary | terrain | soil | weather | crop | operations | yield | custom
    /// </summary>
    public string Type { get; init; } = "";

    public FieldLayerGeometry? Geometry { get; init; }
    public Dictionary<string, object> Attributes { get; init; } = new();

    /// <summary>Human-readable provider name (e.g. "local-demo", "NRCS SSURGO").</summary>
    public string? Source { get; init; }

    /// <summary>ISO 8601 timestamp of when the layer data was captured or generated.</summary>
    public string? Timestamp { get; init; }
}

// ---------------------------------------------------------------------------
// LearningModeContent — rich educational content attached to a block.
// ---------------------------------------------------------------------------

public sealed record QuizQuestion
{
    public string Question { get; init; } = "";
    public string Answer { get; init; } = "";
    public List<string> Choices { get; init; } = new();
}

public sealed record LearningModeContent
{
    public string BlockId { get; init; } = "";
    public string BeginnerExplanation { get; init; } = "";
    public string FormulaView { get; init; } = "";
    public string? MapView { get; init; }
    public string? SimulationView { get; init; }
    public List<QuizQuestion> QuizQuestions { get; init; } = new();
    public string? RecommendationExplanation { get; init; }
}

// ---------------------------------------------------------------------------
// LearningBlockResult — the computed output returned by a learning block
// calculation service.
// ---------------------------------------------------------------------------

public sealed record LearningBlockResult
{
    public string BlockId { get; init; } = "";
    public Dictionary<string, double> Computed { get; init; } = new();
    public List<FieldLayer> OutputLayers { get; init; } = new();
    public string? Explanation { get; init; }
    public string? Warning { get; init; }
}

// ---------------------------------------------------------------------------
// AI Orchestration models
// See docs/ai-orchestration.md for the architecture note.
// ---------------------------------------------------------------------------

public sealed record OrchestrationAction
{
    public string Intent { get; init; } = "";
    public string? BlockId { get; init; }
    public List<string> RequiredLayers { get; init; } = new();
    public List<string> CalculationPlan { get; init; } = new();
    public string ExplanationLevel { get; init; } = "beginner";
    public Dictionary<string, string> ExtractedContext { get; init; } = new();
}

public sealed record OrchestrationResult
{
    public string Query { get; init; } = "";
    public OrchestrationAction Action { get; init; } = new();
    public string Explanation { get; init; } = "";
    /// <summary>
    /// Always present — reminds the caller that numeric values come from
    /// deterministic services, not from the AI layer.
    /// </summary>
    public string Disclaimer { get; init; } = "";
    public double Confidence { get; init; }
}
