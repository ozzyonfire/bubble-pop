# Bubble Pop

A tiny, kid-friendly bubble & balloon popping game for the browser.

## Run

Install dependencies and start Vite:

```bash
cd ~/dev/projects/bubble-pop
pnpm install
pnpm dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
pnpm build
pnpm preview
```

## Install (PWA)

- Open the app in a supported mobile or desktop browser.
- Use the browser's install action ("Add to Home screen" or "Install app").
- After the first visit, the service worker caches app files for offline use.

## Controls

- Click / tap bubbles and balloons to pop them.
- Press **R** to reset.

## Notes

- Works with mouse and touch.
- Designed to be simple, colorful, and forgiving (big hit targets).
- Built with Vite + TypeScript.
- Installable as a PWA.
