namespace Backend.Models;

public sealed class PromptIdea
{
    public Guid Id { get; set; }
    public Guid? SubmittedById { get; set; }
    public string Text { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class WeeklyPrompt
{
    public DateOnly WeekOf { get; set; }
    public Guid IdeaId { get; set; }
    public PromptIdea Idea { get; set; } = null!;
}
