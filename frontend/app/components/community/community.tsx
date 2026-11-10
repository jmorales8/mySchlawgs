"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import sharedStyles from "./community.module.css";
import composerStyles from "./post-composer.module.css";
import layoutStyles from "./community-layout.module.css";
import Link from "next/link";
import { api } from "../api";
import { usePhotoFeed, type Feed } from "../../hooks/use-photo-feed";
import { useFeedCaughtUp } from "../../hooks/use-feed-caught-up";
import RandomPost from "./feed/random-post";
import MySchlawgs from "./profiles/my-schlawgs";
import VoteLeaders from "./profiles/vote-leaders";
import ProfileCropper from "../photos/profile-cropper";
import PhotoEditor from "../photos/photo-editor";
import Captcha from "../captcha";
import { TutorialLink } from "../tutorial/tutorial-link";
import { useTutorial } from "../../contexts/tutorial-context";
import { groupPhotoBatches } from "../photos/photo-batches";
import { useAccount, type User } from "../../contexts/account-context";
import Avatar from "../shared/avatar";
import ErrorToast from "../shared/error-toast";
import ThemeToggle from "../shared/theme-toggle";
import FeedEnding from "./feed/feed-ending";
import FeedSkeleton from "./feed/feed-skeleton";
import PhotoCard from "./feed/photo-card";

type AnimalOption = { id: string; name: string; animalType: string; profilePhotoUrl: string | null };
type Draft = { file: File; url: string; description: string; animalIds: string[] };

