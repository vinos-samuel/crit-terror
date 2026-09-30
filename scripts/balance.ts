// Headless balance check: `npx tsx scripts/balance.ts`
import { COLS, ROWS, TOWERS } from '../src/config';
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

function run(strategy: Strategy, seed: number, stopAfterWave = Infinity) {
  const g = new Game(mulberry32(seed));
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

/** A sensible plan: one shooter per lane (middle first), double up, then walls and glue. Saves for the next step. */
const PLAN: ReadonlyArray<readonly [kind: 'shooter' | 'wall' | 'trap', row: number, col: number]> = [
  ...[2, 1, 3, 0, 4].map((r) => ['shooter', r, 0] as const),
  ...[2, 1, 3, 0, 4].map((r) => ['shooter', r, 1] as const),
  ...[2, 1, 3, 0, 4].map((r) => ['wall', r, 4] as const),
  ...[2, 1, 3, 0, 4].map((r) => ['shooter', r, 2] as const),
  ...[2, 1, 3, 0, 4].map((r) => ['trap', r, 5] as const),
];
const planner: Strategy = (g) => {
  for (const [kind, row, col] of PLAN) {
    const t = g.grid[row][col];
    if (t?.kind === kind) continue;
    if (t) continue;
    if (g.place(kind, row, col) !== 'ok') return;
  }
};

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
const report = (name: string, games: Game[]) => {
  const wins = games.filter((g) => g.phase === 'won').length;
  const avgWave = games.reduce((s, g) => s + g.waveIndex + 1, 0) / games.length;
  const avgLives = games.reduce((s, g) => s + g.lives, 0) / games.length;
  console.log(`${name.padEnd(22)} wins ${wins}/${games.length}  avg wave ${avgWave.toFixed(2)}  avg lives ${avgLives.toFixed(2)}`);
};

report('idle', seeds.map((s) => run(idle, s)));
report('greedy, wave 1 only', seeds.map((s) => run(greedy, s, 1)));
report('greedy full game', seeds.map((s) => run(greedy, s)));
report('planner full game', seeds.map((s) => run(planner, s)));

const lostAt: Record<number, number> = {};
for (const s of seeds) {
  const g = run(greedy, s);
  if (g.phase === 'lost') lostAt[g.waveIndex + 1] = (lostAt[g.waveIndex + 1] ?? 0) + 1;
}
console.log('greedy losses by wave', lostAt);
