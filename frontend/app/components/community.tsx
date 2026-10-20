"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./community.module.css";
import Link from "next/link";
import { api } from "./api";
import { FeedCache } from "./feed-cache";
import PostSocial from "./post-social";
import RandomPost from "./random-post";
import NotificationBell from "./notification-bell";
import ProfileCropper from "./profile-cropper";
import PhotoFocus from "./photo-focus";
import PhotoEditor from "./photo-editor";
import Captcha from "./captcha";
import { TutorialLink, useTutorial } from "./tutorial";
import { groupPhotoBatches } from "./photo-batches";
import { useAccount, type User } from "./account-provider";

type Photo = { id: string; postId?: string | null; batchId?: string | null; batchPosition?: number; downloadUrl: string; description: string; ownerId: string | null; username: string | null; profilePhotoUrl: string | null; uploadedAt: string };
type Draft = { file: File; url: string; description: string };

function Avatar({ user }: { user: { username: string | null; profilePhotoUrl: string | null } }) {
  return user.profilePhotoUrl ? <img className={styles.avatar} src={user.profilePhotoUrl} alt={`${user.username}'s profile`} /> : <span className={styles.avatar}>{user.username?.[0]?.toUpperCase() ?? "S"}</span>;
}

function FeedSkeleton({ single = false }: { single?: boolean }) {
  return <div className={styles.feed} role="status" aria-label="Loading posts">
    <span className={styles.srOnly}>Loading moments…</span>
    {Array.from({ length: single ? 1 : 2 }, (_, index) => <div key={index} className={styles.photoCard} aria-hidden="true">
      <header><span className={`${styles.skeleton} ${styles.skeletonAvatar}`} /><div className={styles.skeletonByline}><span className={`${styles.skeleton} ${styles.skeletonLine}`} /><span className={`${styles.skeleton} ${styles.skeletonShort}`} /></div></header>
      <div className={`${styles.skeleton} ${styles.skeletonPhoto}`} />
      <div className={styles.skeletonCaption}><span className={`${styles.skeleton} ${styles.skeletonLine}`} /><span className={`${styles.skeleton} ${styles.skeletonShort}`} /></div>
      <div className={styles.skeletonActions}>{[0, 1, 2].map(item => <span key={item} className={`${styles.skeleton} ${styles.skeletonLine}`} />)}</div>
    </div>)}
  </div>;
}

function FeedImage({ photo }: { photo: Photo }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setState("ready");
  }, []);
  return <div className={styles.photoFrame}>
    {state === "loading" && <span className={`${styles.skeleton} ${styles.imagePlaceholder}`} aria-hidden="true" />}
    <img ref={imageRef}
      className={`${styles.photo} ${styles.feedImage} ${state === "ready" ? styles.imageReady : ""}`}
      loading="lazy" decoding="async" draggable={false} src={photo.downloadUrl}
      onLoad={() => setState("ready")} onError={() => setState("error")}
      alt={photo.description || `An animal photo shared by ${photo.username ?? "the schlawgs"}`} />
    {state === "error" && <span className={styles.imageError}>This photo couldn’t load. Open it to try again.</span>}
  </div>;
}

