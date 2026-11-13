# CampusPulse design system

Status: the landing page and its reusable primitives are implemented. The
dashboard screens described in `docs/future-screens.md` are specifications only
and are **not** implemented in Prompt 3.1.

## 1. Brand direction

CampusPulse should feel like a considered campus publication rather than a
generic SaaS dashboard: warm paper, deep ink, editorial serif headlines, compact
sans-serif interface text, a signal-orange accent, and restrained motion. The
system is intentionally light-only today. Dark mode is a future extension and
must not be improvised per screen.

Design principles:

1. **Clarity before decoration.** A student should understand what is happening,
   when, where, and whether they can register.
2. **Editorial hierarchy.** Display serif type carries page and event titles;
   Manrope carries controls, labels, and dense metadata.
3. **Calm density.** Borders and space do the structural work; avoid heavy
   shadows, gradients, and nested cards.
4. **Visible state.** Loading, empty, error, pending, cancelled, and full states
   are designed states, not afterthoughts.
5. **Accessible by default.** Keyboard focus, labels, contrast, reduced motion,
   and touch targets are part of the primitive, not a page-level patch.

## 2. Color tokens

Tokens are declared in `src/app/globals.css` and exposed to Tailwind through
`@theme inline`.

| Token           | Value     | Tailwind                    | Intended use                               |
| --------------- | --------- | --------------------------- | ------------------------------------------ |
| `--canvas`      | `#f3f0e7` | `bg-canvas`                 | Page background                            |
| `--paper`       | `#fbfaf6` | `bg-paper`                  | Cards, panels, dialogs                     |
| `--paper-dim`   | `#ece8de` | `bg-paper-dim`              | Subtle fills, skeletons, disabled controls |
| `--ink`         | `#16201b` | `text-ink` / `bg-ink`       | Primary text and dark surfaces             |
| `--ink-soft`    | `#26332c` | `text-ink-soft`             | Secondary dark text, hover dark surfaces   |
| `--muted`       | `#5f6a63` | `text-muted`                | Metadata, descriptions, secondary labels   |
| `--line`        | `#d8d3c6` | `border-line`               | Default dividers and card borders          |
| `--line-strong` | `#b9b3a4` | `border-line-strong`        | Input borders, stronger separators         |
| `--signal`      | `#e4572e` | `bg-signal` / `text-signal` | Primary accent, signal bars, highlights    |
| `--signal-dark` | `#a83b1d` | `text-signal-dark`          | Accent text on light backgrounds           |
| `--forest`      | `#235a48` | `text-forest` / `bg-forest` | Success, metadata icons, focus ring        |
| `--forest-soft` | `#dbe6dd` | `bg-forest-soft`            | Approved/positive badges                   |
| `--sage`        | `#dce4d8` | `bg-sage`                   | Quiet category/artwork fills               |
| `--gold`        | `#c49a52` | `bg-gold`                   | Warm artwork accent                        |
| `--danger`      | `#b42318` | `text-danger`               | Errors and destructive states              |
| `--success`     | `#1f6b4a` | `text-success`              | Confirmed/success text                     |

Usage rules:

- Body text is `ink`; do not use `muted` for essential instructions.
- `signal` is an accent, not a large body-text color on light surfaces. Use
  `signal-dark` for text on canvas/paper.
- `forest` is the default positive/verified color. Do not use green and orange
  interchangeably for status.
- Borders use `line`; interactive controls use `line-strong` until focus/hover.
- The current palette is light-only. A dark theme requires a separate token
  audit for contrast and status colors.

Contrast expectations: body copy on canvas/paper uses `ink` or `ink-soft`;
metadata uses `muted` only for non-essential context. Verify every new
combination with a contrast checker before shipping.

## 3. Typography

| Role              | Family           | Tailwind       | Notes                                   |
| ----------------- | ---------------- | -------------- | --------------------------------------- |
| Interface/body    | Manrope          | `font-sans`    | Loaded via `next/font/google`, variable |
| Display/editorial | Instrument Serif | `font-display` | Loaded normal + italic, 400 only        |

Rules:

- Display type is for page titles, section titles, large dates, and event titles.
  Do not use it for form labels or dense table data.
- Use `tracking-[-0.02em]` to `tracking-[-0.04em]` on large display text.
- Use uppercase Manrope with `font-bold`, `text-[10px]`–`text-[11px]`, and
  `tracking-[0.14em]`–`tracking-[0.2em]` for eyebrows and metadata.
- Body copy is generally `text-sm`/`text-[15px]` with `leading-6`/`leading-7`.
- Avoid more than three type sizes in a single compact card.
- Use `text-balance` for headlines and `text-pretty` where supported for
  paragraphs.

Suggested scale:

