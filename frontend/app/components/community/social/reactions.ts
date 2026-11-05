export const reactionChoices = [
  { kind: "like", label: "Like", emoji: "👍" },
  { kind: "love", label: "Love", emoji: "❤️" },
  { kind: "laugh", label: "Laugh", emoji: "😂" },
] as const;

export type ReactionKind = typeof reactionChoices[number]["kind"];
export type ReactionCount = { kind: ReactionKind; count: number };

export function getReactionTotals(reactions: readonly { kind: ReactionKind }[]) {
  const counts = new Map<ReactionKind, number>();
  for (const reaction of reactions) counts.set(reaction.kind, (counts.get(reaction.kind) ?? 0) + 1);
  return reactionChoices.map(choice => ({ ...choice, count: counts.get(choice.kind) ?? 0 }))
    .filter(choice => choice.count > 0)
    .sort((a, b) => b.count - a.count);
}
