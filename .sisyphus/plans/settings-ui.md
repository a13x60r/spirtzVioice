# Settings UI Refresh Plan

## TL;DR

> **Quick Summary**: Refresh the settings modal UI to improve hierarchy, spacing, and scanning while keeping behavior unchanged and responsive across screen sizes.
>
> **Deliverables**:
> - Updated settings modal markup and grouping in `src/ui/components/Settings.ts`
> - New/adjusted settings modal styles in `src/ui/styles/main.css`
> - Updated Playwright visual regression snapshot for the settings modal
>
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential
> **Critical Path**: Task 1

---

## Context

### Original Request
"@tests/e2e/screenshots/05-settings.png improve settings ui"

### Interview Summary
**Key Discussions**:
- Visual direction: refine existing design (no bold redesign)
- Responsive target: dynamic based on screen size
- Tests: update automated tests after changes (Playwright visual regression)
- Scope: UI-only, no functional behavior changes

**Research Findings**:
- Settings modal markup and class names live in `src/ui/components/Settings.ts`.
- Settings panel is mounted from `src/ui/ReaderShell.ts` via `SettingsPanel`.
- `src/ui/styles/main.css` already includes settings modal styles that should be refined/extended.
- Visual regression snapshot exists in `tests/e2e/visual-regression.spec.ts` (`settings-modal.png`).

### Metis Review
**Status**: Metis tool unavailable (JSON parse / model error). Proceeding without automated gap analysis.

---

## Work Objectives

### Core Objective
Improve the settings modal UI with clearer grouping, hierarchy, and spacing while preserving current functionality and control order, and ensuring responsive behavior across screen sizes.

### Concrete Deliverables
- Refined settings modal structure and grouping in `src/ui/components/Settings.ts`.
- Dedicated settings modal styling in `src/ui/styles/main.css` using existing tokens.
- Updated Playwright visual regression snapshot for the settings modal.

### Definition of Done
- [x] Settings modal renders with improved visual hierarchy and grouping without changing functionality.
- [x] Playwright visual regression test passes with updated snapshot.

### Must Have
- Clear section separation and consistent spacing between control groups.
- Improved header/footer readability and modal chrome (overlay, close button visibility).
- Responsive layout that adapts to smaller screens (scrolling content if needed).

### Must NOT Have (Guardrails)
- No changes to settings data model, behavior, or control values.
- No new dependencies or framework changes.
- No reordering of controls unless required for clearer grouping.
- No global theme or typography changes outside the settings modal.

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

Scenario: Settings modal opens with clear hierarchy (desktop)
  Tool: Playwright (playwright skill)
  Preconditions: Dev server running on localhost:5173
  Steps:
    1. Navigate to: http://localhost:5173/
    2. Wait for: #btn-settings visible (timeout: 5s)
    3. Click: #btn-settings
    4. Wait for: .settings-modal visible (timeout: 5s)
    5. Assert: .settings-header h2 contains "Settings"
    6. Assert: .settings-group count >= 6
    7. Screenshot: .sisyphus/evidence/task-1-settings-desktop.png
  Expected Result: Modal is readable with clear grouping and hierarchy
  Evidence: .sisyphus/evidence/task-1-settings-desktop.png

Scenario: Settings modal remains usable on narrow viewport (mobile)
  Tool: Playwright (playwright skill)
  Preconditions: Dev server running on localhost:5173
  Steps:
    1. Set viewport: 390x844
    2. Navigate to: http://localhost:5173/
    3. Click: #btn-settings
    4. Wait for: .settings-modal visible (timeout: 5s)
    5. Evaluate: .settings-content scrollHeight > clientHeight
    6. Scroll: .settings-content to bottom
    7. Assert: .settings-footer visible in viewport
    8. Screenshot: .sisyphus/evidence/task-1-settings-mobile.png
  Expected Result: Modal content scrolls within viewport and remains usable
  Evidence: .sisyphus/evidence/task-1-settings-mobile.png

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
└── Task 1: Settings modal UI refresh + visual snapshot update

Critical Path: Task 1

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | None | None |

---

## TODOs

- [x] 1. Refresh settings modal structure and styles, then update visual snapshot

  **What to do**:
  - Refine modal layout and grouping in `src/ui/components/Settings.ts` (semantic sections, wrappers, consistent spacing).
  - Add/adjust settings modal styles in `src/ui/styles/main.css` (overlay, modal container, header, group spacing, labels, range controls).
  - Keep existing control order and behavior intact.
  - Update Playwright visual regression snapshot for the settings modal.

  **Must NOT do**:
  - Change settings values, defaults, or behavior.
  - Introduce new dependencies or global typography changes.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: UI layout, styling, and hierarchy refinements are the primary work.
  - **Skills**: [frontend-ui-ux, playwright]
    - frontend-ui-ux: ensures deliberate layout and visual hierarchy.
    - playwright: updates and verifies visual regression snapshot.
  - **Skills Evaluated but Omitted**:
    - git-master: no git operations required.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/ui/components/Settings.ts` - Settings modal markup, section structure, and class names to refine.
  - `src/ui/ReaderShell.ts` - Mount point and open/close behavior to keep intact.
  - `src/ui/styles/main.css` - Global tokens; place new settings modal styles here.
  - `tests/e2e/visual-regression.spec.ts` - Visual test flow and snapshot name for settings modal.

  **Acceptance Criteria**:
  - [x] Settings modal uses clear visual grouping and spacing without altering control behavior.
  - [x] `npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots` completes successfully.
  - [x] `npx playwright test tests/e2e/visual-regression.spec.ts` passes with updated `settings-modal.png`.

  **Agent-Executed QA Scenarios**:
  - Scenario: Settings modal opens with clear hierarchy (desktop)
  - Scenario: Settings modal remains usable on narrow viewport (mobile)

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
- [x] Settings modal UI is improved and responsive without functional changes
- [x] Visual regression snapshot updated and tests pass
