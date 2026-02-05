# Controls UI Redesign Plan

## Current State Analysis

The existing control bar suffers from:

| Issue | Impact |
|-------|--------|
| **Flat hierarchy** | Play button blends in with 15+ other icons |
| **Cognitive overload** | All controls crammed into one row |
| **Mixed concerns** | Annotation, navigation, speed, and playback all jumbled |
| **No visual grouping** | No separators or spacing to guide the eye |
| **Poor mobile UX** | Controls wrap chaotically on small screens |

---

## Redesign Goals

1. **Play/Pause is the hero** — Largest, most visible element
2. **Progressive disclosure** — Show essentials, hide advanced options
3. **Clear visual groupings** — Logical separation of control types
4. **Mobile-first** — Touch-friendly, swipeable, adaptable

---

## Proposed Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ═══════════════════════ PROGRESS BAR ════════════════════════════════  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [RSVP] [Focus] [Paragraph]     ◄◄  ◄  ▶▶PLAY◀◀  ►  ►►     ⚙ More     │
│                                                                         │
│  ────────────────────────────────────────────────────────────           │
│  Speed: [R ——●——— 1.0x]   WPM: [180][240][300][360][___]   🔊 ———●     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Row 1: Progress

- Full-width seekable progress bar
- Shows current position / total duration on right

### Row 2: Primary Controls (Always Visible)

| Group | Elements |
|-------|----------|
| **View Modes** | `RSVP` `Focus` `Paragraph` — pill-style toggle |
| **Navigation** | `◄◄` (sentence back) `◄` (word back) |
| **Play (Hero)** | Large accent-colored circle, 56px |
| **Navigation** | `►` (word fwd) `►►` (sentence fwd) |
| **Overflow** | `⋮ More` — opens bottom sheet with extras |

### Row 3: Speed & Volume (Collapsible on Mobile)

| Group | Elements |
|-------|----------|
| **Rate** | Slider with live `1.0x` label |
| **WPM** | Segmented pills `180` `240` `300` `360` + editable input |
| **Volume** | Icon + slider |

### Overflow Menu (⋮ More)

Contains rarely used actions:

- ★ Highlight buffer
- 📝 Add note
- 📋 Copy sentence
- ¶ Skip paragraph back/fwd
- ≡ Skip chunk back/fwd

---

## Visual Design Tokens

```css
/* New tokens for controls */
--ctrl-gap-sm: 4px;
--ctrl-gap-md: 12px;
--ctrl-gap-lg: 24px;

--ctrl-btn-size: 40px;
--ctrl-play-size: 56px;

--ctrl-pill-bg: var(--color-bg-secondary);
--ctrl-pill-active: var(--color-primary);
--ctrl-pill-radius: 20px;

--ctrl-divider: 1px solid var(--color-border);
```

---

## Component Breakdown

### 1. `ViewModePills`

Segmented control for RSVP/Focus/Paragraph.

- Horizontal pill group with animated indicator
- Active state slides a highlight behind selected option

### 2. `PlayButton`

- 56px circle with accent gradient
- Subtle shadow and scale animation on hover
- Pulse animation when audio is playing

### 3. `NavCluster`

- Compact group: `[◄◄][◄]` ... `[►][►►]`
- 40px ghost buttons (transparent bg, border on hover)
- Long-press shows tooltip with action name

### 4. `SpeedRow`

- Rate slider: thin track, circular thumb, live label
- WPM pills: same style as ViewModePills
- Volume: icon that morphs (muted/low/high) + mini slider

### 5. `OverflowMenu`

- Triggered by `⋮` button
- Bottom sheet on mobile, dropdown on desktop
- Grid of icon+label buttons

---

## Mobile Adaptations

| Breakpoint | Behavior |
|------------|----------|
| `≤480px` | Hide SpeedRow by default; show via swipe-up or toggle |
| `≤480px` | OverflowMenu becomes full-width bottom sheet |
| `≤360px` | Hide word-level nav; keep sentence-level only |

---

## Implementation Phases

### Phase 1: Structure (Est. 2h)

- [ ] Refactor `Controls.ts` into smaller components
- [ ] Create `ViewModePills.ts`, `PlayButton.ts`, `NavCluster.ts`
- [ ] Update HTML structure in render method

### Phase 2: Styling (Est. 2h)

- [ ] Add new CSS tokens to `main.css`
- [ ] Style pill toggles with animated indicator
- [ ] Style hero play button with gradient and shadow
- [ ] Add dividers and proper spacing

### Phase 3: Overflow Menu (Est. 1.5h)

- [ ] Create `OverflowMenu.ts` component
- [ ] Move annotation/chunk controls into it
- [ ] Implement bottom sheet for mobile

### Phase 4: Polish (Est. 1h)

- [ ] Add micro-animations (hover, press, active)
- [ ] Test touch targets on mobile
- [ ] Keyboard accessibility audit

---

## Mockup Reference

> Use `generate_image` tool to create visual mockup before implementation.

---

## Success Criteria

- [ ] Play button is immediately recognizable as primary action
- [ ] Controls fit comfortably on 375px wide screen
- [ ] Advanced options don't clutter the main view
- [ ] All actions remain accessible (2 taps max)
- [ ] Consistent with existing dark/light theme tokens
