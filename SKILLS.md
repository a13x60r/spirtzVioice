# Spirtz Voice Development "Skills"

This document outlines the standard patterns, workflows, and "skills" required to contribute to the **Spirtz Voice** codebase effectively. This is intended to be a guide for both human developers and AI assistants.

## 1. UI Development (The "Vanilla" Way)

**Skill:** Creating a new UI Component.

The project does **NOT** use a UI framework (React/Vue). Instead, it uses a class-based component pattern where each class manages its own DOM slice.

**Pattern:**

1. **Container-based**: Components take a `HTMLElement` (container) in the constructor.
2. **Explicit Render**: A `render()` method sets `innerHTML` or builds DOM nodes.
3. **Event Binding**: A `bindEvents()` method attaches listeners.
4. **State Updates**: Specific methods (e.g., `setPlaying(bool)`) update the DOM directly to avoid full re-renders (fine-grained reactivity).
5. **Icons**: SVG Icons are defined as constant strings within the file or imported.

**Example Template:**

```typescript
export class MyComponent {
  private container: HTMLElement;
  private btnCb: () => void;

  constructor(container: HTMLElement, onBtnClick: () => void) {
    this.container = container;
    this.btnCb = onBtnClick;
    this.render();
    this.bindEvents();
  }

  private render() {
    this.container.innerHTML = \`<button id="my-btn">Click Me</button>\`;
  }

  private bindEvents() {
    this.container.querySelector('#my-btn')?.addEventListener('click', this.btnCb);
  }

  // Optimize updates: dont re-render HTML, just toggle classes/text
  setState(isActive: boolean) {
    const btn = this.container.querySelector('#my-btn');
    if(btn) btn.textContent = isActive ? "Active" : "Inactive";
  }
}
```

## 2. Event System (Domain Logic)

**Skill:** Adding a new System Event.

The application uses an event-driven architecture with a custom typed event bus.

**Workflow:**

1. **Define Type**: Open \`spec/events.ts\`.
2. **Add to Union**: Add your new event literal type to \`ControllerEvent\` (or relevant event type).

    ```typescript
    | { type: "MY_NEW_ACTION"; payload: number }
    ```

3. **Handle**: Go to \`src/audio/PlaybackController.ts\` (or relevant consumer) and add the case to the `handleEvent` switch statement.

**Rule**: All complex logic triggers via events. UI components dispatch events; they rarely call logic directly.

## 3. Storage & Persistence

**Skill:** Modifying the Database Schema.

We use **Dexie.js** (IndexedDB wrapper).

**Workflow:**

1. **Update Interface**: Edit \`src/storage/Database.ts\` to update the TypeScript interface (e.g., \`DocumentEntity\`).
2. **Versioning**: In \`AppDatabase\` constructor, add a new version step.

    ```typescript
    this.version(4).stores({
        documents: 'id, title, newIndexedField' // Only list indexed fields!
    }).upgrade(tx => {
        // Migration logic if needed
    });
    ```

    *Note: Dexie syntax: only keys/indexes are listed in `stores()`, not all fields.*

## 4. TTS & Audio

**Skill:** Adding a TTS Strategy or Feature.

The audio engine is centered on accurate time scheduling.

**Key Invariant**: `AudioContext.currentTime` is the Source of Truth.

- **Do not** use `setTimeout` for audio timing.
- **Do not** trust the UI loop for sync.
- Use the `AudioScheduler` to queue buffers at precise times.

## 5. Testing

**Skill:** Running Unit Tests.

We use **Vitest**.

- **Run**: `npm test`
- **Pattern**: Test logic in `src/domain/` and `src/storage/`. UI testing is minimal/integration based.

## 6. End-to-End Testing (Visual)

**Skill:** Visual Regression & E2E.

We use **Playwright**.

- **Run**: `npx playwright test visual-regression.spec.ts`
- **Snapshot Update**: `npx playwright test visual-regression.spec.ts --update-snapshots`
- **Pattern**:
  - Visual regression tests snapshot critical views (Library, Reader, Settings).
  - Use `page.addStyleTag` to hide non-deterministic elements (warnings, timestamps) before snapshotting.
  - Disable animations/transitions to prevent flakiness.
