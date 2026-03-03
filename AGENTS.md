# AGENTS.md

Guidance for autonomous coding agents working in this repository.

## Project Snapshot

- App: toddler-friendly bubble + balloon popping web game.
- Primary goals: fun interactions, counting practice, number recognition.
- Runtime: browser, mobile-friendly, installable PWA.
- Current renderer: HTML Canvas 2D.
- Target direction: TypeGPU/WebGPU visuals + richer particles.
- Requested gameplay polish: distinct sound effects for bubbles vs balloons.

## Source Layout

- `src/main.ts`: game loop, physics, rendering, input, score, service worker registration.
- `src/style.css`: UI and game styling.
- `index.html`: shell markup and script/style entrypoints.
- `public/`: static assets (manifest, icons, service worker, etc.).
- `assets/`: project assets used during development.

## Environment

- Package manager: `pnpm`.
- Bundler/dev server: `vite`.
- Language: TypeScript (`strict: true`).
- TS module system: `ESNext` with `moduleResolution: Bundler`.

## Setup Commands

- Install deps: `pnpm install`
- Start dev server: `pnpm dev`
- Production build (includes typecheck): `pnpm build`
- Preview production build: `pnpm preview`

## Lint / Format / Typecheck

- Linting is **not configured yet** (no ESLint config found).
- Formatting is **not configured yet** (no Prettier config found).
- Type safety check is done via build script (`tsc --noEmit && vite build`).
- If you only need TS validation quickly, run: `pnpm exec tsc --noEmit`.

## Test Commands

- Automated tests are **not configured yet** (no test config or test files found).
- If adding tests, prefer Vitest with jsdom for browser logic.
- Suggested future commands:
  - All tests: `pnpm vitest run`
  - Watch mode: `pnpm vitest`
  - Single file: `pnpm vitest run src/path/to/file.test.ts`
  - Single test name: `pnpm vitest run -t "popAt pops top-most entity"`

## Build/Test Expectations For PRs

- Minimum pre-merge check currently: `pnpm build`.
- If tests are added, run both:
  - `pnpm build`
  - `pnpm vitest run`
- Prefer focused reruns while iterating, then one full run before handoff.

## Coding Style (TypeScript)

- Use strict TypeScript-compatible code; avoid `any` unless justified.
- Prefer `type` aliases for object shapes and unions (matches existing style).
- Add explicit return types to exported/public functions and complex helpers.
- Use `const` by default; use `let` only for mutation.
- Keep functions small and purpose-driven (input, update, render separation).
- Use early guards for required DOM nodes and critical APIs.
- Throw clear errors when required elements/APIs are missing.
- Keep side effects localized (event binding near bootstrapping code).

## Imports and Modules

- Keep imports at top of file.
- Group imports in this order when relevant:
  1) platform/built-in,
  2) third-party,
  3) local modules.
- Within each group, sort alphabetically when practical.
- Prefer named exports over default exports for shared modules.
- Avoid deep relative paths when a cleaner module structure is available.

## Naming Conventions

- `PascalCase`: type aliases and type-like constructs (`Entity`, `Particle`).
- `camelCase`: variables, functions, params, local helpers (`spawnEntity`).
- `UPPER_SNAKE_CASE`: constants (`COLORS`) that are immutable global-ish data.
- Use descriptive verbs for actions (`reset`, `render`, `doPop`, `resize`).
- Use short but meaningful physics/math variables (`vx`, `vy`, `dt`) in tight loops.

## Formatting Conventions

- Match existing formatting in repository.
- Use 2-space indentation.
- Use semicolons.
- Use double quotes in TS/JS strings.
- Keep trailing commas where they improve diff hygiene in multiline literals.
- Prefer one logical statement per line for readability.

## Error Handling + Logging

- Fail fast for non-recoverable setup issues (missing canvas/context/elements).
- Recover gracefully for optional features (e.g., service worker registration).
- Log actionable context in `catch` blocks.
- Do not swallow errors silently.
- Avoid noisy logs in per-frame loops.

## Game/UX-Specific Guidelines

- Maintain forgiving touch targets and toddler-friendly interactions.
- Preserve simple controls: tap/click to pop, easy reset.
- Keep visuals bright, playful, and high-contrast.
- Preserve performance on low-end mobile devices.
- For new effects, budget CPU/GPU carefully to keep frame pacing smooth.

## Audio Guidelines (Requested)

- Add sound effects for both bubble pops and balloon pops.
- Use distinct timbre/pitch to differentiate bubble vs balloon.
- Keep volume conservative and non-startling.
- Respect autoplay policies (unlock audio on first user gesture).
- Provide a simple mute toggle or honor system mute state if added.
- Keep audio latency low for tap-to-pop feedback.

## WebGPU / TypeGPU Direction

- Prefer incremental migration from Canvas 2D to TypeGPU/WebGPU.
- Keep gameplay logic renderer-agnostic where possible.
- Isolate render pipeline code from game-state update code.
- Validate graceful fallback when WebGPU is unavailable.
- Preserve existing accessibility and touch behavior during migration.

## PWA / Platform Notes

- Service worker registration is guarded for production and availability.
- Do not break offline-critical assets (manifest/icons/sw paths).
- Test installability after changing shell assets or manifest behavior.

## Agent Workflow Rules

- Before edits: read related files fully and follow local patterns.
- Make minimal, targeted changes.
- Avoid broad refactors unless requested.
- Update docs when adding new commands, tooling, or architecture.
- If adding lint/test tools, also update this file with exact commands.

## Repository Policy Files

- Cursor rules: none found (`.cursor/rules/` missing, `.cursorrules` missing).
- Copilot instructions: none found (`.github/copilot-instructions.md` missing).
- If these files are added later, treat them as high-priority constraints and mirror key rules here.

## Definition of Done (Current Repo)

- Code compiles and bundles: `pnpm build` passes.
- Manual sanity check in browser for tap/click pop flow.
- No regressions to reset, score updates, and mobile interaction.
- For audio work: verify both sound variants trigger correctly on pop.
- Changes are small, readable, and consistent with existing style.
