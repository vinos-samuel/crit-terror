# Crit-terror

A six-level tower-defense game for Savyr. Snap brick towers onto the grid, merge them, and stop waves of silly critters. They pour out of the rift on the right and march toward your fortress on the left.

- Hand-drawn comic look: thick wobbly ink outlines, flat pastels, and pencil hatching. Every sprite is drawn in code on a `<canvas>`, so there are no image assets and nothing borrowed from existing brands.
- Plays with a mouse (laptop) or touch (iPad and phones). The layout adapts to landscape and portrait.
- Static site with no backend, accounts, or analytics.

## How to play

1. On the title screen, pick a level or **Endless**. Level 1 is open immediately. Clearing a level unlocks the next one. Endless is always available. Keys `1`–`6` pick a level, `7` starts Endless.
2. Pick a tower from the toolbar, then tap or click an empty square to place it. The tower stays selected so you can place several in a row. Tap the button again to deselect it.
3. Drop one base piece on another to **merge**. You pay only for the piece you just placed. A comic burst names the result.
4. Press **Start Wave**. After each wave you get a short build break (tap the button to skip it).
5. Survive every wave to win. If **3 critters** reach the fortress, you lose. After a win, **Next Level** opens the following level and the title gallery reveals one new critter. After Level 6, **Endless** keeps going.

Keyboard shortcuts: `1` `2` `3` pick a tower during play. `Space` starts the wave, `P` or `Esc` pauses, `Enter` replays the current level, `N` goes to the next level after a win (or Endless after Level 6).

### Merges

The toolbar is always **Wall, Shooter, Trap**. Nothing else is a button.

| Drop | Onto | Result | You pay | From |
| --- | --- | --- | --- | --- |
| Shooter | Wall | **Bastion** (or the other way around) | the piece you dropped | every level |
| Shooter | Trap | **Missiler** (or the other way around) | the piece you dropped | Level 2+ |
| Wall | Trap | **Sticky Barricade** (or the other way around) | the piece you dropped | Level 2+ |
| Shooter | Shooter | **Twin Shot** | the second Shooter (50) | Level 2+ |

A merged square cannot be merged again. Level 1 can still make a Bastion. Missiler, Sticky Barricade, and Twin Shot wait until Level 2.

- **Bastion** — blocks and fires studs. Comic cue: **MERGE! / BASTION!**
- **Missiler** — fires missiles. Shells (Armored Beetle, Chomp Crab, Shell Moth) take a big **CRACK!** Soft critters still get hit, with a smaller puff. Comic cue: **MISSILE! / LOCK ON!** Level 6's open hint teaches it, because that is when shells are the whole wave.
- **Sticky Barricade** — blocks, and critters in the next squares (and the lanes beside it) get glue-slow. Beetles that ignore glue still ignore it. Comic cue: **STICKY! / SPLAT!**
- **Twin Shot** — fires two studs per volley. Comic cue: **TWIN! / DOUBLE!**

Building a Bastion from scratch is still 40 + 50 = **90**. A Missiler from scratch is 30 + 50 = **80**. You are never charged an extra fee on top of the piece you drop.

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

Levels 1 and 2 use the Bastion merge if you find it. From Level 2 the other three merges work the same way, with no new toolbar buttons. Level 1's waves, stash, and toolbar are unchanged, and three opening Shooters still cover wave 1 better than one Bastion.

### Level 3 — Quarry Dusk

A new map: clay tiles, a slate fort, and an orange kiln-rift instead of the green lawn. Six waves, harder than Level 2. Starting stash: **270** bricks.

The toolbar stays **Wall, Shooter, and Trap**. There is no Bastion button. A one-line hint on the open tells you the merge rule.

**Merge cost rule:** you pay the cost of the piece you are placing, and nothing extra.

- Drop a Shooter (50) onto a Wall → pay **50**. The square becomes a Bastion.
- Drop a Wall (40) onto a Shooter → pay **40**. The square becomes a Bastion.
- Building one from scratch is 40 + 50 = **90** bricks. You are not charged an old standalone Bastion price on top.
- The new Bastion has **340** HP, blocks the lane, and fires studs. Rollers that hop plain walls stop and chew a Bastion. Pogos still spring over it.
- A merged square cannot be merged again. Level 3's open hint is the Bastion. Missiler, Sticky Barricade, and Twin Shot are already available if you find them.

270 bricks is three from-scratch Bastions, matching the old opener of three Bastions.

