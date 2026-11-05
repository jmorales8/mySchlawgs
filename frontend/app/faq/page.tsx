import type { Metadata } from "next";
import Link from "next/link";
import InfoPage from "../components/information/info-page";
import FAQAccordion from "../components/information/faq-accordion";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "FAQ | mySchlawgs", description: "Sharing photos, protecting your privacy, and being a good neighbor on mySchlawgs." };

export default function FAQPage() {
  return <InfoPage article title="A few good questions." intro="The basics of sharing your animals and making this a welcoming place for everyone.">
    <div className={styles.groups}>
    <section aria-labelledby="sharing-questions"><h2 id="sharing-questions">Getting started &amp; sharing</h2>
    <FAQAccordion id="about" defaultOpen title="What is mySchlawgs?"><p>A community for animal photos, everyday adventures, and the people who love them. Dogs inspired our name, but all animals are welcome.</p></FAQAccordion>
    <FAQAccordion id="posting-guidelines" title="What can I post?"><p>Share animal portraits, funny moments, walks, playtime, and other respectful, animal-centered stories. Keep animals comfortable—never frighten, hurt, or put an animal at risk for a photo.</p><p>No animal abuse, threats, hate speech, harassment, sexual content, scams, spam, or someone else’s private information. Do not present someone else’s work as your own.</p></FAQAccordion>
    <FAQAccordion id="multiple-photos" title="How do I upload more than one photo?"><p>Choose up to 10 photos for one post, then choose a shared description for all photos or individual descriptions for each. Use “Add more photos” before sharing. JPEG, PNG, GIF, and WebP are supported, up to 10 MB per photo and 50 MB per post. Readers can swipe or use the arrows to browse.</p></FAQAccordion>
    </section>
    <section aria-labelledby="privacy-questions"><h2 id="privacy-questions">Your photos &amp; privacy</h2>
    <FAQAccordion id="public-photos" title="What happens to the photos I upload?"><p>They become public posts that others can browse, react to, comment on, and share using a link. People do not need an account to view published posts or profile pictures. We use your uploads to provide these sharing features and to review reported content.</p><p>Only upload photos you took or have permission to share. Ask permission before including other people, and keep private information out of images and captions.</p></FAQAccordion>
    <FAQAccordion id="photo-storage" title="How are my photos stored?"><p>Photo files are stored in the app’s database, along with their captions, upload dates, and the account that uploaded them. They stay available between visits.</p><p>New post, profile, and animal-picture uploads are processed on our server to remove embedded metadata, including camera and GPS location information. Older uploads have not been automatically cleaned. This does not hide details visible in a photo or information in its caption, so check both before sharing.</p><p>Read our <Link href="/privacy">privacy page</Link> for more about storage and visibility.</p></FAQAccordion>
    <FAQAccordion id="editing-and-removal" title="Can I change or remove what I shared?"><p>Published photo descriptions cannot be edited. You can replace your profile picture, edit or remove your own comments and replies, and undo your reactions and comment likes. Authors can also remove comments on their posts. Self-service post deletion and account deletion are not currently available.</p><p>A moderation takedown hides a post from public view but retains it for review; it is not permanent deletion.</p></FAQAccordion>
    </section>
    <section aria-labelledby="community-questions"><h2 id="community-questions">Care &amp; community</h2>
    <FAQAccordion id="kind-comments" title="How can I be kind in the comments?"><p>Celebrate the animal, be curious, and speak to the person as you would face to face. Avoid insults, appearance-based jokes, repeated unwanted advice, or piling on. Ask before offering criticism, and remember that one photo rarely tells the whole story. If a post concerns you, report it rather than starting an argument.</p></FAQAccordion>
    <FAQAccordion id="reporting" title="What should I do about an inappropriate post?"><p>Sign in and choose “Report post,” then select a reason. Each account can report a post once. A reported post is hidden from public feeds while awaiting moderator review. Its author can still see it in My photos. If a moderator removes it, it also disappears from My photos. Reporting is for genuine concerns, not disagreements or retaliation.</p><p>If your own post is reported or removed, use <Link href="/account/reports">Your reports &amp; disputes</Link> to request a review. Your notifications link to this page too.</p></FAQAccordion>
    </section>
    </div>
  </InfoPage>;
}
