import type { Metadata } from "next";
import Link from "next/link";
import InfoPage from "../components/info-page";

export const metadata: Metadata = {
  title: "How posts work | mySchlawgs",
  description: "A quick guide to sharing photos, reacting, replying, and choosing best quotes on mySchlawgs.",
};

export default function HowItWorksPage() {
  return <InfoPage title="Your first moment, made simple." intro="A quick guide to posts and the little interactions that bring our community together. Anyone can browse; sign in to join in.">
    <section aria-labelledby="share"><h2 id="share">1. Share a moment</h2><p>Click <strong>+ Share a post</strong> beside the feed buttons. In the popup, choose up to 10 photos. With multiple photos, choose one description for all photos or an individual description for each. Use <strong>+ Add more photos</strong> to build your post, then press <strong>Share</strong> to publish.</p><p>Your photos become one public post. Closing the popup keeps your draft while you stay on the page; refreshing or leaving the page clears it.</p></section>
    <section aria-labelledby="browse"><h2 id="browse">2. Explore every photo</h2><p>Swipe horizontally or use the left and right arrows to move through a post. The description and any best quote change with the photo you’re viewing. The counter shows where you are in the slideshow.</p></section>
    <section aria-labelledby="react"><h2 id="react">3. Leave a reaction or a reply</h2><p>Choose <strong>Like, Love, or Laugh</strong> to react to the post. Open <strong>Comment</strong> to join the conversation, or choose <strong>Reply</strong> on someone’s comment. You can like comments too—if the post’s author likes one, a ❤️ and their profile picture appear beside “has liked this comment.”</p><p>A new comment refers to the photo you’re looking at. For example, a comment made on photo 4 gets a “4” badge. Replies keep the original comment’s photo reference so the conversation stays together.</p></section>
    <section aria-labelledby="quote"><h2 id="quote">4. Pick a best quote</h2><p>On your own post, move to a photo, open the comments, and choose <strong>Use as best quote for photo…</strong> on your favorite comment. It appears beneath that photo’s description. Each photo can have one best quote, and you can replace or remove it.</p></section>
    <section aria-labelledby="return"><h2 id="return">5. Share it and find it again</h2><p>Use <strong>Share ↗</strong> to get a link to the post—even friends without an account can view it. <strong>Latest moments</strong> shows recent posts, <strong>Liked / interacted</strong> brings back posts you’ve reacted to, commented on, or liked a comment on, and <strong>My photos</strong> shows your own posts.</p><p>Open your profile menu and choose notifications to catch reactions, comments, and best-quote selections. Feeling curious? Try <strong>Feeling bored?</strong> to discover another post.</p></section>
    <section aria-labelledby="kind"><h2 id="kind">A little kindness goes a long way</h2><p>Share photos you have permission to post, keep animals comfortable, and treat people with care. You can remove your own comments; post authors and moderators can remove comments on their posts too. For a genuine concern, sign in and use <strong>Report post</strong>.</p><p>See the <Link href="/faq">FAQ</Link> for more guidelines, or <Link href="/#feed">head to the feed</Link> and share a little joy.</p></section>
  </InfoPage>;
}
