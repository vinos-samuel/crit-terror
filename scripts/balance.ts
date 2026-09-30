// Headless balance check: `npx tsx scripts/balance.ts`
import { COLS, LEVELS, ROWS, TOWERS, type LevelId, type TowerKind } from '../src/config';
import { mulberry32 } from '../src/ink';
import { campaignScore, endlessScore } from '../src/score';
import { Game } from '../src/sim';

type Strategy = (g: Game) => void;

const idle: Strategy = () => {};

/** A plain kid-level plan: shooters across every lane, then walls, then glue. */
const greedy: Strategy = (g) => {
  const count = (row: number, kind: string) => g.grid[row].filter((t) => t?.kind === kind).length;
  const rows = [...Array(ROWS).keys()];
  // Middle lanes first (where wave 1 arrives), then whichever lane is under the most pressure.
  const bias = [0.1, 0.3, 0.5, 0.3, 0.1];
  const threat = (r: number) => g.enemies.filter((e) => e.row === r).reduce((s, e) => s + e.hp, 0) / 60 + bias[r];
  const busiest = (kind: string) =>
    [...rows].sort((a, b) => (threat(b) + 1) / (count(b, kind) + 1) - (threat(a) + 1) / (count(a, kind) + 1))[0];
  const firstFree = (row: number, from: number) => {
    for (let c = from; c < COLS; c++) if (!g.grid[row][c]) return c;
    return -1;
  };
  if (g.bricks >= TOWERS.shooter.cost) {
    const row = busiest('shooter');
    if (count(row, 'shooter') < 3) {
      g.place('shooter', row, firstFree(row, 0));
      return;
    }
  }
  if (g.bricks >= TOWERS.wall.cost) {
    const row = busiest('wall');
    if (count(row, 'wall') < 1) {
      g.place('wall', row, 5);
      return;
    }
  }
  if (g.bricks >= TOWERS.trap.cost) {
    const row = busiest('trap');
    if (count(row, 'trap') < 1) g.place('trap', row, 6);
  }
};

function run(strategy: Strategy, seed: number, level: LevelId = 1, stopAfterWave = Infinity, endless = false) {
  const g = new Game(mulberry32(seed), level, endless);
  strategy(g);
  let t = 0;
  while (g.phase !== 'won' && g.phase !== 'lost' && t < 1200) {
    if (g.phase === 'ready' || g.phase === 'intermission') {
      if (g.waveIndex >= stopAfterWave) break;
      if (g.phase === 'ready') g.startWave();
    }
    for (let i = 0; i < 10; i++) g.update(0.02);
    t += 0.2;
    if (Math.round(t * 5) % 5 === 0) strategy(g);
  }
  return g;
}

const MID = [2, 1, 3, 0, 4];

function steps(kind: TowerKind, col: number, rows = MID): ReadonlyArray<readonly [TowerKind, number, number]> {
  return rows.map((r) => [kind, r, col] as const);
}

/** Level 1 sensible plan: one shooter per lane (middle first), double up, then walls and glue. */
const PLAN_L1: ReadonlyArray<readonly [TowerKind, number, number]> = [
  ...steps('shooter', 0),
  ...steps('shooter', 1),
  ...steps('wall', 4),
  ...steps('shooter', 2),
  ...steps('trap', 5),
];

/** Level 2: shooters before walls, because rollers hop walls and blobs get back up. */
const PLAN_L2: ReadonlyArray<readonly [TowerKind, number, number]> = [
  ...steps('shooter', 0),
  ...steps('shooter', 1),
  ...steps('shooter', 2),
  ...steps('trap', 6),
  ...steps('wall', 5),
  ...steps('shooter', 3),
];

/** Finish a Bastion in each listed lane before moving to the next column. */
function mergedBastions(col: number, rows = MID): ReadonlyArray<readonly [TowerKind, number, number]> {
  const out: Array<readonly [TowerKind, number, number]> = [];
  for (const row of rows) out.push(['wall', row, col], ['shooter', row, col]);
  return out;
}

/** Level 3: merge Bastions (pay Wall, then Shooter), glue slows pogos, walls soak crabs. */
const PLAN_L3: ReadonlyArray<readonly [TowerKind, number, number]> = [
  ...mergedBastions(2),
  ...steps('trap', 6),
  ...steps('wall', 4),
  ...mergedBastions(1),
  ...mergedBastions(0, [2, 1, 3]),
];

