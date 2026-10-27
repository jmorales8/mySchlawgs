export const reactionChoices = [
  { kind: "like", label: "Like", emoji: "👍" },
  { kind: "love", label: "Love", emoji: "❤️" },
  { kind: "laugh", label: "Laugh", emoji: "😂" },
] as const;

export type ReactionKind = typeof reactionChoices[number]["kind"];
export type ReactionCount = { kind: ReactionKind; count: number };
