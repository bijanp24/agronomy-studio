namespace AgronomyStudio.Models;

// ---------------------------------------------------------------------------
// Learning-block domain models — provider-neutral, vendor-agnostic.
// See docs/learning-blocks.md for the full architecture note.
//
// NOTE: LearningBlock, FieldLayer, QuizQuestion, and LearningModeContent are
// defined in Models/LearningBlocks.cs and Models/MapLayers.cs (from the
// Blazor learning-blocks MVP).  Only the types unique to the Netlify-backed
// spatial API are declared here.
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

// ---------------------------------------------------------------------------
// LearningOutputLayer — lightweight layer carrier returned by the spatial API.
// Uses Dictionary<string, object> so complex JSON values (arrays, nested
// objects) survive round-tripping from the TypeScript Netlify function.
// ---------------------------------------------------------------------------

public sealed record LearningOutputLayer
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";

    /// <summary>boundary | terrain | soil | weather | crop | operations | yield | custom</summary>
    public string Type { get; init; } = "";

    public Dictionary<string, object> Attributes { get; init; } = new();
    public string? Source { get; init; }
    public string? Timestamp { get; init; }
}

// ---------------------------------------------------------------------------
// LearningBlockResult — the computed output returned by a learning block
// calculation service.
// ---------------------------------------------------------------------------

public sealed record LearningBlockResult
{
    public string BlockId { get; init; } = "";
    public Dictionary<string, double> Computed { get; init; } = new();
    public List<LearningOutputLayer> OutputLayers { get; init; } = new();
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
