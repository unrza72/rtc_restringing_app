# Royal Tennisclub Bezau — Brand guide (for developers and coding agents)

Website / mobile app for booking **racket restringing** and **scheduling kids' tennis training**.

## Colors
Defined as Tailwind v4 tokens in `rtc-theme.css` (import it after `@import "tailwindcss";`).

| Role | Token | Hex |
|---|---|---|
| Primary (logo letters, primary buttons, links) | `brand` / `terracotta-600` | #B4574A |
| Primary on dark backgrounds | `brand-light` | #E9A493 |
| Wreath / secondary accents, dividers | `leaf` / `sage-500` | #7F9682 |
| Wreath on dark backgrounds | `leaf-light` | #A9BCA9 |
| Crown detail | `crown` | #7A2E26 |
| Dark surfaces (footer, dark mode), body text | `court` / `court-900` | #26352D |
| Page background | `cream` | #F7F2EA |
| Section / card background | `sand` | #EDE7DC |

Rules:
- Body text: `text-court-900` on `bg-cream`. Never sage-500 for text (too low contrast); use `sage-700`.
- Primary button: `bg-brand text-white hover:bg-terracotta-700 rounded-full`, at least 44px tall.
- Terracotta text on cream only at ≥18px or bold; otherwise `terracotta-700`.
- Dark mode / footer: `bg-court`, headings `text-cream`, accents `text-brand-light`.

## Typography
- Display / headings / club name: **Playfair Display** 600, uppercase, letter-spacing ~0.06–0.08em (`font-display`).
- UI and body: **Inter** 400/500 (`font-sans`). Small labels: uppercase, 12–13px, tracking 0.16em.

## Logo
- Crest: laurel wreath (sage) around the monogram R-T-C (terracotta serif), small crown inside the C opening, crossed rackets below.
- Web header: crest left of "ROYAL TENNISCLUB BEZAU" in Playfair Display, terracotta.
- App icon: crest on terracotta (white letters, light wreath), or monogram-only on court green below 48px.
- Service badges: wreath + strung racket = **Restringing**; wreath + ball with crown = **Junior Academy** (placeholder name).
- Leave clear space around the logo of at least the crown's width ×3. Don't recolor outside these palettes, stretch, or add effects.

## Tone
Traditional club crest, but friendly for parents and kids: clean layouts, generous whitespace, rounded cards (`rounded-2xl`), no gradients or emoji.
