# Code Style

## Naming Conventions
- Classes and interfaces: PascalCase (`ReaderShell`, `DocumentStore`).
- Functions and methods: camelCase (`buildStructureMap`, `handleNewDocument`).
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_WPM_RANGE`, `APP_VERSION`).
- Files: PascalCase for many class files (`ReaderShell.ts`, `DocumentStore.ts`), camelCase for utilities (`readerModel.ts`, `seed_documents.ts`).

## File Organization
- `src/domain/`: pure processing (tokenization, plan, timeline).
- `src/audio/`: playback scheduling, controller, audio orchestration.
- `src/storage/`: Dexie schema + store classes.
- `src/ui/`: shell, components, and views.
- `src/workers/`: TTS worker and Piper integration.
- Tests colocated in `src/**/__tests__` or `*.test.ts`; e2e tests in `tests/e2e/`.

## Import Style
- Path aliases defined in `tsconfig.json` and `vite.config.ts`:
  - `@domain`, `@audio`, `@storage`, `@ui`, `@workers`, `@spec`, `@`.
- Mix of alias and relative imports; follow local patterns in the file you edit.

## Code Patterns
- Static utility classes for pure domain logic (`TextPipeline`, `PlanEngine`, `TimelineEngine`).
- Store classes encapsulate IndexedDB operations and are exported as singletons (`documentStore`, `settingsStore`).
- UI components are class-based with `mount`/`unmount` lifecycles and explicit DOM binding.
- Worker messaging uses typed protocols (`src/workers/tts-protocol.ts`).

## Error Handling
- Errors are logged with `console.warn`/`console.error` and often allowed to propagate.
- UI flows commonly guard with early returns if missing DOM references.
- Some operations use try/finally to ensure UI state is restored (e.g., loading overlays).

## Logging
- Uses `console.log`, `console.warn`, `console.error` throughout.
- ESLint allows `warn` and `error`, and warns on other console calls (`.eslintrc.json`).

## Testing
- Unit/integration: Vitest with JSDOM (`vitest.config.ts`, `src/__tests__/setup.ts`).
- E2E: Playwright under `tests/e2e/` (`playwright.config.ts`).
- Test files use `*.test.ts` naming and `__tests__` folders.

## Formatting Notes
- Indentation is not fully uniform across files (some 2 spaces, some 4).
- When modifying a file, keep its existing indentation and quoting style.

## Do's and Don'ts
- Do reuse stores and domain utilities instead of ad-hoc storage calls.
- Do keep DOM event wiring in `mount` and clean up in `unmount`.
- Do prefer existing path aliases for new imports.
- Don't bypass Dexie stores for direct DB access unless a new store is needed.
- Don't add new global state outside `ReaderShell` unless required.
