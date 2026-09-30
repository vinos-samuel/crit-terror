# Crit-terror

A tiny three-level tower-defense game for Savyr. Snap brick towers onto the grid and stop waves of silly critters. They pour out of the rift on the right and march toward your fortress on the left.

- Hand-drawn comic look: thick wobbly ink outlines, flat pastels, and pencil hatching. Every sprite is drawn in code on a `<canvas>`, so there are no image assets and nothing borrowed from existing brands.
- Plays with a mouse (laptop) or touch (iPad and phones). The layout adapts to landscape and portrait.
- Static site with no backend, accounts, or analytics.

## How to play

1. On the title screen, pick **Level 1**, **Level 2**, **Level 3**, or **Endless** (or press `1` `2` `3` `4`).
2. Pick a tower from the toolbar, then tap or click an empty square to place it. The tower stays selected so you can place several in a row. Tap the button again to deselect it.
3. Drop a **Shooter on a Wall**, or a **Wall on a Shooter**, and that square **merges into a Bastion**. You pay only for the piece you just placed. A comic **MERGE! / BASTION!** pops on the tile.
4. Press **Start Wave**. After each wave you get a short build break (tap the button to skip it).
5. Survive every wave to win. If **3 critters** reach the fortress, you lose. After a win, **Next Level** opens the following level. After Level 3, **Endless** keeps going.

Keyboard shortcuts: `1` `2` `3` pick a level on the title, and a tower during play. `4` starts Endless. `Space` starts the wave, `P` or `Esc` pauses, `Enter` replays the current level, `N` goes to the next level after a win (or Endless after Level 3).

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

A new map: clay tiles, a slate fort, and an orange kiln-rift instead of the green lawn. Six waves, harder than Level 2. Starting stash: **270** bricks.

The toolbar stays **Wall, Shooter, and Trap**. There is no Bastion button. A one-line hint on the open tells you the merge rule.

**Merge cost rule:** you pay the cost of the piece you are placing, and nothing extra.

- Drop a Shooter (50) onto a Wall → pay **50**. The square becomes a Bastion.
- Drop a Wall (40) onto a Shooter → pay **40**. The square becomes a Bastion.
- Building one from scratch is 40 + 50 = **90** bricks. You are not charged an old standalone Bastion price on top.
- The new Bastion has **340** HP, blocks the lane, and fires studs. Rollers that hop plain walls stop and chew a Bastion. Pogos still spring over it.
- Traps do not merge. A Bastion cannot be merged again.

270 bricks is three from-scratch Bastions, matching the old opener of three Bastions. Levels 1 and 2 use the same merge if you find it. Level 1's waves, stash, and toolbar are unchanged, and three opening Shooters still cover wave 1 better than one Bastion.

| Tower | Cost | What it does |
| --- | --- | --- |
| Brick Wall | 40 | Cheap extra block. Pogos hop it. Crabs will chew it. Merge onto a Shooter. |
| Stud Shooter | 50 | Fires studs down its lane. Merge onto a Wall. |
| Glue Trap | 30 | Slows critters, including Pogo Punks. Beetles still ignore it. |
| Bastion | 90 total | Not a button. Wall + Shooter on one square. Blocks and shoots. |

Two new critters, plus the Level 2 powers on the original three:

| Critter | Reward | Notes |
| --- | --- | --- |
| Pogo Punk | 9 | Springs over any tower (**BOING!**). Glue is how you buy time to shoot it. |
| Chomp Crab | 18 | **SHELL** shrugs off studs while it walks. Once it starts chomping, the shell opens and it eats towers fast. |

**Bricks** come from the starting stash, from defeating critters, from a small trickle while a wave is running, and from a bonus for clearing each wave.

### Stars and personal bests

Wins get a score and 1–3 stars. Nothing is uploaded: the best score and stars for each level, plus the best Endless wave and score, are stored in `localStorage` on this device. Title cards show **Best: …**. The win screen says **New Best!** when you beat your score.

Campaign score (a win only):

```
brickPoints = min(bricks left, 250)
thrift      = max(0, 700 - 28×towers built - 22×bastions merged)
style       = lives left × 500 + brickPoints + thrift
score       = style + waves cleared × 200
```

`towers built` counts pieces placed on empty squares. A merge counts as one bastion, not as a second tower. Stars use `style`, so a longer level does not get a free star:

- **3 stars** when style is at least 1880
- **2 stars** when style is at least 950
- **1 star** for any other win

Three lives and a brick stockpile with the whole lawn paved is style 1750, which is 2 stars. 3 stars means you also kept the build small. A one-life clear that paved every square stays at 1 star.

### Endless

**Endless** is one button on the title screen, and again after you beat Level 3. It is the quarry map with the full critter roster and Level 3 powers, and the waves do not stop. Starting stash: **280** bricks (three merged Bastions). Each wave adds more critters, tightens the gap, and slowly raises health, speed, bite, and brick rewards. You pay the same merge rule. When the fort falls, the screen shows the wave you reached and your score:

```
score = waves cleared × 500 + lives × 150 + min(bricks, 200)
      + max(0, 400 - 12×towers built - 8×bastions merged)
```

The best wave and the best score are kept separately on this device.

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
  score.ts     win/endless scores, star bands, on-device personal bests
  render.ts    scene, HUD, toolbar, title and win/lose/pause screens
  sprites.ts   hand-drawn sprite recipes, cached as bitmaps per size
  ink.ts       wobbly-ink drawing helpers (outlines, hatching, comic text)
  layout.ts    landscape and portrait layouts
scripts/
  balance.ts   headless balance check
```

Fonts: [Luckiest Guy](https://fonts.google.com/specimen/Luckiest+Guy) (Apache 2.0) and [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) (OFL), bundled via Fontsource.