| Tower | Cost | What it does |
| --- | --- | --- |
| Brick Wall | 40 | Cheap extra block. Pogos hop it. Crabs will chew it. Merge onto a Shooter. |
| Stud Shooter | 50 | Fires studs down its lane. Merge onto a Wall. |
| Glue Trap | 30 | Slows critters, including Pogo Punks. Beetles still ignore it. |
| Bastion | 90 total | Not a button. Wall + Shooter on one square. Blocks and shoots. |
| Missiler | 80 total | Not a button. Trap + Shooter. Missiles crack shells. |
| Sticky Barricade | 70 total | Not a button. Wall + Trap. Blocks and slows neighbors. |
| Twin Shot | 100 total | Not a button. Shooter + Shooter. Two studs. |

Two new critters, plus the Level 2 powers on the original three:

| Critter | Reward | Notes |
| --- | --- | --- |
| Pogo Punk | 9 | Springs over any tower (**BOING!**). Glue is how you buy time to shoot it. |
| Chomp Crab | 18 | **SHELL** shrugs off studs while it walks. Once it starts chomping, the shell opens and it eats towers fast. |

**Bricks** come from the starting stash, from defeating critters, from a small trickle while a wave is running, and from a bonus for clearing each wave.

### Level 4 — Fog Lanes

Misty lawn. The **side lanes** wear a thick fog from the middle of the lawn to the rift, so critters there (especially **Fog Wisps**) are hard to see. Traps in those lanes still slow what you cannot see. Beetles still walk through glue. One new critter: the Fog Wisp. Starting stash: **180** bricks. Five waves.

### Level 5 — Night Map

A dark lawn. The **far half** is night, and critters are silhouettes until they cross the light line. **Night Skitters** are fast and faint in the dark, then pop out close to your towers. Shoot early. Starting stash: **160** bricks. Five waves.

### Level 6 — Sky Moths

Only **Shell Moths**. They fly over every tower, including Walls, Bastions, and Sticky Barricades. Glue does not touch them. Studs tickle the shell. A Missiler (Shooter on a Trap) cracks it — the open hint says so, and a **SHELL** tag plus **CRACK!** makes the weakness obvious. Walls alone cannot win this level. Starting stash: **200** bricks. Five waves.

### Unlocks

Clearing a level saves a best (same as before) and also:

- unlocks the next level
- reveals one critter on the title gallery

| Clear | Unlocks | Reveals |
| --- | --- | --- |
| Level 1 | Level 2 | Pogo Punk |
| Level 2 | Level 3 | Chomp Crab |
| Level 3 | Level 4 | Fog Wisp |
| Level 4 | Level 5 | Night Skitter |
| Level 5 | Level 6 | Shell Moth |
| Level 6 | — | roster complete |

An older save that already has a Level 3 best starts with Level 4 unlocked and Pogo, Crab, and Fog Wisp revealed. Fresh devices start on Level 1, with Blob, Beetle, and Roller in the gallery. Locked critters show as a question mark. **Endless is never locked.**

### Endless roster

Endless always uses the **full critter roster** (every type, including ones the gallery has not revealed yet), on the quarry map, with Level 3 powers. It is not gated on campaign progress. Later waves mix in wisps, skitters, and shell moths; the first waves stay close to the old quarry opener so a Bastion plan can still get going.

### Stars and personal bests

Wins get a score and 1–3 stars. Nothing is uploaded: the best score and stars for each level, plus the best Endless wave and score, are stored in `localStorage` on this device. Title cards show **Best: …**. The win screen says **New Best!** when you beat your score.

Campaign score (a win only):

```
brickPoints = min(bricks left, 250)
thrift      = max(0, 700 - 28×towers built - 22×bastions merged)
style       = lives left × 500 + brickPoints + thrift
score       = style + waves cleared × 200
```

`towers built` counts pieces placed on empty squares. `bastions built` counts **every** merge (Bastion, Missiler, Sticky Barricade, Twin Shot), not a second tower. The formula is unchanged: each merge pays the same thrift penalty the Bastion used to. Stars use `style`, so a longer level does not get a free star:

- **3 stars** when style is at least 1880
- **2 stars** when style is at least 950
- **1 star** for any other win

Three lives and a brick stockpile with the whole lawn paved is style 1750, which is 2 stars. 3 stars means you also kept the build small. A one-life clear that paved every square stays at 1 star.

### Endless

**Endless** is one button on the title screen, and again after you beat Level 6. It is the quarry map with the full critter roster and Level 3 powers, and the waves do not stop. Starting stash: **280** bricks (three merged Bastions). Each wave adds more critters, tightens the gap, and slowly raises health, speed, bite, and brick rewards. You pay the same merge rule. When the fort falls, the screen shows the wave you reached and your score:

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
npm run balance    # headless simulation of all 6 levels with a few bot strategies
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
