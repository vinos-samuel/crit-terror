# Crit-terror

A tiny, one-level tower-defense game for Savyr. Snap brick towers onto a lawn grid and stop waves of silly critters. They pour out of the purple rift on the right and march toward your fortress on the left.

- Hand-drawn comic look: thick wobbly ink outlines, flat pastels, and pencil hatching. Every sprite is drawn in code on a `<canvas>`, so there are no image assets and nothing borrowed from existing brands.
- Plays with a mouse (laptop) or touch (iPad and phones). The layout adapts to landscape and portrait.
- Static site with no backend, accounts, or analytics.

## How to play

1. Press **Play** on the title screen.
2. Pick a tower from the toolbar (**Wall**, **Shooter**, or **Trap**), then tap or click an empty lawn square to place it. The tower stays selected so you can place several in a row. Tap the button again to deselect it.
3. Press **Start Wave**. After each wave you get a short build break (tap the button to skip it).
4. Survive all **5 waves** to win. If **3 critters** reach the fortress, you lose.

| Tower | Cost | What it does |
| --- | --- | --- |
| Brick Wall | 40 | Tough block. Critters stop and chew on it. |
| Stud Shooter | 50 | Fires studs at critters in its lane. |
| Glue Trap | 30 | Critters walking over it slow way down. |

| Critter | Reward | Notes |
| --- | --- | --- |
| Soft Blob | 5 | Bouncy and slow |
| Armored Beetle | 15 | Hard shell takes 40% less stud damage |
| Fast Roller | 8 | Low health, very fast |

**Bricks** (the currency) come from a 150-brick starting stash, from defeating critters, from a small trickle while a wave is running, and from a bonus for clearing each wave.

Keyboard shortcuts: `1` `2` `3` pick a tower, `Space` starts the wave, `P` or `Esc` pauses, `Enter` restarts after a win or loss.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:4817 (also reachable on your LAN, e.g. from an iPad)
```

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build on http://localhost:4818
npm run balance    # headless simulation of all 5 waves with a few bot strategies
```

## Deploy to Vercel

The build is a plain static site (`dist/`), and `vercel.json` already sets the framework, build command, and output directory.

**From the dashboard (Git):**

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Vercel, click **Add New… → Project** and import the repo.
3. Keep the detected settings (Framework: Vite, Build: `npm run build`, Output: `dist`) and click **Deploy**.

Every push to the main branch then redeploys automatically, and pull requests get preview URLs.

**From the CLI:**

```bash
npm i -g vercel
vercel            # first run links the project and creates a preview deployment
vercel --prod     # promote to production
```

No environment variables are needed.

## Project layout

```
src/
  main.ts      boot, game loop, pointer/keyboard input, effects
  sim.ts       game rules (pure logic, no DOM): towers, critters, waves, bricks
  config.ts    all tuning numbers: costs, HP, speeds, wave makeup
  render.ts    scene, HUD, toolbar, title and win/lose/pause screens
  sprites.ts   hand-drawn sprite recipes, cached as bitmaps per size
  ink.ts       wobbly-ink drawing helpers (outlines, hatching, comic text)
  layout.ts    landscape and portrait layouts
scripts/
  balance.ts   headless balance check
```

Fonts: [Luckiest Guy](https://fonts.google.com/specimen/Luckiest+Guy) (Apache 2.0) and [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) (OFL), bundled via Fontsource.
