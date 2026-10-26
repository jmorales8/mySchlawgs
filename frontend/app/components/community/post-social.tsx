"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import styles from "./post-social.module.css";
import PostModeration from "./post-moderation";
import { useAccount } from "../account-provider";

const choices = [
  { kind: "like", label: "Like", emoji: "👍" },
  { kind: "love", label: "Love", emoji: "❤️" },
  { kind: "laugh", label: "Laugh", emoji: "😂" },
] as const;
type Kind = typeof choices[number]["kind"];
type Reaction = { userId: string; username: string; kind: Kind };
type Comment = { id: string; authorId: string; username: string; body: string; createdAt: string; canDelete: boolean; photoId: string | null; slideNumber: number | null; parentCommentId: string | null; isReply: boolean; likeCount: number; likedByMe: boolean; likedByPostAuthor: boolean };
type Activity = { reactions: Reaction[]; comments: Comment[]; bestQuotes: { photoId: string; commentId: string }[]; canChooseQuote: boolean; canModerate: boolean; reportedByMe: boolean };

export default function PostSocial({ postId, userId, photoId, slideNumber, postAuthor, onRemoved }: { postId: string; userId: string | null; photoId: string; slideNumber: number; postAuthor: { username: string | null; profilePhotoUrl: string | null }; onRemoved: () => Promise<void> }) {
  const { user } = useAccount();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const url = `/api/posts/${postId}`;
  const mine = activity?.reactions.find(reaction => reaction.userId === userId)?.kind;
  const selected = choices.find(choice => choice.kind === mine);
  const quoteId = activity?.bestQuotes.find(quote => quote.photoId === photoId)?.commentId;
  const quote = activity?.comments.find(comment => comment.id === quoteId);
  const ordered: { comment: Comment; depth: number }[] = [];
  const comments = activity?.comments ?? [];
  const ids = new Set(comments.map(comment => comment.id));
  const children = new Map<string, Comment[]>();
  for (const comment of comments) {
    const parent = comment.parentCommentId && ids.has(comment.parentCommentId) ? comment.parentCommentId : "root";
    children.set(parent, [...(children.get(parent) ?? []), comment]);
  }
  const stack = [...(children.get("root") ?? [])].reverse().map(comment => ({ comment, depth: 0 }));
  while (stack.length) {
    const item = stack.pop()!; ordered.push(item);
    for (const child of [...(children.get(item.comment.id) ?? [])].reverse()) stack.push({ comment: child, depth: item.depth + 1 });
  }

  async function chooseQuote(commentId: string | null) {
    setBusy(true); setError("");
    try {
      await api(`${url}/photos/${photoId}/quote`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }) });
      await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    api<Activity>(`${url}/activity`).then(result => { if (active) setActivity(result); }).catch(() => { if (active) setError("Couldn’t load reactions and comments. Try again."); });
    return () => { active = false; };
  }, [url]);
  useEffect(() => {
    if (!picker) return;
    function dismiss(event: PointerEvent) { if (!pickerRef.current?.contains(event.target as Node)) setPicker(false); }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [picker]);

  async function reload() {
    try { setActivity(await api<Activity>(`${url}/activity`)); setError(""); }
    catch { setError("Couldn’t refresh reactions and comments. Try again."); }
  }
  async function removeComment(commentId: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api(`${url}/comments/${commentId}`, { method: "DELETE" });
      setRemoveId(null); await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function react(kind: Kind) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`${url}/reaction`, mine === kind ? { method: "DELETE" } : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      setPicker(false); await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function share() {
    const link = new URL(`/posts/${postId}`, window.location.origin).href;
    setShareUrl(link); setNotice("");
    try {
      if (navigator.share) { await navigator.share({ title: "A moment on mySchlawgs", url: link }); }
      else { await navigator.clipboard.writeText(link); setNotice("Post link copied. Anyone with the link can view it."); }
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setNotice("Copy the link below to share this post.");
    }
  }

  return <><div className={styles.quoteArea} aria-live="polite">
    {quote && <figure className={styles.bestQuote}><figcaption>★ Best quote · Photo {slideNumber}</figcaption><blockquote>{quote.body}</blockquote><span>— @{quote.username}</span>
      {activity?.canChooseQuote && <button type="button" disabled={busy} onClick={() => void chooseQuote(null)}>Remove best quote</button>}
    </figure>}
  </div><section className={styles.social} aria-label="Post reactions and comments">
    <div className={styles.summary}>
      <button type="button" className={styles.plain} onClick={() => setShowPeople(!showPeople)} aria-expanded={showPeople} disabled={!activity}>
        {activity ? activity.reactions.length ? `${choices.filter(c => activity.reactions.some(r => r.kind === c.kind)).map(c => c.emoji).join(" ")} ${activity.reactions.length} reaction${activity.reactions.length === 1 ? "" : "s"}` : "Be the first to react" : "Loading reactions…"}
      </button>
      <button type="button" className={styles.plain} onClick={() => setShowComments(!showComments)} aria-expanded={showComments} disabled={!activity}>{activity?.comments.length ?? 0} comments</button>
    </div>
    <div className={styles.actions}>
      <div className={styles.reactionControl} ref={pickerRef} onKeyDown={event => { if (event.key === "Escape") { setPicker(false); pickerRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); } }}>
        <button type="button" aria-expanded={picker} disabled={busy || !activity} onClick={() => { if (!userId) { setNotice("Log in or create an account to react."); return; } setPicker(!picker); }}>{selected ? `${selected.emoji} ${selected.label}` : "♡ React"}</button>
        {picker && <div className={styles.picker} role="group" aria-label="Choose a reaction">{choices.map(choice => <button key={choice.kind} type="button" disabled={busy} aria-pressed={mine === choice.kind} onClick={() => void react(choice.kind)}><span>{choice.emoji}</span>{choice.label}</button>)}<small>Select your current reaction to remove it.</small></div>}
      </div>
      <button type="button" onClick={() => { setReplyTo(null); setShowComments(true); requestAnimationFrame(() => commentRef.current?.focus()); }}>Comment</button>
      <button type="button" onClick={() => void share()}>Share ↗</button>
    </div>
    {showPeople && activity && <div className={styles.people}>
      <h3>Who reacted</h3>
      {choices.map(choice => <p key={choice.kind}>{choice.emoji} {choice.label}: {activity.reactions.filter(r => r.kind === choice.kind).length}</p>)}
      <ul>{activity.reactions.map(reaction => <li key={reaction.userId}><span>{choices.find(c => c.kind === reaction.kind)?.emoji}</span> @{reaction.username}</li>)}</ul>
    </div>}
    {shareUrl && <label className={styles.shareLink}>Public post link<input readOnly value={shareUrl} onFocus={event => event.target.select()} /><Link href={`/posts/${postId}`}>Open this post</Link></label>}
    {notice && <p className={styles.message} role="status">{notice}{!userId && !shareUrl && <> <a href="#account">Log in / sign up</a></>}</p>}
    {error && <div className={styles.error} role="alert">{error} <button type="button" className={styles.plain} onClick={() => void reload()}>Retry loading</button></div>}
    {showComments && <div className={styles.comments}>
      <h3>Conversation</h3>
      {activity?.comments.length === 0 && <p className={styles.message}>No comments yet. Say something kind.</p>}
      {ordered.map(({ comment, depth }) => <article key={comment.id} className={`${styles.comment} ${depth ? styles.reply : ""}`} style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}>
        {comment.isReply && <small className={styles.replyContext}>{comment.parentCommentId ? `↳ Reply to @${comments.find(parent => parent.id === comment.parentCommentId)?.username ?? "comment"}` : "↳ Original comment removed"}</small>}
        <div className={styles.commentHeader}><span className={styles.slideBadge} title={comment.slideNumber ? `Refers to photo ${comment.slideNumber}` : "Posted before photo references were available"} aria-label={comment.slideNumber ? `Photo ${comment.slideNumber}` : "Whole post"}>{comment.slideNumber ?? "Post"}</span><div><strong>@{comment.username}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div></div>
        <p>{comment.body}</p>
        {comment.likedByPostAuthor && <span className={styles.authorLike}>
          <span aria-hidden="true">❤️</span>
          {postAuthor.profilePhotoUrl ? <img className={styles.authorAvatar} src={postAuthor.profilePhotoUrl} width={24} height={24} alt={postAuthor.username ? `@${postAuthor.username}` : "The post author"} title={postAuthor.username ? `@${postAuthor.username} · Post author` : "Post author"} /> : <span className={styles.authorAvatar} role="img" aria-label={postAuthor.username ? `@${postAuthor.username}` : "The post author"} title="Post author">{postAuthor.username?.[0]?.toUpperCase() ?? "S"}</span>}
          <span>has liked this comment</span>
        </span>}
        <div className={styles.commentActions}>
          <button type="button" className={styles.plain} disabled={busy} aria-pressed={comment.likedByMe} onClick={async () => {
            if (!userId) { setNotice("Log in to like a comment."); return; }
            setBusy(true); setError("");
            try { await api(`${url}/comments/${comment.id}/like`, { method: comment.likedByMe ? "DELETE" : "PUT" }); await reload(); }
            catch (e) { setError((e as Error).message); } finally { setBusy(false); }
          }}>{comment.likedByMe ? "♥ Liked" : "♡ Like"} · {comment.likeCount}</button>
          <button type="button" className={styles.plain} disabled={busy} onClick={() => { setReplyTo(comment); requestAnimationFrame(() => commentRef.current?.focus()); }}>Reply</button>
        </div>
        {activity?.canChooseQuote && <button type="button" className={styles.quoteAction} disabled={busy || quoteId === comment.id} onClick={() => void chooseQuote(comment.id)}>{quoteId === comment.id ? `★ Best quote for photo ${slideNumber}` : `Use as best quote for photo ${slideNumber}`}</button>}
        {comment.canDelete && (user?.isAdmin && activity?.canModerate ? <button type="button" className={styles.plain} disabled={busy} onClick={() => void removeComment(comment.id)}>Remove comment · Admin</button> : removeId === comment.id ? <div className={styles.confirm}><span>Remove this comment?</span><button type="button" disabled={busy} onClick={() => void removeComment(comment.id)}>Remove</button><button type="button" disabled={busy} onClick={() => setRemoveId(null)}>Cancel</button></div> : <button type="button" className={styles.plain} disabled={busy} onClick={() => setRemoveId(comment.id)}>Remove comment</button>)}
      </article>)}
      {userId ? <form onSubmit={async event => { event.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setError(""); setNotice(""); try { await api(`${url}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, photoId, parentCommentId: replyTo?.id ?? null }) }); setBody(""); setReplyTo(null); await reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
        {replyTo && <p className={styles.replyContext}>Replying to @{replyTo.username} · {replyTo.slideNumber ? `Photo ${replyTo.slideNumber}` : "Post"} <button type="button" className={styles.plain} disabled={busy} onClick={() => setReplyTo(null)}>Cancel reply</button></p>}<label>{replyTo ? "Your reply" : `Comment on photo ${slideNumber}`}<textarea ref={commentRef} value={body} onChange={event => setBody(event.target.value)} maxLength={2000} required disabled={busy} placeholder="Leave a little love for this schlawg…" /></label>
        <button disabled={busy || !body.trim()}>{busy ? "Saving…" : "Post comment"}</button>
      </form> : <p className={styles.message}><a href="#account">Log in or create an account</a> to join the conversation. Everyone can read along.</p>}
    </div>}
    <PostModeration postId={postId} userId={userId} canModerate={activity?.canModerate ?? false} reported={activity?.reportedByMe ?? false} onRemoved={onRemoved} />
  </section></>;
}