export default function Community({ postId, discovery }: { postId?: string; discovery?: "popular" | "niche" | "relevant" }) {
  const openTutorial = useTutorial();
  const [feed, setFeed] = useState<Feed>("latest");
  const { user, setUser, ready, accountError } = useAccount();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const updateCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: photos = [], loading: feedLoading, refreshing: feedRefreshing, error: feedError, refresh } = usePhotoFeed(feed, postId);
  const feedCaughtUp = useFeedCaughtUp(user?.id ?? "guest", photos.map(photo => photo.postId ?? photo.batchId ?? photo.id), ready && !postId && feed === "latest" && !feedLoading && !feedRefreshing && !feedError);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [descriptionMode, setDescriptionMode] = useState<"individual" | "shared">("individual");
  const [sharedDescription, setSharedDescription] = useState("");
  const [animalProfilesResult, setAnimalProfilesResult] = useState<{ ownerId: string; items: AnimalOption[]; failed: boolean } | null>(null);
  const userId = user?.id;
  const animalProfiles = userId && animalProfilesResult?.ownerId === userId ? animalProfilesResult.items : [];
  const animalProfilesLoading = !!userId && animalProfilesResult?.ownerId !== userId;
  const [animalPicker, setAnimalPicker] = useState<{ draftUrl: string; closing: boolean } | null>(null);
  const animalPickerRef = useRef<HTMLDivElement>(null);
  const closeAnimalPicker = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimalPicker(null);
      return;
    }
    setAnimalPicker(current => current && !current.closing ? { ...current, closing: true } : current);
  }, []);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerClosing, setComposerClosing] = useState<"uploaded" | "cancelled" | null>(null);
  const [uploadToast, setUploadToast] = useState<{ message: string; success: boolean } | null>(null);
  const composerRef = useRef<HTMLDialogElement>(null);
  const accountRef = useRef<HTMLDetailsElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuClosing, setAccountMenuClosing] = useState(false);
  const closeAccountMenu = useCallback(() => {
    if (!accountMenuOpen || accountMenuClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAccountMenuOpen(false);
      return;
    }
    setAccountMenuClosing(true);
  }, [accountMenuOpen, accountMenuClosing]);
  useEffect(() => {
    if (!accountMenuClosing) return;
    const timeout = window.setTimeout(() => {
      setAccountMenuOpen(false);
      setAccountMenuClosing(false);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [accountMenuClosing]);
  useEffect(() => {
    if (!animalPicker?.closing) return;
    const draftUrl = animalPicker.draftUrl;
    const timeout = window.setTimeout(() => {
      setAnimalPicker(current => current?.draftUrl === draftUrl && current.closing ? null : current);
    }, 160);
    return () => window.clearTimeout(timeout);
  }, [animalPicker]);
  useEffect(() => {
    if (!animalPicker || animalPicker.closing) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (animalPickerRef.current && !animalPickerRef.current.contains(event.target as Node)) closeAnimalPicker();
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [animalPicker, closeAnimalPicker]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadAnimalProfiles = () => {
      api<AnimalOption[]>("/api/account/animals")
        .then(items => { if (active) setAnimalProfilesResult({ ownerId: userId, items, failed: false }); })
        .catch(() => { if (active) setAnimalProfilesResult({ ownerId: userId, items: [], failed: true }); });
    };
    loadAnimalProfiles();
    window.addEventListener("focus", loadAnimalProfiles);
    return () => { active = false; window.removeEventListener("focus", loadAnimalProfiles); };
  }, [userId]);
  useEffect(() => {
    function close(event: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) closeAccountMenu();
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [closeAccountMenu]);

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
    event.preventDefault(); setBusy(true); setAuthError(""); setError(""); setNotice("");
    const data = new FormData(event.currentTarget);
    try {
      setUser(await api<User>(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: data.get("username"), password: data.get("password"), captchaToken }) }));
      if (mode === "register") openTutorial();
      setNotice(mode === "register" ? "Very much welcome Schlawg! Add a profile picture and share your first moment." : "Welcome back!");
    } catch (e) { setAuthError((e as Error).message); } finally { setBusy(false); setCaptchaToken(null); setCaptchaAttempt(value => value + 1); }
  }

  function chooseFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (drafts.length + selected.length > 10 || [...drafts.map(d => d.file), ...selected].reduce((sum, f) => sum + f.size, 0) > 50 * 1024 * 1024) { setError("Choose up to 10 photos and 50 MB per post."); return; }
    if (selected.some(f => !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(f.type) || f.size === 0 || f.size > 10 * 1024 * 1024)) { setError("Use JPEG, PNG, GIF, or WebP images, up to 10 MB each."); return; }
    setError(""); setNotice("");
    updateDrafts([...drafts, ...selected.map(file => ({ file, url: URL.createObjectURL(file), description: "", animalIds: [] }))]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (busy || composerClosing || !drafts.length) return;
    setBusy(true); setError(""); setNotice("");
    const data = new FormData();
    drafts.forEach(d => { data.append("files", d.file); data.append("descriptions", descriptionMode === "shared" ? sharedDescription : d.description); });
    data.append("animalIds", JSON.stringify(drafts.map(d => d.animalIds)));
    try { await api("/api/photos", { method: "POST", body: data }); setComposerClosing("uploaded"); chooseFeed("latest"); if (feed === "latest") await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function chooseProfile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) { setError(`“${file.name}” isn’t a supported photo format. Choose a JPEG, PNG, GIF, or WebP image.`); return; }
    if (file.size === 0) { setError(`“${file.name}” is empty. Choose another photo or export it again.`); return; }
    if (file.size > 10 * 1024 * 1024) { setError(`“${file.name}” is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Profile pictures must be 10 MB or smaller. Resize or compress it, then try again.`); return; }
    setError(""); setNotice(""); setProfileFile(file);
  }

  async function profile(file: File) {
    setBusy(true); setError(""); setNotice("");
    const data = new FormData(); data.append("file", file);
    try { setUser(await api<User>("/api/profile/photo", { method: "POST", body: data })); setProfileFile(null); setNotice("Profile picture updated."); await refresh(); }
    finally { setBusy(false); }
  }

  return <main className={sharedStyles.shell} id="top">
    <div className={composerStyles.uploadToastRegion} role="status" aria-live="polite" aria-atomic="true">
      {uploadToast && <div className={composerStyles.uploadToast} data-success={uploadToast.success}><span aria-hidden="true">{uploadToast.success ? "✓" : "ⓘ"}</span>{uploadToast.message}<button type="button" aria-label="Dismiss upload notification" onClick={() => setUploadToast(null)}>✕</button></div>}
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
    <div className={layoutStyles.feedFrame}>
    <nav className={layoutStyles.nav} aria-label="Main navigation"><div className={layoutStyles.brandGroup}>
      <Link className={layoutStyles.brand} href="/"><span className={layoutStyles.brandText}>mySchlawgs</span></Link>
      {user && <details open={accountMenuOpen} className={layoutStyles.accountMenu} ref={accountRef} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); closeAccountMenu(); accountRef.current?.querySelector("summary")?.focus(); }
      }}><summary className={layoutStyles.accountTrigger} aria-expanded={accountMenuOpen && !accountMenuClosing} aria-label={`Account options for ${user.username}`} onClick={event => {
        event.preventDefault();
        if (accountMenuClosing) setAccountMenuClosing(false);
        else if (accountMenuOpen) closeAccountMenu();
        else { setAccountMenuClosing(false); setAccountMenuOpen(true); }
      }}>
        <Avatar user={user} className={layoutStyles.avatar} /><span className={layoutStyles.profileSummary}>@{user.username}</span><span className={layoutStyles.hamburger} aria-hidden="true"><span /><span /><span /></span>
      </summary>{accountMenuOpen && <div className={`${layoutStyles.accountDropdown}${accountMenuClosing ? ` ${layoutStyles.accountDropdownClosing}` : ""}`} aria-hidden={accountMenuClosing} inert={accountMenuClosing}>{(user.isAdmin || user.isModerator) && <Link href="/moderation">Moderation queue</Link>}            <label className={`${layoutStyles.fileButton} ${composerStyles.fileButton}`}>Change profile picture<input aria-label="Change profile picture" disabled={busy} type="file" accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" onChange={e => { chooseProfile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <ThemeToggle />
            <Link href="/account/email" className={layoutStyles.textButton}>Verify email</Link>
            <button className={layoutStyles.textButton} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await api("/api/auth/logout", { method: "POST" }); setAccountMenuOpen(false); setAccountMenuClosing(false); setUser(null); chooseFeed("latest"); clearDrafts(); setNotice(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Log out</button></div>}</details>}
    </div>
      {!postId && <div className={layoutStyles.feedMenu} role="group" aria-label="Choose your feed">
          <button type="button" aria-pressed={feed === "latest"} onClick={() => chooseFeed("latest")}>Latest moments</button>
          <button type="button" aria-pressed={feed === "interacted"} onClick={() => chooseFeed("interacted")}>Liked / interacted</button>
          <button type="button" aria-pressed={feed === "mine"} onClick={() => chooseFeed("mine")}>My photos</button>
          <button type="button" className={layoutStyles.sharePostButton} disabled={!ready || busy} aria-haspopup="dialog" onClick={() => { if (!user) { setNotice("Log in or create an account to share a post."); document.querySelector<HTMLInputElement>('#account input[name="username"]')?.focus(); return; } setError(""); setComposerOpen(true); }}>+ Share a post</button>
        </div>}
      <RandomPost key={`random-${user?.id ?? "guest"}`} postId={postId} ready={ready && !busy} initialCategory={discovery} />

      <div className={layoutStyles.sideLinks}><Link href="/our-mission">Our mission</Link><TutorialLink /><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link></div>
    </nav>
    <div className={`${layoutStyles.layout} ${!ready || user ? layoutStyles.memberLayout : ""}`}>
      {ready && !user && <aside className={layoutStyles.sidebar} id="account">
        <section className={layoutStyles.profile}>
            <p className={`${layoutStyles.eyebrow} ${composerStyles.eyebrow}`}>There more room for ya!</p><h2>{mode === "register" ? "Make yourself at home." : "Welcome back."}</h2>
            <p className={sharedStyles.muted}>{mode === "register" ? "Create an account to share your animals. No email needed." : "Log in to share another good moment."}</p>
            <form onSubmit={authenticate} className={layoutStyles.form}>
              <label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" placeholder="e.g. milos_human" /></label>
              <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /></label>
              <Link className={layoutStyles.forgotPassword} href="/forgot-password">Forgot password?</Link>
              <Captcha key={captchaAttempt} onChange={updateCaptcha} />
              {authError && <p className={layoutStyles.authError} role="alert">{authError}</p>}
              <button disabled={busy || captchaToken === null}>{busy ? "One moment…" : mode === "register" ? "Join the big group schlawgs" : "Log in"}</button>
            </form>
            <button className={layoutStyles.textButton} disabled={busy} onClick={() => { setMode(mode === "register" ? "login" : "register"); setAuthError(""); setError(""); }}>{mode === "register" ? "Already a member? Log in" : "New here? Create an account"}</button>
        </section>
      </aside>}
      <section className={`${layoutStyles.content} ${postId ? layoutStyles.singlePost : ""}`} id="feed">
        {!ready && <p className={sharedStyles.muted} role="status">Getting your account…</p>}
        {(error || accountError) && !composerOpen && <ErrorToast key={error || accountError} message={error || accountError} />}{notice && <p className={sharedStyles.notice} role="status">{notice}</p>}
        {user && !postId && <dialog ref={composerRef} className={composerStyles.composerDialog} data-closing={composerClosing !== null} aria-labelledby="composer-title" onCancel={event => { event.preventDefault(); dismissComposer(); }} onClick={event => { if (event.target === event.currentTarget) dismissComposer(); }}>
        <form className={composerStyles.composerForm} onSubmit={upload} aria-busy={busy} inert={composerClosing !== null}>
          <div className={composerStyles.composerHeader}><p className={`${layoutStyles.eyebrow} ${composerStyles.eyebrow}`}>A moment worth sharing</p><button type="button" disabled={busy || composerClosing !== null} onClick={dismissComposer} aria-label="Close post composer">✕</button></div>
          <h2 id="composer-title">What&apos;s your schlawg up to?</h2><p className={sharedStyles.muted}>Add up to 10 photos with one shared description or a story for each. 10 MB per photo, 50 MB total. Your draft stays here if you close this window.</p>
          {error && <ErrorToast key={error} message={error} />}
          <label className={`${layoutStyles.fileButton} ${composerStyles.fileButton}`}>+ Choose photos<input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={e => chooseFiles(e.target.files)} /></label>
          {drafts.length > 1 && <fieldset className={composerStyles.descriptionOptions} disabled={busy}>
            <legend>Photo descriptions</legend>
            <label><input type="radio" name="descriptionMode" checked={descriptionMode === "individual"} onChange={() => setDescriptionMode("individual")} />Individual description for each photo</label>
            <label><input type="radio" name="descriptionMode" checked={descriptionMode === "shared"} onChange={() => setDescriptionMode("shared")} />One description for all photos</label>
            <p className={sharedStyles.muted}>Switching options keeps your draft text. Only the selected option is published.</p>
          </fieldset>}
          {drafts.length > 0 && descriptionMode === "shared" && <label className={composerStyles.sharedDescription}>Description for all photos<textarea maxLength={2000} value={sharedDescription} disabled={busy} placeholder="Tell the story behind this moment…" onChange={e => setSharedDescription(e.target.value)} /></label>}
          {drafts.length > 0 && <div className={composerStyles.drafts}>{drafts.map((draft, i) => <div className={composerStyles.draft} key={draft.url}>
            <img src={draft.url} alt={`Preview of ${draft.file.name}`} /><div><button type="button" className={layoutStyles.textButton} disabled={busy} onClick={() => setEditingDraft(draft)}>Edit photo</button>
              <div className={composerStyles.animalSelector}>
                <span>Who is this schlawg?</span>
                <div className={composerStyles.animalTagRow}>
                  {draft.animalIds.map(animalId => {
                    const animal = animalProfiles.find(item => item.id === animalId);
                    if (!animal) return null;
                    return <button key={animal.id} type="button" className={composerStyles.animalTag} aria-label={`Remove ${animal.name} from this photo`} title={`Remove ${animal.name}`} disabled={busy} onClick={() => updateDrafts(drafts.map((item, j) => j === i ? { ...item, animalIds: item.animalIds.filter(id => id !== animal.id) } : item))}>
                      {animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" /> : <span>{animal.name.slice(0, 1).toUpperCase()}</span>}
                      <svg aria-hidden="true" viewBox="0 0 12 12"><path d="m3 3 6 6m0-6L3 9" /></svg>
                    </button>;
                  })}
                  <div className={composerStyles.animalPicker} ref={animalPicker?.draftUrl === draft.url ? animalPickerRef : undefined}>
                    <button type="button" className={composerStyles.animalPickerTrigger} aria-label="Add a schlawg to this photo" aria-expanded={animalPicker?.draftUrl === draft.url && !animalPicker.closing} title="Add a schlawg" onClick={() => {
                      if (animalPicker?.draftUrl === draft.url && !animalPicker.closing) closeAnimalPicker();
                      else setAnimalPicker({ draftUrl: draft.url, closing: false });
                    }}><span aria-hidden="true">+</span><span className={composerStyles.animalPickerLabel}>Add schlawg</span></button>
                    {animalPicker?.draftUrl === draft.url && <div className={`${composerStyles.animalPickerMenu}${animalPicker.closing ? ` ${composerStyles.animalPickerMenuClosing}` : ""}`} role="group" aria-label={`Add an animal to ${draft.file.name}`}>
                      <header className={composerStyles.animalPickerMenuHeader}><p>{animalProfilesLoading ? "Loading profiles…" : animalProfilesResult?.failed ? "Couldn’t load profiles" : animalProfiles.length ? "Add a schlawg" : "No schlawg profiles yet"}</p><button type="button" className={composerStyles.animalPickerMenuClose} aria-label="Close schlawg choices" onClick={closeAnimalPicker}>×</button></header>
                      {animalProfiles.map(animal => {
                        const selected = draft.animalIds.includes(animal.id);
                        return <button key={animal.id} type="button" disabled={busy || selected} aria-label={selected ? `${animal.name} already added` : `Add ${animal.name}`} onClick={() => {
                          updateDrafts(drafts.map((item, j) => j === i && !item.animalIds.includes(animal.id) ? { ...item, animalIds: [...item.animalIds, animal.id] } : item));
                          closeAnimalPicker();
                        }}>
                          {animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" /> : <span className={composerStyles.animalInitial}>{animal.name.slice(0, 1).toUpperCase()}</span>}
                          <span>{animal.name}<small>{animal.animalType}</small></span>{selected && <span className={composerStyles.animalAdded}>Added</span>}
                        </button>;
                      })}
                      {animalProfilesResult?.failed && <button type="button" onClick={() => window.dispatchEvent(new Event("focus"))}>Try again</button>}
                      {!animalProfilesLoading && !animalProfilesResult?.failed && <Link href="/account/animals#new" target="_blank" rel="noreferrer" onClick={closeAnimalPicker}>+ Add a profile</Link>}
                    </div>}
                  </div>
                </div>
              </div>
              {descriptionMode === "individual" ? <label>Description for {draft.file.name}<textarea maxLength={2000} value={draft.description} placeholder="Tell the story behind this photo…" disabled={busy} onChange={e => updateDrafts(drafts.map((d, j) => j === i ? { ...d, description: e.target.value } : d))} /></label> : <p className={sharedStyles.muted}>{draft.file.name} · Uses the shared description</p>}<button type="button" className={layoutStyles.textButton} disabled={busy} onClick={() => { URL.revokeObjectURL(draft.url); updateDrafts(drafts.filter((_, j) => j !== i)); }}>Remove photo</button></div>
          </div>)}</div>}
          <div className={composerStyles.composeActions}>
            <button disabled={busy || !drafts.length}>{busy ? "Saving…" : `Share ${drafts.length || "your"} photo${drafts.length === 1 ? "" : "s"}`}</button>
            {drafts.length > 0 && <button type="button" className={composerStyles.addMore} disabled={busy || drafts.length >= 10} onClick={() => fileRef.current?.click()}>{drafts.length >= 10 ? "10 photo limit reached" : "+ Add more photos"}</button>}
          </div>
        </form></dialog>}
        {!postId && <VoteLeaders />}
        {user && !postId && <MySchlawgs key={user.id} />}
        <div className={layoutStyles.feedHeading}><div><h2 className={`${layoutStyles.eyebrow} ${composerStyles.eyebrow}`}>{discovery ? { popular: "Popular · Community favorites", niche: "Niche · Hidden gems", relevant: "Relevant · Recent conversations" }[discovery] : feedCaughtUp ? "Nothing new from the bill collector :(" : "Fresh from the bill collectors"}</h2>{postId && <h2>Your desired post!</h2>}</div>{postId && <Link className={layoutStyles.backToFeed} href="/">← Go back to main feed</Link>}</div>
        {!postId && feed !== "latest" && ready && !user ? <div className={layoutStyles.empty}><h2>Your personal feed</h2><p><a href="#account">Log in or sign up</a> to see {feed === "mine" ? "your photos" : "posts you’ve liked or commented on"}.</p></div> : feedLoading || !ready ? <FeedSkeleton single={!!postId} /> : feedError ? <div className={sharedStyles.card} role="alert"><p>{feedError}</p><button onClick={() => void refresh()}>Try again</button></div> : !photos.length ? <div className={layoutStyles.empty}><span>♡</span><h2>{feed === "interacted" ? "Your favorites start here." : "A good moment starts here."}</h2><p>{feed === "mine" ? "Your photos will appear here once you share them." : feed === "interacted" ? "React to a post, leave a comment or reply, or like a comment to find that post here." : "Be the first to introduce your animal to the other schlawgs."}</p></div> : <div className={sharedStyles.feed}>{groupPhotoBatches(photos).map(batch => <PhotoCard key={batch[0].batchId ?? batch[0].id} photos={batch} userId={user?.id ?? null} owner={batch[0].ownerId === user?.id} onSaved={refresh} />)}</div>}
        {!postId && ready && !feedLoading && !feedError && photos.length > 0 && (feed === "latest" || user) && <FeedEnding key={`${user?.id ?? "guest"}-${feed}`} />}
      </section>
    </div></div>
  </main>;
}