function follow(plan: ReadonlyArray<readonly [TowerKind, number, number]>): Strategy {
  return (g) => {
    for (const [kind, row, col] of plan) {
      const t = g.grid[row][col];
      if (t?.kind === kind || t?.kind === 'bastion') continue;
      const res = g.place(kind, row, col);
      if (res === 'occupied') continue;
      if (res !== 'ok') return;
    }
  };
}

const planner = follow(PLAN_L1);
const counterL2 = follow(PLAN_L2);
const counterL3 = follow(PLAN_L3);

function assertRules() {
  const g = new Game(() => 0.4, 3);
  const start = g.bricks;
  if (start !== LEVELS[3].startBricks) throw new Error(`L3 start bricks ${start}`);
  if (g.place('wall', 2, 2) !== 'ok') throw new Error('wall place');
  if (g.place('shooter', 2, 2) !== 'ok') throw new Error('merge place');
  if (g.bricks !== start - TOWERS.wall.cost - TOWERS.shooter.cost) {
    throw new Error(`merge charged ${start - g.bricks}, want wall+shooter only`);
  }
  const built = g.grid[2][2];
  if (built?.kind !== 'bastion' || built.hp !== TOWERS.bastion.hp) throw new Error('merge did not become a Bastion');
  if (g.towersBuilt !== 1 || g.bastionsBuilt !== 1) throw new Error('build counters');
  const before = g.bricks;
  if (g.place('bastion', 0, 0) !== 'blocked' || g.bricks !== before) throw new Error('Bastion must not be bought directly');
  if (g.place('trap', 2, 2) !== 'occupied') throw new Error('trap should not merge');

  const lawn = new Game(() => 0.2, 1);
  const stash = lawn.bricks;
  if (lawn.place('shooter', 0, 0) !== 'ok' || lawn.place('wall', 0, 0) !== 'ok') throw new Error('Level 1 reverse merge');
  if (lawn.grid[0][0]?.kind !== 'bastion' || lawn.bricks !== stash - 90) throw new Error('Level 1 merge cost');
  lawn.insertEnemy('blob', 0, 6);
  let shot = false;
  for (let i = 0; i < 40 && !shot; i++) {
    lawn.update(0.05);
    shot = lawn.studs.some((s) => s.row === 0) || lawn.enemies.some((e) => e.row === 0 && e.hp < e.maxHp);
  }
  if (!shot) throw new Error('merged Bastion did not shoot');

  const thrifty = campaignScore({ lives: 3, bricks: 80, wavesCleared: 5, towersBuilt: 12, bastionsBuilt: 0 });
  const mid = campaignScore({ lives: 2, bricks: 40, wavesCleared: 5, towersBuilt: 20, bastionsBuilt: 0 });
  const messy = campaignScore({ lives: 1, bricks: 0, wavesCleared: 5, towersBuilt: 30, bastionsBuilt: 4 });
  if (thrifty.stars !== 3 || mid.stars !== 2 || messy.stars !== 1) {
    throw new Error(`star bands thrifty ${thrifty.stars}/${thrifty.style} mid ${mid.stars}/${mid.style} messy ${messy.stars}/${messy.style}`);
  }
  const end = endlessScore({ lives: 0, bricks: 20, wavesCleared: 4, towersBuilt: 10, bastionsBuilt: 3 });
  console.log(
    `score samples  thrifty ${thrifty.score} (3★)  mid ${mid.score} (2★)  messy ${messy.score} (1★)  endless wave4 ${end}`,
  );
}

assertRules();

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);

function report(name: string, games: Game[]) {
  const wins = games.filter((g) => g.phase === 'won').length;
  const avgWave = games.reduce((s, g) => s + g.waveIndex + (g.phase === 'won' ? 1 : 1), 0) / games.length;
  const avgLives = games.reduce((s, g) => s + g.lives, 0) / games.length;
  console.log(`${name.padEnd(26)} wins ${String(wins).padStart(2)}/${games.length}  avg wave ${avgWave.toFixed(2)}  avg lives ${avgLives.toFixed(2)}`);
  return { wins, avgWave, avgLives };
}

console.log('— Level 1 Sunny Lawn (unchanged rules) —');
report('L1 idle', seeds.map((s) => run(idle, s, 1)));
report('L1 greedy, wave 1 only', seeds.map((s) => run(greedy, s, 1, 1)));
report('L1 greedy full game', seeds.map((s) => run(greedy, s, 1)));
const l1 = report('L1 planner full game', seeds.map((s) => run(planner, s, 1)));

