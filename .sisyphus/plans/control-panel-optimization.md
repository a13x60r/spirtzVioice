# Control Panel Optimization Plan

## TL;DR

> **Quick Summary**: Optimize the overloaded control panel by improving hierarchy, grouping related controls, reducing visual clutter, and implementing progressive disclosure.
>
> **Deliverables**:
> - Restructured control layout in `src/ui/components/Controls.ts`
> - Optimized control panel styles in `src/ui/styles/main.css`
> - Updated Playwright visual regression snapshots
>
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential
> **Critical Path**: Task 1

---

## Context

### Original Request
"lets optimize control panel, its overloaded"

### Current State Analysis
The control panel (`Controls.ts`) currently has:
1. **Progress bar** - Full width at top
2. **View switcher** - RSVP/Focus/Paragraph buttons
3. **Speed controls** - Rate slider, WPM slider + number input, presets, volume
4. **Playback buttons** - 13+ buttons in a single row:
   - Highlight, Note, Copy
   - Skip chunk back, Skip para back, Skip sent back, Skip word back
   - Seek back, Play/Pause, Seek forward
   - Skip word fwd, Skip sent fwd, Skip para fwd
   - Toggle speed (mobile only)
5. **Time display** - Current/total time

### Problems Identified
1. **Too many buttons** - 13+ playback buttons create visual overload
2. **No clear grouping** - Navigation, playback, and utility buttons mixed together
3. **Hierarchy issues** - Primary action (Play/Pause) competes with secondary actions
4. **Poor mobile experience** - Buttons wrap awkwardly on small screens
5. **Cluttered layout** - Speed controls and playback buttons in same visual space

---

## Work Objectives

### Core Objective
Restructure the control panel to reduce overload while maintaining all functionality, improving visual hierarchy, and ensuring responsive behavior.

### Concrete Deliverables
- Optimized control panel markup in `src/ui/components/Controls.ts`.
- Improved control panel styling in `src/ui/styles/main.css`.
- Updated Playwright visual regression snapshots.

### Definition of Done
- [ ] Control panel has clear visual hierarchy with reduced clutter.
- [ ] Related controls are logically grouped.
- [ ] Primary actions (play/pause) are visually prominent.
- [ ] Secondary actions use progressive disclosure or compact layout.
- [ ] All existing functionality preserved.
- [ ] Playwright visual regression tests pass.

### Must Have
- Clear separation between primary, secondary, and utility controls.
- Improved spacing and visual breathing room.
- Logical grouping of navigation controls (skip buttons).
- Responsive layout that works on mobile and desktop.
- All 13+ playback buttons still accessible.

### Must NOT Have (Guardrails)
- No removal of existing functionality.
- No changes to control behavior or callbacks.
- No new dependencies.
- No changes to speed control logic.

---

## Proposed Solution

### Layout Restructure
```
Row 1: [View Switcher]                    [Time Display]
Row 2: [Progress Bar]
Row 3: [Playback Controls - Primary]      [Utility Controls]
Row 4: [Navigation Controls - Secondary]
Row 5: [Speed Controls - Collapsible on mobile]
```

### Specific Changes
1. **Group navigation buttons** - Chunk/Paragraph/Sentence/Word skip buttons in logical left/right groups
2. **Highlight primary actions** - Play/Pause larger and more prominent
3. **Compact utility buttons** - Highlight, Note, Copy as icon-only compact group
4. **Progressive disclosure** - Speed controls in collapsible section (already have toggle for mobile)
5. **Better spacing** - More whitespace between groups

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (Playwright, Vitest)
- **Automated tests**: Tests-after
- **Framework**: Playwright (visual regression)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Scenario: Control panel shows optimized layout (desktop)
  Tool: Playwright (playwright skill)
  Preconditions: Dev server running
  Steps:
    1. Navigate to dev server URL
    2. Wait for: #progress-container visible
    3. Screenshot: .sisyphus/evidence/controls-desktop.png
  Expected Result: Control panel has clear hierarchy, grouped controls, reduced clutter
  Evidence: .sisyphus/evidence/controls-desktop.png

Scenario: Control panel responsive on mobile
  Tool: Playwright (playwright skill)
  Preconditions: Dev server running
  Steps:
    1. Set viewport: 390x844
    2. Navigate to dev server URL
    3. Screenshot: .sisyphus/evidence/controls-mobile.png
  Expected Result: Controls adapt to mobile layout, all buttons accessible
  Evidence: .sisyphus/evidence/controls-mobile.png

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
└── Task 1: Control panel optimization + snapshot update

Critical Path: Task 1

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | None | None |

---

## TODOs

- [ ] 1. Optimize control panel layout and styles, then update visual snapshot

  **What to do**:
  - Restructure control layout in `src/ui/components/Controls.ts` for better hierarchy.
  - Group navigation controls (skip buttons) logically.
  - Make Play/Pause more prominent (larger, primary styling).
  - Compact utility buttons (Highlight, Note, Copy) into smaller group.
  - Move speed controls to collapsible section (desktop + mobile).
  - Optimize styles in `src/ui/styles/main.css` for new layout.
  - Update Playwright visual regression snapshots.

  **Must NOT do**:
  - Remove any existing buttons or functionality.
  - Change callback functions or behavior.
  - Modify speed control logic or WPM handling.
  - Introduce new dependencies.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: UI layout optimization and hierarchy improvements.
  - **Skills**: [frontend-ui-ux, playwright]
    - frontend-ui-ux: control layout and visual hierarchy.
    - playwright: visual regression testing.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
    - `src/ui/components/Controls.ts` - Control panel markup and structure.
    - `src/ui/styles/main.css` - Control panel styles (lines ~483-700).
    - `tests/e2e/visual-regression.spec.ts` - Visual test flow.

  **Acceptance Criteria**:
  - [ ] Control panel has clear visual hierarchy with grouped controls.
  - [ ] Play/Pause button is visually prominent.
  - [ ] All 13+ playback buttons remain accessible.
  - [ ] Speed controls in collapsible section.
  - [ ] `npx playwright test tests/e2e/visual-regression.spec.ts` passes.

  **Agent-Executed QA Scenarios**:
  - Scenario: Control panel shows optimized layout (desktop)
  - Scenario: Control panel responsive on mobile

  **Commit**: NO

---

## Commit Strategy

No commits requested.

---

## Success Criteria

### Verification Commands
```bash
npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
npx playwright test tests/e2e/visual-regression.spec.ts
```

### Final Checklist
- [ ] Control panel UI optimized with reduced overload
- [ ] All functionality preserved
- [ ] Visual regression snapshot updated and tests pass
