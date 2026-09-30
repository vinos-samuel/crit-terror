// Headless balance check: `npx tsx scripts/balance.ts`
import { COLS, ROWS, TOWERS, type LevelId, type TowerKind } from '../src/config';
import { mulberry32 } from '../src/ink';
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

function run(strategy: Strategy, seed: number, level: LevelId = 1, stopAfterWave = Infinity) {
  const g = new Game(mulberry32(seed), level);
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

/** Level 3: bastions cover every lane, glue slows pogos, walls soak crabs, then a second bastion. */
const PLAN_L3: ReadonlyArray<readonly [TowerKind, number, number]> = [
  ...steps('bastion', 2),
  ...steps('trap', 6),
  ...steps('wall', 4),
  ...steps('bastion', 1),
  ...steps('bastion', 0, [2, 1, 3]),
];

function follow(plan: ReadonlyArray<readonly [TowerKind, number, number]>): Strategy {
  return (g) => {
    for (const [kind, row, col] of plan) {
      const t = g.grid[row][col];
      if (t?.kind === kind) continue;
      if (t) continue;
      if (g.place(kind, row, col) !== 'ok') return;
    }
  };
}

const planner = follow(PLAN_L1);
const counterL2 = follow(PLAN_L2);
const counterL3 = follow(PLAN_L3);

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

console.log('— Level 3 Quarry Dusk —');
report('L3 idle', seeds.map((s) => run(idle, s, 3)));
report('L3 walls-first (no bastion spam)', seeds.map((s) => run(follow([...steps('wall', 4), ...steps('trap', 6), ...steps('bastion', 2)]), s, 3)));
const l3 = report('L3 counter plan', seeds.map((s) => run(counterL3, s, 3)));

const notes: string[] = [];
const check = (ok: boolean, msg: string) => {
  notes.push(`${ok ? 'OK  ' : 'WARN'} ${msg}`);
};
check(l1.wins >= 58, `Level 1 planner still solves the lawn (${l1.wins}/60, lives ${l1.avgLives.toFixed(2)})`);
check(l2.wins >= 28, `Level 2 counter plan can win (${l2.wins}/60)`);
check(l2.wins <= 56 || l2.avgLives <= 2.35, `Level 2 is not a free clear (${l2.wins}/60, lives ${l2.avgLives.toFixed(2)})`);
check(l2greedy.wins < 35, `Level 2 punishes a sloppy build more than Level 1 (${l2greedy.wins}/60 vs greedy 35/60)`);
check(l3.wins >= 15, `Level 3 counter plan can win (${l3.wins}/60)`);
check(
  l3.wins < l2.wins || l3.avgLives < l2.avgLives - 0.2,
  `Level 3 is harder than Level 2 (${l3.wins}/60 lives ${l3.avgLives.toFixed(2)} vs ${l2.wins}/60 lives ${l2.avgLives.toFixed(2)})`,
);
console.log('— checks —');
for (const n of notes) console.log(n);
if (notes.some((n) => n.startsWith('WARN'))) {
  throw new Error('Balance checks failed. See WARN lines above.');
}
