# mySchlawgs visual system

## Approved palette

The user selected Peach & Plum on October 28, 2026. Shared CSS roles are defined in frontend/app/globals.css.

| Role | Color |
|---|---|
| Page background | #FAF0EA |
| Cards and surfaces | #FFFCF8 |
| Primary text | #402D3E |
| Actions, links, and focus | #73465F |
| Secondary text | #796171 |
| Decorative borders | #E4D1D8 |
| Control borders | #99758B |

Use pale peach surfaces and restrained plum accents. Primary actions use off-white text on plum. Control borders are stronger than decorative card borders for visibility. Preserve distinct semantic reaction and status colors.

## Dark mode

The feed hamburger menu includes a labeled light/dark toggle. The first visit uses the system preference; an explicit choice is saved under `myschlawgs-theme` in local storage and shared across tabs. Theme initialization runs before hydration. Storage failures must not prevent switching themes.

Dark mode uses charcoal #19171D for the canvas, aubergine #242029 for surfaces, #F2EAF1 text, #BFAFBD secondary text, and #D6ADCA action accents with #2D1D29 text. Surface and action foreground roles are separate. Status surfaces and their text also adapt to the theme.

## Typography

The feed uses the existing Geist family for controls, navigation, captions, and metadata. Georgia remains for welcoming headings. Controls and labels are generally 0.875rem, prose and inputs 1rem, and metadata 0.8125rem. Feed headings use a responsive 1.25–1.5rem size. Preserve browser zoom and wrapping.

## Reactions

Posts and comments share the reaction control. Post actions use a flat, borderless icon row: thumbs-up with total reaction count, comment bubble with comment count, share arrow, and non-interactive emoji badges at the right with no visible counts, sorted by quantity descending with stable Like/Love/Laugh tie order; no Who Reacted panel or usernames list. Share has no count until the product actually tracks shares. Comment reaction controls retain a Like label. Clicking the main thumbs-up directly toggles Like. Once selected, the button shows that reaction and clicking it removes it. A continuous half-second mouse hover reveals an emoji-only Like, Love, and Laugh picker with accessible labels, 28px emojis, and a 158px-wide borderless pill with a soft shadow and no selected-state dot positioned 10px lower than before; choices lift 3px and grow smoothly to 118% on hover, then return on exit, without individual hover borders or fills; an animated eclipse-like halo behind the hovered or keyboard-focused emoji is blue for Like, red for Love, and yellow for Laugh; the picker stays open across the button and popup and closes on leaving or choosing. There is no disclosure caret. Hover reveals the choices; touch users can hold Like to open them, while keyboard users use the Arrow keys and Escape. Like, Comment, and Share gain a dark background with light ink on hover or keyboard focus. The floating picker is placed outside clipping post cards and constrained to the viewport. Neutral and selected surfaces use theme roles in both light and dark mode.

## Layout

Photography leads the feed. Keep the existing responsive layout and rounded post cards. Color refinements do not authorize changes to product copy or behavior.

## Published content

Descriptions are set during upload and cannot be edited after publication. Users cannot remove their own posts, including through moderator privileges. Moderators and administrators may remove other authors’ posts through the moderation workflow. Comment editing is a separate feature and remains available. Social action icons share 22px boxes on one centered horizontal axis.


## Featured quotes and conversations

Best quotes sit below the post author/date and above the photo, with an understated star, prominent quote text and quiet inline attribution. Quote removal and comment management use accessible options menus. Comments use flat rows, compact author/date metadata, Like/Reply actions and subtle reply guides. Show explicit photo references only on multi-photo posts. The composer precedes the conversation. Comment, reply, and edit fields share a softly tinted two-line writing surface with 12px corners, regular-weight text, and a close-fitting 2px plum focus edge. Fields grow with their content up to 280px; action buttons remain visible and aligned to the right. Focus alone does not resize the field. Active replies use a subtle background rather than an outer outline. Keep quote and comment gutters aligned on mobile.


Carousel pagination dots stay anchored 8px above the bottom of the photo viewer regardless of image aspect ratio or letterboxing, on a dark pill with a white active dot. Best quotes longer than 180 characters or three source lines use a compact preview with Read more / Read less; expanding preserves the complete quote and resets for another photo or quote.


## Vertical feed navigation

The community feed uses one post column at every width. Desktop uses a 260px sticky left navigation rail beside a reading column up to 780px: brand/profile access, feed choices and Share a post, discovery choices, then help links. The rail scrolls independently in short windows. The profile hamburger opens only profile picture changes, theme, moderation access and logout. There is no separate Account settings control. Sidebar children never wrap into extra columns; short windows scroll vertically. Below 761px, navigation becomes a compact non-sticky section above the feed and discovery collapses behind its labeled control. Guest account forms remain available above the feed.


The signed-in home feed begins with My VERY OWN Schlawgs and Notifications above the feed heading. Show at most five animal profiles per page, with previous/next controls for additional profiles and a link to manage/add animals. Empty accounts show the user-approved invitation linking directly to the creation form. Loading and errors must not appear as an empty account. Animal links target the saved profile on the account page.


## End of feed

The community footer bar is removed; help/privacy links remain in navigation on all screen sizes. After the final loaded feed post, show a random animal emoji, a short end-of-feed message, and a joke with a Back to top link. Fetch only when this ending enters the viewport. The same-origin /feed-joke route fetches the Animal Joke of the Day from Jokes One, caches it for an hour within the free request limits, and validates the animal category, clean/non-racial flags and bounded text, and falls back to local animal jokes on failure. Render jokes as plain text; attribute Jokes One when used.

The profile hamburger dropdown is absolutely positioned below the profile trigger with an elevated stacking level, opaque surface and soft shadow. It overlays feed navigation without moving it.
