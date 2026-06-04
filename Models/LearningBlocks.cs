namespace AgronomyStudio.Models;

public enum DifficultyLevel
{
    Beginner,
    Intermediate,
    Advanced
}

public sealed record QuizQuestion
{
    public string Prompt { get; init; } = "";
    public List<string> Options { get; init; } = new();
    public int CorrectIndex { get; init; }
    public string Explanation { get; init; } = "";
}

public sealed record SimulationStep
{
    public string Title { get; init; } = "";
    public string Detail { get; init; } = "";
}

public sealed record LearningModeContent
{
    public string BeginnerExplanation { get; init; } = "";
    public string FormulaView { get; init; } = "";
    public string MapView { get; init; } = "";
    public List<SimulationStep> SimulationSteps { get; init; } = new();
    public QuizQuestion? Quiz { get; init; }
}

public sealed record LearningBlock
{
    public string Id { get; init; } = "";
    public string Title { get; init; } = "";
    public string Concept { get; init; } = "";
    public string Formula { get; init; } = "";
    public DifficultyLevel DifficultyLevel { get; init; } = DifficultyLevel.Beginner;
    public List<FieldLayerType> RequiredLayers { get; init; } = new();
    public LearningModeContent Modes { get; init; } = new();
    public string Recommendation { get; init; } = "";
}
