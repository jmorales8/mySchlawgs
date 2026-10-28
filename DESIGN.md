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

## Layout

Photography leads the feed. Keep the existing responsive layout and rounded post cards. Color refinements do not authorize changes to product copy or behavior.
