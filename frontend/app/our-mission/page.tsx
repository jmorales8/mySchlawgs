import SiteFooter from "../components/information/site-footer";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Our mission | mySchlawgs",
  description: "Our mission, the community we are building, and the technology behind mySchlawgs.",
};

export default function OurMission() {
  return <div className={styles.page}>
    <nav className={styles.nav} aria-label="Main navigation">
      <Link className={styles.brand} href="/"><span aria-hidden="true">S</span>mySchlawgs</Link>
      <Link className={styles.feedLink} href="/#feed">Meet the Schlawgs <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18 18 6M6 6h12v12" /></svg></Link>
    </nav>
    <main className={styles.main}>
      <header className={styles.hero}>
        <h1>Why mySchlawgs and yourSchlawgs matter.</h1>
        <p className={styles.intro}>A place to share everyday animal moments, get to know the companions behind them, and connect with people who care.</p>
      </header>
      <section className={styles.story} aria-labelledby="little-moments">
        <div><h2 id="little-moments">Little moments. Big personalities.</h2>
          <p>At home or on an adventure, your schlawg is always up to something. We want to know what they’re doing!</p>
          <p>mySchlawgs is a place to share those moments and the stories behind them. We want to build a community where people can get to know each other through their animals, enjoy a little everyday silliness, and feel welcome sharing something they love.</p>
        </div>
      </section>
      <section className={styles.story} aria-labelledby="what-matters">
        <h2 id="what-matters">A little room for everyone.</h2>
        <p>We want this to feel like a place where you can show up as you are and share something small. A few simple ideas guide the community:</p>
        <ul className={styles.points}>
          <li><strong>All animals are welcome.</strong> Dogs inspired the name, but there’s room for cats, birds, rabbits, and every other animal you call a companion.</li>
          <li><strong>Real life is enough.</strong> A blurry zoomie can be just as memorable as a perfect portrait. Share the small adventures and funny expressions that make you laugh!</li>
          <li><strong>Care comes first.</strong> Treat people and animals with kindness. Respect each other, give animals their space, and put their comfort ahead of getting the photo.</li>
        </ul>
      </section>
      <section className={styles.story} aria-labelledby="community-tools">
        <div><h2 id="community-tools">Care in the details.</h2>
          <p>Reports, moderator tools, and disputes give the community ways to flag problems and ask for a review.</p>
          <p>Read our <Link href="/faq">FAQ</Link> for posting guidelines, or our <Link href="/privacy">privacy page</Link> for details about the information the app stores.</p>
        </div>
      </section>
      <details className={styles.technical}>
        <summary>Behind the scenes <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></summary>
        <div className={styles.technicalContent}><h2>Built for photos. Made for connection.</h2>
          <p>The technology behind mySchlawgs connects three pieces: the pages you interact with, a server that handles requests, and a database that remembers your photos and activity.</p>
          <p>When you share a moment, the server checks your account and upload, saves the photos with their descriptions, and makes the post available in the feed. Reactions, comments, and best quotes stay connected to the right post or photo.</p>
          <ul className={styles.points}>
            <li><strong>The website: Next.js &amp; React.</strong> These power the pages, photo carousels, menus, and notification inbox. TypeScript helps catch mistakes while building, and CSS Modules keep component styles organized.</li>
            <li><strong>The server: ASP.NET Core.</strong> A C# server handles sign-in, uploads, reactions, comments, and moderation. It checks who is allowed to make each change and returns the information the website needs.</li>
            <li><strong>The database: PostgreSQL.</strong> It stores accounts, photo files, descriptions, and community activity. Entity Framework Core connects the server to that data and manages changes to its structure as the app grows.</li>
          </ul>
          <p>Passwords are stored as salted hashes, and session cookies keep you signed in. Request limits help reduce spam, with support for Cloudflare Turnstile CAPTCHA when configured.</p>
        </div>
      </details>
      <section className={styles.invitation} aria-labelledby="finished-reading">
        <h2 id="finished-reading">Come meet the Schlawgs.</h2>
        <Link href="/#feed">Back to the community <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></Link>
      </section>
    </main>
    <SiteFooter mission />
  </div>;
}