| Use           | Classes                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| Hero title    | `font-display text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.04em]`      |
| Page title    | `font-display text-4xl sm:text-5xl leading-[0.95] tracking-[-0.03em]`            |
| Section title | `font-display text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.98] tracking-[-0.02em]` |
| Card title    | `font-display text-[1.65rem] leading-[1.02] tracking-[-0.02em]`                  |
| Body          | `text-sm leading-6` or `text-[15px] leading-7`                                   |
| Metadata      | `text-xs leading-5 text-muted`                                                   |
| Eyebrow       | `text-[10px] font-bold uppercase tracking-[0.18em]`                              |

## 4. Spacing and layout

- Container: `mx-auto w-full max-w-[1240px] px-5 sm:px-8 lg:px-10`.
- Page section rhythm: `py-14 sm:py-20 lg:py-24`; use border-top/bottom for
  separation rather than stacked shadows.
- Component spacing follows a 4 px base scale: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16,
  20, 24.
- Card padding: compact `p-4`, standard `p-5`, roomy `p-6`–`p-7`.
- Grid gaps: `gap-3`/`gap-4` for controls and compact cards; `gap-8`–`gap-16`
  for page sections.
- Desktop breakpoints follow Tailwind defaults: `sm` 640 px, `md` 768 px,
  `lg` 1024 px, `xl` 1280 px. The landing page primarily switches at `lg`.
- The header is sticky at `top-0`, `z-50`, height `4.5rem`. Anchor targets use
  `scroll-margin-top: 6rem`.
- Avoid page-level horizontal overflow; the landing shell uses
  `overflow-x-clip`.

## 5. Components

### Buttons (`src/components/ui/button.tsx`)

- Variants: `primary` (ink), `signal` (orange), `outline`, `ghost`, `subtle`,
  `inverse`.
- Sizes: `sm` (36 px), `md` (44 px), `lg` (48 px), `icon` (40 px square).
- Use `Button` for actions and `ButtonLink` for navigation. Both share
  `buttonStyles()`.
- Every button needs a clear label; icon-only buttons need `aria-label`.
- Disabled buttons use `disabled:opacity-45` and
  `disabled:pointer-events-none`.
- Do not use a button for navigation when a link is semantically correct.

### Badges (`src/components/ui/badge.tsx`)

- Variants: `default`, `outline`, `signal`, `forest`, `sage`, `dark`, `muted`.
- Uppercase, 10 px, bold, wide tracking, pill shape.
- Use badges for status/category metadata, not long sentences.
- Status mapping: approved/confirmed → `forest`; pending/review → `outline` or
  `signal`; cancelled/rejected/error → `signal` plus explanatory text, never
  color alone.

### Fields (`src/components/ui/field.tsx`)

- `Field` owns the label, optional description, required marker, and error.
- `Input`, `Textarea`, and `Select` share `controlClasses`.
- Always connect `label htmlFor` to the control `id`.
- Error text uses `role="alert"` and `aria-invalid` on the control.
- Help text is `id="${id}-description"`; error is `id="${id}-error"`.
- Do not use placeholder text as the only label.
- Required fields use a visual asterisk and should also be communicated in the
  label or description.

### Dialog (`src/components/ui/dialog.tsx`)

- Native `<dialog>` with `showModal()`, focus return, Escape/backdrop close,
  body scroll lock, and labelled title/description.
- Use for short confirmations and focused creation flows, not long dashboards.
- Destructive confirmations must name the object and the consequence.

### Event cards (`src/components/ui/event-card.tsx`)

- Variants: `featured`, `compact`, `list`.
- `featured`: artwork block, category badge, display title, date/venue metadata,
  footer action.
- `compact`: date tile, category/club, title, time/venue, optional action.
- `list`: date column, title/meta, trailing action; stacks on small screens.
- Cards use `paper`, `border-line`, `rounded-lg`/`rounded-xl`, and a restrained
  hover lift/shadow.
- The artwork block is decorative and clearly labelled as preview/sample data in
  the landing context. Real event cards must use real poster alt text or an
  intentional fallback.
- Never rely on the date tile color alone to convey status.

### Section heading (`src/components/ui/section-heading.tsx`)

- Props: eyebrow, title, description, `align` (`left`/`center`), `tone`
  (`light`/`dark`).
- The eyebrow has a short rule; the title uses display type; the description is
  constrained to `max-w-2xl`.
- Dark tone uses `paper` text and `signal` eyebrow.

### Brand mark

- Inline SVG, currentColor square, paper waveform, signal endpoint.
- `aria-hidden="true"`; the surrounding link supplies the accessible name.
- Do not recolor individual paths outside the token system.

### Dashboard shell and primitives

- `src/components/dashboard/dashboard-shell.tsx` is the shared authenticated
  workspace shell. It provides a desktop sidebar, a mobile drawer, role-specific
  navigation, workspace identity, user identity, sign-out, and a skip link.
- Role workspaces use the existing palette with different tones: student
  `forest`, club `signal`, college `ink`, and platform `ink`.
- `src/components/dashboard/primitives.tsx` provides page headers, section cards,
  metric cards, inline metadata, and dependency-free bar lists.
