# Crit-terror

A tiny three-level tower-defense game for Savyr. Snap brick towers onto the grid and stop waves of silly critters. They pour out of the rift on the right and march toward your fortress on the left.

- Hand-drawn comic look: thick wobbly ink outlines, flat pastels, and pencil hatching. Every sprite is drawn in code on a `<canvas>`, so there are no image assets and nothing borrowed from existing brands.
- Plays with a mouse (laptop) or touch (iPad and phones). The layout adapts to landscape and portrait.
- Static site with no backend, accounts, or analytics.

## How to play

1. On the title screen, pick **Level 1**, **Level 2**, or **Level 3** (or press `1` `2` `3`).
2. Pick a tower from the toolbar, then tap or click an empty square to place it. The tower stays selected so you can place several in a row. Tap the button again to deselect it.
3. Press **Start Wave**. After each wave you get a short build break (tap the button to skip it).
4. Survive every wave to win. If **3 critters** reach the fortress, you lose. After a win, **Next Level** opens the following level.

Keyboard shortcuts: `1` `2` `3` pick a level on the title, and a tower during play. `Space` starts the wave, `P` or `Esc` pauses, `Enter` replays the current level, `N` goes to the next level after a win.

### Level 1 — Sunny Lawn

The original game, unchanged in feel. Same lawn, same three towers, same three critters, five waves. Critters do not have the Level 2 powers.

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

Starting stash: **150** bricks.

### Level 2 — Critter Powers

Same lawn and the same three towers. The critters learned tricks, and the waves are longer and meaner (still five waves).

- **Armored Beetle** walks through glue. No slow. A little **NOPE!** pops up over the trap.
- **Fast Roller** hops over walls instead of stopping to chew them. Shoot it; a wall will not hold it.
- **Soft Blob** gets back up once (**AGAIN!**), then scurries faster. The **1UP** badge means it still has that extra life.

They are also tougher than in Level 1, so they actually live long enough to use those tricks. Spread shooters across the lanes. A single lane stacked with towers lets the fast rollers through.

Starting stash: **150** bricks.

### Level 3 — Quarry Dusk

A new map: clay tiles, a slate fort, and an orange kiln-rift instead of the green lawn. Six waves, harder than Level 2. Starting stash: **220** bricks, enough for three Bastions.

The shooter is replaced by a **Bastion** (the merged wall + shooter). Walls and glue traps stay, so the toolbar is still three buttons.

| Tower | Cost | What it does |
| --- | --- | --- |
| Brick Wall | 40 | Cheap extra block. Pogos hop it. Crabs will chew it. |
| Bastion | 70 | Blocks the lane and fires studs. The main tower. |
| Glue Trap | 30 | Slows critters, including Pogo Punks. Beetles still ignore it. |

Two new critters, plus the Level 2 powers on the original three:

| Critter | Reward | Notes |
| --- | --- | --- |
| Pogo Punk | 9 | Springs over any tower (**BOING!**). Glue is how you buy time to shoot it. |
| Chomp Crab | 18 | **SHELL** shrugs off studs while it walks. Once it starts chomping, the shell opens and it eats towers fast. |

**Bricks** come from the starting stash, from defeating critters, from a small trickle while a wave is running, and from a bonus for clearing each wave.

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
npm run balance    # headless simulation of all 3 levels with a few bot strategies
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
