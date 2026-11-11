"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { api } from "../../api";
import styles from "./post-social.module.css";
import PostModeration from "../moderation/post-moderation";
import CommentComposer from "./comment-composer";
import CommentOptions from "./comment-options";
import FeaturedQuote from "./featured-quote";
import CommentEditor from "./comment-editor";
import CommentReactions from "./comment-reactions";
import ReactionControl from "./reaction-control";
import { reactionChoices as choices, getReactionTotals, type ReactionKind as Kind, type ReactionCount } from "./reactions";
import { useAccount } from "../../../contexts/account-context";

type Reaction = { userId: string; username: string; kind: Kind };
type Comment = { id: string; authorId: string; username: string; body: string; createdAt: string; canDelete: boolean; canEdit: boolean; photoId: string | null; slideNumber: number | null; parentCommentId: string | null; isReply: boolean; likeCount: number; likedByMe: boolean; likedByPostAuthor: boolean; reactionCounts: ReactionCount[]; myReaction: Kind | null; postAuthorReaction: Kind | null };
type Activity = { reactions: Reaction[]; comments: Comment[]; bestQuotes: { photoId: string; commentId: string }[]; canChooseQuote: boolean; canModerate: boolean; reportedByMe: boolean };

export default function PostSocial({ quoteTarget, postId, userId, photoId, slideNumber, photoCount, postAuthor, onRemoved }: { quoteTarget: HTMLDivElement | null; postId: string; userId: string | null; photoId: string; slideNumber: number; photoCount: number; postAuthor: { username: string | null; profilePhotoUrl: string | null; ownerId: string | null }; onRemoved: () => Promise<void> }) {
  const { user } = useAccount();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  const reactionSaving = useRef(false);
  const activityRequest = useRef(0);
  const [showComments, setShowComments] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyError, setReplyError] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const url = `/api/posts/${postId}`;
  const reactionTotals = getReactionTotals(activity?.reactions ?? []);
  const mine = activity?.reactions.find(reaction => reaction.userId === userId)?.kind;
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
    const request = ++activityRequest.current;
    api<Activity>(`${url}/activity`).then(result => { if (active && request === activityRequest.current) setActivity(result); }).catch(() => { if (active && request === activityRequest.current) setError("Couldn’t load reactions and comments. Try again."); });
    return () => { active = false; };
  }, [url]);
  useEffect(() => { replyRef.current?.focus(); }, [replyTo?.id]);


  async function reload() {
    const request = ++activityRequest.current;
    try {
      const next = await api<Activity>(`${url}/activity`);
      if (request === activityRequest.current) { setActivity(next); setError(""); }
    }
    catch { if (request === activityRequest.current) setError("Couldn’t refresh reactions and comments. Try again."); }
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
    if (busy || reactionSaving.current) return;
    reactionSaving.current = true; setReactionBusy(true); setError(""); setNotice("");
    try {
      await api(`${url}/reaction`, mine === kind ? { method: "DELETE" } : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      await reload();
    } catch (e) { setError((e as Error).message); } finally { reactionSaving.current = false; setReactionBusy(false); }
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

  return <>{quoteTarget && createPortal(<div className={styles.quoteArea} aria-live="polite">
    {quote && <figure className={styles.bestQuote}>
      <figcaption className={styles.quoteMarker} aria-label="Best quote" title="Best quote"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" /></svg></figcaption>
      <FeaturedQuote key={`${photoId}-${quote.id}-${quote.body}`} body={quote.body} username={quote.username} />
      {activity?.canChooseQuote && <CommentOptions label="Best quote options"><button type="button" disabled={busy} onClick={() => void chooseQuote(null)}>Remove best quote</button></CommentOptions>}
    </figure>}
  </div>, quoteTarget)}<section className={styles.social} aria-label="Post reactions and comments">
    <div className={styles.actions}>
      <ReactionControl count={activity?.reactions.length ?? 0} value={mine ?? null} disabled={busy || reactionBusy || !activity} signedIn={!!userId}
        onLoginRequired={() => setNotice("Log in or create an account to react.")} onChoose={react} />
      <button type="button" className={styles.commentAction} aria-label={`${activity?.comments.length ?? 0} comments`} aria-expanded={showComments} aria-controls={`conversation-${postId}`} onClick={() => { setReplyTo(null); setShowComments(true); requestAnimationFrame(() => commentRef.current?.focus()); }}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a9 9 0 1 0-4.2 7.6L22 21l-1.5-5A9 9 0 0 0 21 11.5Z" /></svg><span>{activity?.comments.length ?? 0}</span>
      </button>
      <button type="button" aria-label="Share post" title="Share post" onClick={() => void share()}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m14 3 8 7-8 7v-5c-5 0-8 2-11 7 0-8 4-12 11-12V3Z" /></svg>
      </button>
      {reactionTotals.length > 0 && <div className={styles.reactionSummary} role="list" aria-label="Reaction totals">
        {reactionTotals.map(choice => <span key={choice.kind} className={styles.reactionTotal} role="listitem" aria-label={`${choice.count} ${choice.label} reaction${choice.count === 1 ? "" : "s"}`}>
          <span className={styles.reactionBadge} data-kind={choice.kind} aria-hidden="true"><span>{choice.emoji}</span></span>
        </span>)}
      </div>}
    </div>
    {shareUrl && <label className={styles.shareLink}>Public post link<input readOnly value={shareUrl} onFocus={event => event.target.select()} /><Link href={`/posts/${postId}`}>Open this post</Link></label>}
    {notice && <p className={styles.message} role="status">{notice}{!userId && !shareUrl && <> <a href="#account">Log in / sign up</a></>}</p>}
    {error && <div className={styles.error} role="alert">{error} <button type="button" className={styles.plain} onClick={() => void reload()}>Retry loading</button></div>}
    {showComments && <div className={styles.comments} id={`conversation-${postId}`}>
      {userId ? <CommentComposer label={photoCount > 1 ? `Comment on photo ${slideNumber}` : "Write a comment :3"} textareaRef={commentRef} value={body} onChange={setBody} busy={busy}
        onSubmit={async event => { event.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setError(""); setNotice(""); try { await api(`${url}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, photoId, parentCommentId: null }) }); setBody(""); await reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }} />
        : <p className={styles.message}><a href="#account">Log in or create an account</a> to join the conversation. Everyone can read along.</p>}
      {ordered.map(({ comment, depth }) => <article key={comment.id} className={`${styles.comment} ${depth ? styles.reply : ""} ${editingId === comment.id ? styles.editTarget : ""}`} style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}>
        {comment.isReply && <small className={styles.replyContext}>{comment.parentCommentId ? `↳ Reply to @${comments.find(parent => parent.id === comment.parentCommentId)?.username ?? "comment"}` : "↳ Original comment removed"}</small>}
        <div className={styles.commentHeader}><strong>@{comment.username}</strong><time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>{new Date(comment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
          {photoCount > 1 && comment.slideNumber && <span className={styles.slideBadge}>Photo {comment.slideNumber}</span>}
          {(activity?.canChooseQuote || comment.canEdit || comment.canDelete) && <CommentOptions label={`Options for comment by @${comment.username}`}>
            {activity?.canChooseQuote && <button type="button" disabled={busy || quoteId === comment.id} onClick={() => void chooseQuote(comment.id)}>{quoteId === comment.id ? "Selected best quote" : photoCount > 1 ? `Choose as best quote for photo ${slideNumber}` : "Choose as best quote"}</button>}
            {comment.canEdit && <button type="button" disabled={busy || editingId === comment.id} onClick={() => { setEditingId(comment.id); setReplyTo(null); setRemoveId(null); }}>Edit comment</button>}
            {comment.canDelete && <button type="button" disabled={busy} onClick={() => { if (user?.isAdmin && activity?.canModerate) void removeComment(comment.id); else setRemoveId(comment.id); }}>Remove comment{user?.isAdmin && activity?.canModerate ? " · Admin" : ""}</button>}
          </CommentOptions>}
        </div>
        {editingId === comment.id ? <CommentEditor body={comment.body} reply={comment.isReply} busy={busy} onCancel={() => setEditingId(null)} onSave={async updatedBody => {
          if (busy) return;
          setBusy(true);
          try {
            await api(`${url}/comments/${comment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: updatedBody }) });
            setActivity(current => current ? { ...current, comments: current.comments.map(item => item.id === comment.id ? { ...item, body: updatedBody.trim() } : item) } : current);
            setEditingId(null); await reload();
          } finally { setBusy(false); }
        }} /> : <p>{comment.body}</p>}
        {comment.postAuthorReaction && <span className={styles.authorLike}>
          <span aria-hidden="true">{choices.find(choice => choice.kind === comment.postAuthorReaction)?.emoji}</span>
          {postAuthor.profilePhotoUrl ? <img className={styles.authorAvatar} src={postAuthor.profilePhotoUrl} width={24} height={24} alt={postAuthor.username ? `@${postAuthor.username}` : "The post author"} title={postAuthor.username ? `@${postAuthor.username} · Post author` : "Post author"} /> : <span className={styles.authorAvatar} role="img" aria-label={postAuthor.username ? `@${postAuthor.username}` : "The post author"} title="Post author">{postAuthor.username?.[0]?.toUpperCase() ?? "S"}</span>}
          <span>has {comment.postAuthorReaction === "like" ? "liked" : comment.postAuthorReaction === "love" ? "loved" : "laughed at"} this comment</span>
        </span>}
        <div className={styles.commentActions} role="group" aria-label="Like or reply to this comment">
          <CommentReactions value={comment.myReaction} counts={comment.reactionCounts ?? []} busy={busy} signedIn={!!userId}
            onLoginRequired={() => setNotice("Log in to react to a comment.")} onChoose={async kind => {
              if (busy) return;
              setError("");
              try { await api(`${url}/comments/${comment.id}/reaction`, comment.myReaction === kind ? { method: "DELETE" } : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) }); await reload(); }
              catch (e) { setError((e as Error).message); }
            }} />
          <button type="button" className={styles.replyAction} disabled={busy} aria-expanded={replyTo?.id === comment.id} aria-controls={`reply-${postId}-${comment.id}`} onClick={() => {
            if (!userId) { setNotice("Log in or create an account to reply to this comment."); return; }
            setEditingId(null); setReplyError(""); setReplyTo(replyTo?.id === comment.id ? null : comment);
          }}>Reply</button>
        </div>
            {removeId === comment.id && <div className={styles.confirm} role="group" aria-label="Confirm comment removal"><span>Remove this comment?</span><button type="button" disabled={busy} onClick={() => void removeComment(comment.id)}>Remove</button><button type="button" disabled={busy} onClick={() => setRemoveId(null)}>Cancel</button></div>}
        {userId && replyTo?.id === comment.id && <CommentComposer
          id={`reply-${postId}-${comment.id}`} reply textareaRef={replyRef}
          label={`Reply to @${comment.username} · ${comment.slideNumber ? `Photo ${comment.slideNumber}` : "Post"}`}
          value={replyDrafts[comment.id] ?? ""} onChange={value => setReplyDrafts(drafts => ({ ...drafts, [comment.id]: value }))}
          busy={busy} error={replyError} onCancel={() => { setReplyTo(null); setReplyError(""); }}
          onSubmit={async event => {
            event.preventDefault();
            const replyBody = replyDrafts[comment.id] ?? "";
            if (busy || !replyBody.trim()) return;
            setBusy(true); setReplyError(""); setNotice("");
            try {
              await api(`${url}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: replyBody, photoId: comment.photoId, parentCommentId: comment.id }) });
              setReplyDrafts(drafts => ({ ...drafts, [comment.id]: "" })); setReplyTo(null); await reload();
            } catch (e) { setReplyError((e as Error).message); } finally { setBusy(false); }
          }} />}
      </article>)}
    </div>}
    {(!userId || postAuthor.ownerId !== userId) && <PostModeration postId={postId} userId={userId} canModerate={!!activity?.canModerate && postAuthor.ownerId !== userId} reported={activity?.reportedByMe ?? false} onRemoved={onRemoved} />}
  </section></>;
}


