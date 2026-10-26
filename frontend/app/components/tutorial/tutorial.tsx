"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./tutorial.module.css";


const pages = [
  { title: "Share your first moment", label: "Make a post", paragraphs: ["Choose + Share a post beside the feed buttons. Add up to 10 photos, then choose one description for all photos or a separate story for each.", "Use + Add more photos to complete your post, then Share to publish. Everyone can view your post. Closing the composer keeps your draft until you leave or refresh the page."] },
  { title: "Every photo has a story and a reason", label: "Browse the slides", paragraphs: ["Swipe horizontally, tap the dots, or use the arrows to browse a post’s photos. The description and best quote follow the photo you’re viewing.", "Choose React to Like, Love, or Laugh at the post. Select your current reaction again to remove it."] },
  { title: "Join the conversation", label: "Comments & replies", paragraphs: ["Choose Comment to leave a message about the photo you’re viewing. A comment on photo 4 gets a 4 badge so everyone knows which moment you mean.", "Reply continues a conversation and keeps the original comment’s photo reference. You can like comments too. If the post’s author likes one, a ❤️ and their profile picture appear beside “has liked this comment.”"] },
  { title: "Give a comment the spotlight", label: "Best quotes", paragraphs: ["On your own post, browse to a photo and open the comments. Choose Use as best quote for photo… on your favorite comment to feature it below that photo’s description.", "Each photo can have one best quote. You can replace it or remove it whenever you like."] },
  { title: "Find your way back", label: "Sharing & notifications", paragraphs: ["Share ↗ gives you a link anyone can open, even without an account. Latest moments shows recent posts; Liked / interacted finds posts you’ve reacted to, commented on, or liked a comment on. My photos shows your posts.", "Open your profile menu for notifications about reactions, comments, and best quotes. Feeling bored? in the top bar helps you discover another post."] },
  { title: "Keep it kind", label: "Share Good company", paragraphs: ["Share photos you have permission to post, keep animals comfortable, and treat people with care. You can remove your own comments, and authors can remove comments on their posts. Moderators can also remove comments.", "Use Report post for genuine concerns. If your own post is reported, notifications lead to your reports and disputes. You can reopen this guide anytime using How posts work in the footer."] },
];

export default function TutorialDialog({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else document.querySelector<HTMLElement>('summary, nav a')?.focus();
    };
  }, [onClose]);
  function turn(next: number) { setPage(next); bodyRef.current?.scrollTo({ top: 0 }); }
  return createPortal(<dialog ref={dialogRef} className={styles.dialog} aria-labelledby="tutorial-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.book}>
        <header className={styles.header}><span>mySchlawgs -- A little field guide --</span><button type="button" onClick={() => onClose()} aria-label="Close tutorial">✕</button></header>
        <div ref={bodyRef} className={styles.body}>
          <aside className={styles.cover} aria-hidden="true"><span>THE COMMUNITY GUIDE</span><strong>{String(page + 1).padStart(2, "0")}</strong><p>{pages[page].label}</p></aside>
          <section className={styles.page} aria-live="polite" aria-atomic="true"><h2 id="tutorial-title">{pages[page].title}</h2>{pages[page].paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>
        </div>
        <footer className={styles.controls}><button type="button" disabled={page === 0} onClick={() => turn(page - 1)}>← Back</button><span>Page {page + 1} of {pages.length}</span>{page < pages.length - 1 ? <button type="button" onClick={() => turn(page + 1)}>Next →</button> : <button type="button" onClick={() => onClose()}>Done ✓</button>}</footer>
      </div>
    </dialog>, document.body);
}