- Bar lists include a visually hidden table fallback so the same counts remain
  available to screen-reader users.
- Dashboard forms reuse the existing button, field, badge, event-card, and state
  primitives rather than introducing a second visual language.
- Dashboard pages use the college timezone for displayed event dates and label
  timezone-sensitive fields.

## 6. Responsive behavior

- Mobile first; the landing page and auth screens are verified at mobile and
  desktop widths. Dashboard layouts are verified at 360, 390, 768, 1024, 1280,
  and 1440 px.
- Header: desktop navigation at `lg`; mobile trigger below `lg`; mobile panel
  closes on link click, Escape, outside pointer, and focus moves into the panel.
- Dashboard shell: sidebar is fixed at `lg` and above; below `lg` the same
  navigation opens in a labelled drawer with a backdrop and Escape handling.
- Hero: single column below `lg`; two-column editorial layout at `lg`.
- Event grids: one column on mobile, two or three at `md`/`lg` depending on
  content density.
- Event list rows become stacked cards below `sm`.
- Dialogs use `w-[calc(100%-2rem)]` and `max-h-[calc(100dvh-2rem)]` so they fit
  small screens.
- Dashboard tables use horizontal scrolling only for dense audit/log views and
  keep primary dashboard content stacked below `md`. Avoid making a wide table
  the only way to read essential mobile content.
- Minimum touch target: 44 × 44 px for primary controls; icon buttons are 40 px
  but should have adequate surrounding space.
- Test with 200% zoom and at 320 px width before shipping a new screen.

## 7. Accessibility

- Every page has one `h1`; section headings use `h2`/`h3` in order.
- The landing page includes a skip link to `#main-content`.
- Focus visible is a 2 px `forest` outline with 3 px offset globally; do not
  remove it.
- Icon-only controls need `aria-label`; decorative icons use `aria-hidden`.
- Form controls need labels, descriptions, and error associations.
- Dialogs must have an accessible name and description.
- Do not use color alone for status; include text or iconography.
- Use semantic landmarks: `header`, `nav`, `main`, `footer`, `section`.
- Respect `prefers-reduced-motion`; the global stylesheet reduces animation and
  scroll behavior.
- Maintain readable line lengths (`max-w-2xl`/`max-w-3xl` for prose).
- Test keyboard-only navigation, screen-reader names, and zoom.
- Use `aria-live` for dashboard action feedback; do not over-announce every
  loading skeleton.

## 8. Motion

- Primary entrance: `animate-rise` — 700 ms, cubic-bezier(0.22, 1, 0.36, 1),
  opacity + 14 px translate.
- Signal bars: subtle 2.8 s pulse with staggered delays; decorative only.
- Hover transitions: 200–300 ms for color, border, shadow, and small translate.
- Motion must communicate hierarchy or state; never animate essential
  information in a way that delays access.
- Reduced motion collapses animations to near-zero duration and disables smooth
  scrolling.
- Do not add scroll-jacking, parallax, or long looping animations.

## 9. Form patterns

- Group related fields with a short section heading and description.
- Required fields: visible marker plus accessible wording.
- Validate on submit first; revalidate on blur/change after the first error.
- Put the error next to the field and a summary at the top of long forms.
- Preserve user input after validation failure.
- Disable submit only while a request is in flight; do not disable it merely
  because the form is untouched unless the pattern is explicit.
- Destructive actions use a confirmation dialog with the object name and
  irreversible consequence.
- Date/time inputs must state the college timezone.
- Capacity and registration deadline fields should show helper text explaining
  that registration closes at the deadline or when the event starts.
- Never rely on client-side validation for authorization, capacity, or tenancy.

## 10. Loading, empty, and error states

Use `src/components/ui/states.tsx`:

- **Loading:** `Spinner` for short waits; `Skeleton` for layout-preserving
  loading. Announce meaningful async state with `aria-live` where appropriate.
- **Empty:** `EmptyState` with a specific title, explanation, and optional next
  action. Empty is not an error.
- **Error:** `ErrorState` with a human explanation, retry action when safe, and
  no raw database/Prisma details. The app-level `error.tsx` logs only a digest.
- **Not found:** use `not-found.tsx` patterns and avoid leaking whether a
  cross-tenant record exists.
- **Pending/processing:** use a badge plus explanatory copy; disable duplicate
  submissions.
- **Success:** confirm the resulting state, not just “Saved.” For example,
  “Event submitted for review,” “Registration confirmed,” or “Club approved.”

## 11. Content and tone

- Direct, calm, specific. Prefer “Registration closes Friday at 5:00 PM” over
  “Hurry!”
- Use “college administrator” and “club administrator” consistently.
- Mark sample/demo content clearly.
- Never imply a student is registered, approved, or verified unless the database
  confirms it.
- Dates, times, and timezones must be explicit in dense admin views.
- Error copy should say what happened, what was preserved, and what to do next.
