"use client";

import { reactionChoices, type ReactionKind, type ReactionCount } from "./reactions";
import ReactionControl from "./reaction-control";
import styles from "./post-social.module.css";

export default function CommentReactions({ value, counts, busy, signedIn, onLoginRequired, onChoose }: {
  value: ReactionKind | null; counts: ReactionCount[]; busy: boolean; signedIn: boolean;
  onLoginRequired: () => void; onChoose: (kind: ReactionKind) => Promise<void>;
}) {
  return <div className={styles.commentReactionControl}>
    <ReactionControl value={value} disabled={busy} signedIn={signedIn}
      onLoginRequired={onLoginRequired} onChoose={onChoose} label="Choose a comment reaction" />
    {counts.length > 0 && <span className={styles.commentReactionCounts} aria-label="Comment reactions">{reactionChoices.map(choice => {
      const count = counts.find(item => item.kind === choice.kind)?.count ?? 0;
      return count > 0 ? <span key={choice.kind} aria-label={`${count} ${choice.label} reaction${count === 1 ? "" : "s"}`}><span aria-hidden="true">{choice.emoji}</span> {count}</span> : null;
    })}</span>}
  </div>;
}
