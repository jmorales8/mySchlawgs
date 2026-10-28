"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./community.module.css";
import Link from "next/link";
import { api } from "../api";
import { usePhotoFeed, type Feed } from "../../hooks/use-photo-feed";
import { useFeedCaughtUp } from "../../hooks/use-feed-caught-up";
import RandomPost from "./random-post";
import NotificationBell from "../notifications/notification-bell";
import ProfileCropper from "../photos/profile-cropper";
import PhotoEditor from "../photos/photo-editor";
import Captcha from "../captcha";
import { TutorialLink } from "../tutorial/tutorial-link";
import { useTutorial } from "../../contexts/tutorial-context";
import { groupPhotoBatches } from "../photos/photo-batches";
import { useAccount, type User } from "../../contexts/account-context";
import Avatar from "../shared/avatar";
import ThemeToggle from "../shared/theme-toggle";
import FeedSkeleton from "./feed-skeleton";
import PhotoCard from "./photo-card";

type Draft = { file: File; url: string; description: string };

export default function Community({ postId, discovery }: { postId?: string; discovery?: "popular" | "niche" | "relevant" }) {
  const openTutorial = useTutorial();
  const [feed, setFeed] = useState<Feed>("latest");
  const { user, setUser, ready, accountError } = useAccount();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const updateCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: photos = [], loading: feedLoading, refreshing: feedRefreshing, error: feedError, refresh } = usePhotoFeed(feed, postId);
  const feedCaughtUp = useFeedCaughtUp(user?.id ?? "guest", photos.map(photo => photo.postId ?? photo.batchId ?? photo.id), ready && !postId && feed === "latest" && !feedLoading && !feedRefreshing && !feedError);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [descriptionMode, setDescriptionMode] = useState<"individual" | "shared">("individual");
  const [sharedDescription, setSharedDescription] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDetailsElement>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerClosing, setComposerClosing] = useState<"uploaded" | "cancelled" | null>(null);
  const [uploadToast, setUploadToast] = useState<{ message: string; success: boolean } | null>(null);
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

  useEffect(() => {
    return () => { draftRef.current.forEach(d => URL.revokeObjectURL(d.url)); };
  }, []);
  function chooseFeed(next: Feed) { setFeed(next); }

  function updateDrafts(next: Draft[]) { draftRef.current = next; setDrafts(next); }
  const clearDrafts = useCallback(() => { draftRef.current.forEach(d => URL.revokeObjectURL(d.url)); draftRef.current = []; setDrafts([]); setSharedDescription(""); setDescriptionMode("individual"); if (fileRef.current) fileRef.current.value = ""; }, []);

  useEffect(() => {
    if (!composerClosing) return;
    const timeout = window.setTimeout(() => {
      if (composerClosing === "uploaded") clearDrafts();
      setComposerOpen(false);
      setComposerClosing(null);
      setUploadToast({ message: composerClosing === "uploaded" ? "Photo uploaded" : "Photo not uploaded", success: composerClosing === "uploaded" });
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [composerClosing, clearDrafts]);

  useEffect(() => {
    if (!uploadToast) return;
    const timeout = window.setTimeout(() => setUploadToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [uploadToast]);

  function dismissComposer() {
    if (!busy && !composerClosing) setComposerClosing("cancelled");
  }

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
    event.preventDefault();
    if (busy || composerClosing || !drafts.length) return;
    setBusy(true); setError(""); setNotice("");
    const data = new FormData();
    drafts.forEach(d => { data.append("files", d.file); data.append("descriptions", descriptionMode === "shared" ? sharedDescription : d.description); });
    try { await api("/api/photos", { method: "POST", body: data }); setComposerClosing("uploaded"); chooseFeed("latest"); if (feed === "latest") await refresh(); }
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
    <div className={styles.uploadToastRegion} role="status" aria-live="polite" aria-atomic="true">
      {uploadToast && <div className={styles.uploadToast} data-success={uploadToast.success}><span aria-hidden="true">{uploadToast.success ? "✓" : "ⓘ"}</span>{uploadToast.message}<button type="button" aria-label="Dismiss upload notification" onClick={() => setUploadToast(null)}>✕</button></div>}
    </div>
    {editingDraft && <PhotoEditor file={editingDraft.file} onCancel={() => setEditingDraft(null)} onApply={file => {
      const total = drafts.reduce((sum, draft) => sum + (draft.url === editingDraft.url ? file.size : draft.file.size), 0);
      if (total > 50 * 1024 * 1024) throw new Error("This edit would exceed the 50 MB post limit. Try a smaller crop.");
      const url = URL.createObjectURL(file);
      updateDrafts(drafts.map(draft => draft.url === editingDraft.url ? { ...draft, file, url } : draft));
      URL.revokeObjectURL(editingDraft.url);
      setEditingDraft(null);
    }} />}
    {profileFile && <ProfileCropper file={profileFile} onCancel={() => setProfileFile(null)} onSave={profile} />}
    <nav className={styles.nav} aria-label="Main navigation"><div className={styles.brandGroup}><details className={styles.accountMenu} ref={accountRef} onKeyDown={event => {
            if (event.key === "Escape" && accountRef.current?.open) {
              accountRef.current.open = false;
              accountRef.current.querySelector("summary")?.focus();
            }
          }}>
            <summary className={styles.accountTrigger} aria-label={user ? `Account options for ${user.username}` : "Open menu"}>
              {user ? <><Avatar user={user} className={styles.avatar} /><span className={styles.hamburger} aria-hidden="true"><span /><span /><span /></span></> : <svg className={styles.guestMenuIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h14" /></svg>}
            </summary>
            <div className={styles.accountDropdown}>
            {user && <><strong className={styles.accountName}>@{user.username}</strong><Link href="/account/animals">My VERY OWN Schlawgs</Link>{(user.isAdmin || user.isModerator) && <Link href="/moderation">Moderation queue</Link>}
            <NotificationBell key={`notifications-${user.id}`} onOpen={() => { if (accountRef.current) accountRef.current.open = false; }} onClose={() => { requestAnimationFrame(() => accountRef.current?.querySelector("summary")?.focus()); }} />
            <label className={styles.fileButton}>Change profile picture<input aria-label="Change profile picture" disabled={busy} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={e => { chooseProfile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <ThemeToggle />
            <button className={styles.textButton} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await api("/api/auth/logout", { method: "POST" }); setUser(null); chooseFeed("latest"); clearDrafts(); setNotice(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Log out</button></>}
            </div>
          </details><Link className={styles.brand} href="/">{!user && <span aria-hidden="true">S</span>}<span className={styles.brandText}>mySchlawgs</span></Link></div><RandomPost key={`random-${user?.id ?? "guest"}`} postId={postId} ready={ready && !busy} initialCategory={discovery} /></nav>
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
        {user && !postId && <dialog ref={composerRef} className={styles.composerDialog} data-closing={composerClosing !== null} aria-labelledby="composer-title" onCancel={event => { event.preventDefault(); dismissComposer(); }} onClick={event => { if (event.target === event.currentTarget) dismissComposer(); }}>
        <form className={styles.composerForm} onSubmit={upload} aria-busy={busy} inert={composerClosing !== null}>
          <div className={styles.composerHeader}><p className={styles.eyebrow}>A moment worth sharing</p><button type="button" disabled={busy || composerClosing !== null} onClick={dismissComposer} aria-label="Close post composer">✕</button></div>
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
        <div className={styles.feedHeading}><div><h2 className={styles.eyebrow}>{discovery ? { popular: "Popular · Community favorites", niche: "Niche · Hidden gems", relevant: "Relevant · Recent conversations" }[discovery] : feedCaughtUp ? "Nothing new from the bill collector :(" : "Fresh from the bill collectors"}</h2>{postId ? <h2>Your desired post!</h2> : <div className={styles.feedMenu} role="group" aria-label="Choose your feed">
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