export default function Community({ postId, discovery }: { postId?: string; discovery?: "popular" | "niche" | "relevant" }) {
  const openTutorial = useTutorial();
  const [feed, setFeed] = useState<"latest" | "interacted" | "mine">("latest");
  const photosUrl = postId ? `/api/posts/${postId}` : `/api/photos?feed=${feed}`;
  const { user, setUser, ready, accountError } = useAccount();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [feedError, setFeedError] = useState("");
  const [mode, setMode] = useState<"register" | "login">("register");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const updateCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const feedRequest = useRef(0);
  const feedCache = useRef(new FeedCache<Photo[]>());
  const feedKey = `${user?.id ?? "guest"}:${photosUrl}`;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [descriptionMode, setDescriptionMode] = useState<"individual" | "shared">("individual");
  const [sharedDescription, setSharedDescription] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDetailsElement>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const composerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!composerOpen) return;
    const dialog = composerRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, [composerOpen]);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) accountRef.current.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  async function refresh() {
    const request = ++feedRequest.current;
    try { const items = await feedCache.current.read(feedKey, () => api<Photo[]>(photosUrl), true); if (request === feedRequest.current) { setPhotos(items); setFeedError(""); } }
    catch (e) { if (request === feedRequest.current) { setPhotos([]); setFeedError((e as Error).message); } }
    finally { if (request === feedRequest.current) setFeedLoading(false); }
  }
  useEffect(() => {
    return () => { draftRef.current.forEach(d => URL.revokeObjectURL(d.url)); };
  }, []);
  useEffect(() => {
    if (!ready || (!user && !postId && feed !== "latest")) return;
    let active = true;
    const request = ++feedRequest.current;
    feedCache.current.read(feedKey, () => api<Photo[]>(photosUrl)).then(items => { if (active && request === feedRequest.current) { setPhotos(items); setFeedError(""); } })
      .catch((e: Error) => { if (active && request === feedRequest.current) { setPhotos([]); setFeedError(e.message); } })
      .finally(() => { if (active && request === feedRequest.current) setFeedLoading(false); });
    return () => { active = false; };
  }, [photosUrl, feedKey, ready, user, postId, feed]);

  function chooseFeed(next: "latest" | "interacted" | "mine") {
    if (next === feed) return;
    const cached = feedCache.current.peek(`${user?.id ?? "guest"}:/api/photos?feed=${next}`);
    feedRequest.current++; setPhotos(cached ?? []); setFeedError(""); setFeedLoading(cached === undefined); setFeed(next);
  }

  function updateDrafts(next: Draft[]) { draftRef.current = next; setDrafts(next); }
  function clearDrafts() { draftRef.current.forEach(d => URL.revokeObjectURL(d.url)); updateDrafts([]); setSharedDescription(""); setDescriptionMode("individual"); if (fileRef.current) fileRef.current.value = ""; }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    if (captchaToken === null) { event.preventDefault(); return; }
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const data = new FormData(event.currentTarget);
    try {
      setUser(await api<User>(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: data.get("username"), password: data.get("password"), captchaToken }) }));
      if (mode === "register") openTutorial();
      setNotice(mode === "register" ? "Very much welcome Schlawg! Add a profile picture and share your first moment." : "Welcome back!");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); setCaptchaToken(null); setCaptchaAttempt(value => value + 1); }
  }

  function chooseFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (drafts.length + selected.length > 10 || [...drafts.map(d => d.file), ...selected].reduce((sum, f) => sum + f.size, 0) > 50 * 1024 * 1024) { setError("Choose up to 10 photos and 50 MB per post."); return; }
    if (selected.some(f => !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(f.type) || f.size === 0 || f.size > 10 * 1024 * 1024)) { setError("Use JPEG, PNG, GIF, or WebP images, up to 10 MB each."); return; }
    setError(""); setNotice("");
    updateDrafts([...drafts, ...selected.map(file => ({ file, url: URL.createObjectURL(file), description: "" }))]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function upload(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const data = new FormData();
    drafts.forEach(d => { data.append("files", d.file); data.append("descriptions", descriptionMode === "shared" ? sharedDescription : d.description); });
    try { await api("/api/photos", { method: "POST", body: data }); clearDrafts(); setComposerOpen(false); chooseFeed("latest"); setNotice("Your photos are shared with the other Schlawgs."); if (feed === "latest") await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function chooseProfile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) { setError("Choose a JPEG, PNG, GIF, or WebP profile picture up to 10 MB."); return; }
    setError(""); setNotice(""); setProfileFile(file);
  }

  async function profile(file: File) {
    setBusy(true); setError(""); setNotice("");
    const data = new FormData(); data.append("file", file);
    try { setUser(await api<User>("/api/profile/photo", { method: "POST", body: data })); setProfileFile(null); setNotice("Profile picture updated."); await refresh(); }
    finally { setBusy(false); }
  }

  return <main className={styles.shell} id="top">
    {editingDraft && <PhotoEditor file={editingDraft.file} onCancel={() => setEditingDraft(null)} onApply={file => {
      const total = drafts.reduce((sum, draft) => sum + (draft.url === editingDraft.url ? file.size : draft.file.size), 0);
      if (total > 50 * 1024 * 1024) throw new Error("This edit would exceed the 50 MB post limit. Try a smaller crop.");
      const url = URL.createObjectURL(file);
      updateDrafts(drafts.map(draft => draft.url === editingDraft.url ? { ...draft, file, url } : draft));
      URL.revokeObjectURL(editingDraft.url);
      setEditingDraft(null);
    }} />}
    {profileFile && <ProfileCropper file={profileFile} onCancel={() => setProfileFile(null)} onSave={profile} />}
    <nav className={styles.nav} aria-label="Main navigation"><div className={styles.brandGroup}>{user ? <details className={styles.accountMenu} ref={accountRef} onKeyDown={event => {
            if (event.key === "Escape" && accountRef.current?.open) {
              accountRef.current.open = false;
              accountRef.current.querySelector("summary")?.focus();
            }
          }}>
            <summary className={styles.accountTrigger} aria-label={`Account options for ${user.username}`}>
              <Avatar user={user} /><span className={styles.hamburger} aria-hidden="true"><span /><span /><span /></span>
            </summary>
            <div className={styles.accountDropdown}>
            <strong className={styles.accountName}>@{user.username}</strong><Link href="/account/animals">My VERY OWN Schlawgs</Link>{(user.isAdmin || user.isModerator) && <Link href="/moderation">Moderation queue</Link>}
            <NotificationBell key={`notifications-${user.id}`} onOpen={() => { if (accountRef.current) accountRef.current.open = false; }} onClose={() => { requestAnimationFrame(() => accountRef.current?.querySelector("summary")?.focus()); }} />
            <label className={styles.fileButton}>Change profile picture<input aria-label="Change profile picture" disabled={busy} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={e => { chooseProfile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button className={styles.textButton} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await api("/api/auth/logout", { method: "POST" }); setUser(null); chooseFeed("latest"); clearDrafts(); setNotice(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Log out</button>
            </div>
          </details> : null}<Link className={styles.brand} href="/">{!user && <span aria-hidden="true">S</span>}mySchlawgs</Link></div><RandomPost key={`random-${user?.id ?? "guest"}`} postId={postId} ready={ready && !busy} initialCategory={discovery} /></nav>
    <div className={`${styles.layout} ${user ? styles.memberLayout : ""}`}>
      {!user && <aside className={styles.sidebar} id="account">
        {!ready ? <p className={styles.muted} role="status">Getting your account…</p> : <section className={styles.profile}>
            <p className={styles.eyebrow}>There more room for ya!</p><h2>{mode === "register" ? "Make yourself at home." : "Welcome back."}</h2>
            <p className={styles.muted}>{mode === "register" ? "Create an account to share your animals. No email needed." : "Log in to share another good moment."}</p>
            <form onSubmit={authenticate} className={styles.form}>
              <label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" placeholder="e.g. milos_human" /></label>
              <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /></label>
              <Captcha key={captchaAttempt} onChange={updateCaptcha} />
              <button disabled={busy || captchaToken === null}>{busy ? "One moment…" : mode === "register" ? "Join the big group schlawgs" : "Log in"}</button>
            </form>
            <button className={styles.textButton} disabled={busy} onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>{mode === "register" ? "Already a member? Log in" : "New here? Create an account"}</button>
        </section>}
      </aside>}
      <section className={`${styles.content} ${postId ? styles.singlePost : ""}`} id="feed">
        {(error || accountError) && !composerOpen && <p className={styles.error} role="alert">{error || accountError}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
        {user && !postId && <dialog ref={composerRef} className={styles.composerDialog} aria-labelledby="composer-title" onCancel={event => { event.preventDefault(); if (!busy) setComposerOpen(false); }} onClick={event => { if (event.target === event.currentTarget && !busy) setComposerOpen(false); }}>
        <form className={styles.composerForm} onSubmit={upload} aria-busy={busy}>
          <div className={styles.composerHeader}><p className={styles.eyebrow}>A moment worth sharing</p><button type="button" disabled={busy} onClick={() => setComposerOpen(false)} aria-label="Close post composer">✕</button></div>
          <h2 id="composer-title">What&apos;s your schlawg up to?</h2><p className={styles.muted}>Add up to 10 photos with one shared description or a story for each. 10 MB per photo, 50 MB total. Your draft stays here if you close this window.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <label className={styles.fileButton}>+ Choose photos<input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={e => chooseFiles(e.target.files)} /></label>
          {drafts.length > 1 && <fieldset className={styles.descriptionOptions} disabled={busy}>
            <legend>Photo descriptions</legend>
            <label><input type="radio" name="descriptionMode" checked={descriptionMode === "individual"} onChange={() => setDescriptionMode("individual")} />Individual description for each photo</label>
            <label><input type="radio" name="descriptionMode" checked={descriptionMode === "shared"} onChange={() => setDescriptionMode("shared")} />One description for all photos</label>
            <p className={styles.muted}>Switching options keeps your draft text. Only the selected option is published.</p>
          </fieldset>}
          {drafts.length > 0 && descriptionMode === "shared" && <label className={styles.sharedDescription}>Description for all photos<textarea maxLength={2000} value={sharedDescription} disabled={busy} placeholder="Tell the story behind this moment…" onChange={e => setSharedDescription(e.target.value)} /></label>}
          {drafts.length > 0 && <div className={styles.drafts}>{drafts.map((draft, i) => <div className={styles.draft} key={draft.url}>
            <img src={draft.url} alt={`Preview of ${draft.file.name}`} /><div><button type="button" className={styles.textButton} disabled={busy} onClick={() => setEditingDraft(draft)}>Edit photo</button>{descriptionMode === "individual" ? <label>Description for {draft.file.name}<textarea maxLength={2000} value={draft.description} placeholder="Tell the story behind this photo…" disabled={busy} onChange={e => updateDrafts(drafts.map((d, j) => j === i ? { ...d, description: e.target.value } : d))} /></label> : <p className={styles.muted}>{draft.file.name} · Uses the shared description</p>}<button type="button" className={styles.textButton} disabled={busy} onClick={() => { URL.revokeObjectURL(draft.url); updateDrafts(drafts.filter((_, j) => j !== i)); }}>Remove photo</button></div>
          </div>)}</div>}
          <div className={styles.composeActions}>
            <button disabled={busy || !drafts.length}>{busy ? "Saving…" : `Share ${drafts.length || "your"} photo${drafts.length === 1 ? "" : "s"}`}</button>
            {drafts.length > 0 && <button type="button" className={styles.addMore} disabled={busy || drafts.length >= 10} onClick={() => fileRef.current?.click()}>{drafts.length >= 10 ? "10 photo limit reached" : "+ Add more photos"}</button>}
          </div>
        </form></dialog>}
        <div className={styles.feedHeading}><div><h2 className={styles.eyebrow}>{discovery ? { popular: "Popular · Community favorites", niche: "Niche · Hidden gems", relevant: "Relevant · Recent conversations" }[discovery] : "Fresh from the bill collectors"}</h2>{postId ? <h2>Your desired post!</h2> : <div className={styles.feedMenu} role="group" aria-label="Choose your feed">
          <button type="button" aria-pressed={feed === "latest"} onClick={() => chooseFeed("latest")}>Latest moments</button>
          <button type="button" aria-pressed={feed === "interacted"} onClick={() => chooseFeed("interacted")}>Liked / interacted</button>
          <button type="button" aria-pressed={feed === "mine"} onClick={() => chooseFeed("mine")}>My photos</button>
          <button type="button" className={styles.sharePostButton} disabled={!ready || busy} aria-haspopup="dialog" onClick={() => { if (!user) { setNotice("Log in or create an account to share a post."); document.querySelector<HTMLInputElement>('#account input[name="username"]')?.focus(); return; } setError(""); setComposerOpen(true); }}>+ Share a post</button>
        </div>}</div>{postId && <Link className={styles.backToFeed} href="/">← Go back to main feed</Link>}</div>
        {!postId && feed !== "latest" && ready && !user ? <div className={styles.empty}><h2>Your personal feed</h2><p><a href="#account">Log in or sign up</a> to see {feed === "mine" ? "your photos" : "posts you’ve liked or commented on"}.</p></div> : feedLoading || !ready ? <FeedSkeleton single={!!postId} /> : feedError ? <div className={styles.card} role="alert"><p>{feedError}</p><button onClick={() => void refresh()}>Try again</button></div> : !photos.length ? <div className={styles.empty}><span>♡</span><h2>{feed === "interacted" ? "Your favorites start here." : "A good moment starts here."}</h2><p>{feed === "mine" ? "Your photos will appear here once you share them." : feed === "interacted" ? "React to a post, leave a comment or reply, or like a comment to find that post here." : "Be the first to introduce your animal to the other schlawgs."}</p></div> : <div className={styles.feed}>{groupPhotoBatches(photos).map(batch => <PhotoCard key={batch[0].batchId ?? batch[0].id} photos={batch} userId={user?.id ?? null} owner={batch[0].ownerId === user?.id} onSaved={refresh} />)}</div>}
      </section>
    </div><footer className={styles.footer}><strong>mySchlawgs</strong><Link href="/our-mission">Our mission</Link><TutorialLink /><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link><span></span></footer>
  </main>;
}

function PhotoCard({ photos, owner, onSaved, userId }: { photos: Photo[]; userId: string | null; owner: boolean; onSaved: () => Promise<void> }) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingCaption, setEditingCaption] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const index = Math.min(activeIndex, photos.length - 1);
  const photo = photos[index];
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let width = track.clientWidth;
    const observer = new ResizeObserver(() => {
      if (track.clientWidth === width) return;
      width = track.clientWidth;
      track.scrollTo({ left: index * track.clientWidth, behavior: "instant" });
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [index]);
  function navigateTo(next: number) {
    if (editingCaption) return;
    const track = trackRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function navigate(direction: number) { navigateTo((index + direction + photos.length) % photos.length); }
  return <article className={`${styles.photoCard} ${styles.postReveal}`} aria-roledescription={photos.length > 1 ? "carousel" : undefined} aria-label={`Photos by ${photo.username ?? "the schlawgs"}`}>
    {focusIndex !== null && <PhotoFocus photos={photos} initialIndex={focusIndex} onClose={next => { setFocusIndex(null); setActiveIndex(next); trackRef.current?.scrollTo({ left: next * trackRef.current.clientWidth, behavior: "instant" }); }} />}
    <header><Avatar user={photo} /><div><strong>{photo.username ? `@${photo.username}` : "From the original shclawginsteins"}</strong><time dateTime={photo.uploadedAt}>{new Date(photo.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></div></header>
    <div className={styles.carousel} tabIndex={photos.length > 1 ? 0 : undefined} aria-label="Photo viewer. Use left and right arrow keys to browse." onKeyDown={event => {
      if (editingCaption || photos.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault(); navigate(event.key === "ArrowLeft" ? -1 : 1);
    }}>
      <div ref={trackRef} className={styles.carouselTrack} style={editingCaption ? { overflowX: "hidden" } : undefined} onScroll={event => {
        const track = event.currentTarget;
        if (track.clientWidth) setActiveIndex(Math.min(photos.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth))));
      }}>
        {photos.map((item, slideIndex) => <button type="button" key={item.id} className={`${styles.carouselSlide} ${styles.openPhoto}`} onClick={() => setFocusIndex(slideIndex)} aria-label={`Open photo ${slideIndex + 1} in focus view`} aria-haspopup="dialog" disabled={editingCaption} tabIndex={slideIndex === index ? 0 : -1} aria-hidden={slideIndex !== index} draggable={false}>
          <FeedImage key={item.downloadUrl} photo={item} />
        </button>)}
      </div>
      {photos.length > 1 && <>
        <button type="button" className={`${styles.carouselArrow} ${styles.previous}`} aria-label="Previous photo" disabled={editingCaption} onClick={() => navigate(-1)}>‹</button>
        <button type="button" className={`${styles.carouselArrow} ${styles.next}`} aria-label="Next photo" disabled={editingCaption} onClick={() => navigate(1)}>›</button>
        <span className={styles.slideCount} aria-live="polite" aria-atomic="true">{index + 1} / {photos.length}</span>
      </>}
    </div>
    {photos.length > 1 && <div className={styles.carouselDots} aria-label="Choose a photo">{photos.map((item, slideIndex) => <button key={item.id} type="button" aria-label={`Go to photo ${slideIndex + 1}`} aria-pressed={slideIndex === index} disabled={editingCaption} onClick={() => navigateTo(slideIndex)}><span /></button>)}</div>}
    <PhotoCaption key={`${photo.id}-${owner}`} photo={photo} owner={owner} onSaved={onSaved} onEditingChange={setEditingCaption} />
    <PostSocial key={userId ?? "guest"} postId={photos[0].postId ?? photos[0].batchId ?? photos[0].id} userId={userId} photoId={photo.id} slideNumber={index + 1} postAuthor={photos[0]} onRemoved={onSaved} />
  </article>;
}

function PhotoCaption({ photo, owner, onSaved, onEditingChange }: { photo: Photo; owner: boolean; onSaved: () => Promise<void>; onEditingChange: (editing: boolean) => void }) {
  useEffect(() => () => onEditingChange(false), [onEditingChange]);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(photo.description);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className={styles.caption} aria-live="polite">{editing ? <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await api(`/api/photos/${photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) }); await onSaved(); setEditing(false); onEditingChange(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><label>Description<textarea value={description} maxLength={2000} disabled={busy} onChange={e => setDescription(e.target.value)} /></label><button disabled={busy}>{busy ? "Saving…" : "Save description"}</button><button type="button" className={styles.textButton} disabled={busy} onClick={() => { setEditing(false); onEditingChange(false); }}>Cancel</button>{error && <p role="alert">{error}</p>}</form> : <>{photo.description && <p>{photo.description}</p>}{owner && <button className={styles.textButton} onClick={() => { setDescription(photo.description); setError(""); setEditing(true); onEditingChange(true); }}>{photo.description ? "Edit description" : "Add a description"}</button>}</>}</div>;
}





