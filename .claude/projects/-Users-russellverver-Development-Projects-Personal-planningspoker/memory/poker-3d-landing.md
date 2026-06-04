---
name: poker-3d-landing
description: The "/" landing page is a self-contained 3D Planning Poker design, separate from the real backend multiplayer session flow
metadata:
  type: project
---

The home route `/` renders the Inertia page `poker` ([resources/js/pages/poker.tsx](resources/js/pages/poker.tsx)) — a faithful port of the "Planning Poker 3D" Claude Design handoff. It is a **standalone, fully client-side experience**: setup (manual/CSV item entry) → item intro → voting → 3D reveal → complete, with **simulated players** (bots auto-vote) and no backend calls.

Key pieces:
- [resources/js/lib/poker-scene.js](resources/js/lib/poker-scene.js) — the three.js `PokerScene` (table, felt/wood/floor textures, card throw + flip, projected seat labels, camera moves, drag-orbit, light/dark themes).
- [resources/js/pages/poker.css](resources/js/pages/poker.css) — shadcn-style tokens + components, **namespaced under `.pp3d`** so the design's HSL token system stays isolated from the app's Tailwind/shadcn tokens. Theme is set via `data-theme` on the `.pp3d` wrapper, not `document.documentElement`.
- [resources/js/components/poker-icon.tsx](resources/js/components/poker-icon.tsx) — inline stroke icons.
- Deps added with bun: `three`, `motion` (+ `@types/three`). UI is Dutch.

**Do not confuse this with the real multiplayer app**: the actual backend planning poker (auth, Reverb broadcasting, persisted sessions/stories/votes) lives under `/sessions/*` ([app/Http/Controllers/PlanningSessionController.php](app/Http/Controllers/PlanningSessionController.php), [resources/js/pages/sessions/show.tsx](resources/js/pages/sessions/show.tsx)) and is unchanged. The old landing page is still at [resources/js/pages/welcome.tsx](resources/js/pages/welcome.tsx) but no longer routed.