const lostAt: Record<number, number> = {};
for (const s of seeds) {
  const g = run(greedy, s, 1);
  if (g.phase === 'lost') lostAt[g.waveIndex + 1] = (lostAt[g.waveIndex + 1] ?? 0) + 1;
}
console.log('L1 greedy losses by wave', lostAt);

console.log('— Level 2 Critter Powers —');
report('L2 idle', seeds.map((s) => run(idle, s, 2)));
const l2greedy = report('L2 greedy', seeds.map((s) => run(greedy, s, 2)));
report('L2 old lawn plan', seeds.map((s) => run(planner, s, 2)));
const l2 = report('L2 counter plan', seeds.map((s) => run(counterL2, s, 2)));

console.log('— Level 3 Quarry Dusk (merge Bastions) —');
report('L3 idle', seeds.map((s) => run(idle, s, 3)));
report('L3 walls+glue before bastions', seeds.map((s) => run(follow([...steps('wall', 4), ...steps('trap', 6), ...mergedBastions(2)]), s, 3)));
const l3 = report('L3 counter plan', seeds.map((s) => run(counterL3, s, 3)));

console.log('— Endless Quarry —');
const endlessGames = seeds.map((s) => run(counterL3, s, 3, 4, true));
const endlessReached = endlessGames.filter((g) => g.waveIndex >= 3).length;
console.log(`endless merge plan reached wave 4  ${endlessReached}/${endlessGames.length}`);

const notes: string[] = [];
const check = (ok: boolean, msg: string) => {
  notes.push(`${ok ? 'OK  ' : 'WARN'} ${msg}`);
};
check(l1.wins >= 58, `Level 1 planner still solves the lawn (${l1.wins}/60, lives ${l1.avgLives.toFixed(2)})`);
check(l2.wins >= 28, `Level 2 counter plan can win (${l2.wins}/60)`);
check(l2.wins <= 56 || l2.avgLives <= 2.35, `Level 2 is not a free clear (${l2.wins}/60, lives ${l2.avgLives.toFixed(2)})`);
check(l2greedy.wins < 35, `Level 2 punishes a sloppy build more than Level 1 (${l2greedy.wins}/60 vs greedy 35/60)`);
check(l3.wins >= 15, `Level 3 merge plan can win (${l3.wins}/60)`);
check(
  l3.wins < l2.wins || l3.avgLives < l2.avgLives - 0.15,
  `Level 3 is harder than Level 2 (${l3.wins}/60 lives ${l3.avgLives.toFixed(2)} vs ${l2.wins}/60 lives ${l2.avgLives.toFixed(2)})`,
);
check(endlessReached >= 50, `Endless opener reaches wave 4 (${endlessReached}/60)`);
check(LEVELS[1].tools.join() === 'wall,shooter,trap', 'Level 1 toolbar is Wall, Shooter, Trap');
check(LEVELS[2].tools.join() === 'wall,shooter,trap', 'Level 2 toolbar is Wall, Shooter, Trap');
check(LEVELS[3].tools.join() === 'wall,shooter,trap', 'Level 3 toolbar is Wall, Shooter, Trap (no Bastion button)');
check(!LEVELS[1].tools.includes('bastion') && !LEVELS[3].tools.includes('bastion'), 'Bastion is not a toolbar pick');

const l1Scores = seeds
  .map((s) => run(planner, s, 1))
  .filter((g) => g.phase === 'won')
  .map((g) =>
    campaignScore({
      lives: g.lives,
      bricks: g.bricks,
      wavesCleared: g.waveIndex + 1,
      towersBuilt: g.towersBuilt,
      bastionsBuilt: g.bastionsBuilt,
    }),
  );
if (l1Scores.length) {
  const styles = l1Scores.map((s) => s.style).sort((a, b) => a - b);
  const starCounts = [1, 2, 3].map((star) => l1Scores.filter((s) => s.stars === star).length);
  console.log(
    `L1 planner score style min ${styles[0]} median ${styles[Math.floor(styles.length / 2)]} max ${styles[styles.length - 1]}  stars ${starCounts.join('/')}`,
  );
}

console.log('— checks —');
for (const n of notes) console.log(n);
if (notes.some((n) => n.startsWith('WARN'))) {
  throw new Error('Balance checks failed. See WARN lines above.');
}
