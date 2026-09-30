import '@fontsource/luckiest-guy/400.css';
import '@fontsource/patrick-hand/400.css';
import './style.css';
import { LEVELS, LEVEL_IDS, MERGE_CUE, TOWERS, nextLevelId, type LevelId, type TowerKind } from './config';
import { mulberry32 } from './ink';
import { cellAt, hit } from './layout';
import { overlayExtra, overlayLayout, Renderer, titleLayout, type Effect, type ViewState } from './render';
import {
  campaignScore,
  endlessScore,
  isLevelUnlocked,
  loadRecords,
  recordEndless,
  recordLevel,
  type RunOutcome,
} from './score';
import { Game, makeShowcase, type GameEvent } from './sim';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new Renderer(canvas);

const view: ViewState = {
  screen: 'title',
  game: new Game(),
  paused: false,
  selected: null,
  hover: null,
  hoverUi: null,
  effects: [],
  toast: null,
  shakeT: 0,
  denyTool: null,
  time: 0,
  hold: false,
  records: loadRecords(),
  outcome: null,
  freezeFx: false,
  reveal: null,
};

function newGame(level?: LevelId, endless?: boolean) {
  const end = endless ?? (level === undefined && view.game.endless);
  const id: LevelId = end ? 3 : (level ?? view.game.levelId);
  view.game = new Game(Math.random, id, end);
  view.paused = false;
  view.selected = null;
  view.effects = [];
  view.toast = null;
  view.shakeT = 0;
  view.hold = false;
  view.outcome = null;
  view.freezeFx = false;
  view.reveal = null;
  view.screen = 'play';
  renderer.setTheme(view.game.theme);
}

function toast(text: string, dur = 1.6) {
  view.toast = { text, t: 0, dur };
}

function addEffect(fx: Omit<Effect, 't'>) {
  view.effects.push({ ...fx, t: 0 });
}

function selectTool(kind: TowerKind) {
  view.selected = view.selected === kind ? null : kind;
  if (view.selected && view.game.bricks < TOWERS[kind].cost) {
    view.denyTool = { kind, t: 0.4 };
    toast(`Need ${TOWERS[kind].cost - view.game.bricks} more bricks`);
  }
}

function tryPlace(row: number, col: number) {
  const g = view.game;
  const kind = view.selected;
  if (!kind) {
    const tw = g.grid[row][col];
    toast(tw ? `That's a ${TOWERS[tw.kind].label}!` : 'Pick a tower from the toolbar first');
    return;
  }
  const res = g.place(kind, row, col);
  if (res === 'occupied') toast('That spot is taken');
  else if (res === 'bricks') {
    view.denyTool = { kind, t: 0.4 };
    toast(`Need ${TOWERS[kind].cost - g.bricks} more bricks`);
  }
}

function startWave() {
  const g = view.game;
  if (g.phase === 'ready' || g.phase === 'intermission') g.startWave();
}

function handleEvents(events: GameEvent[]) {
  const L = renderer.L;
  const laneY = (row: number) => L.lawn.y + (row + 0.55) * L.cellH;
  const size = Math.min(L.cellW, L.cellH);
  for (const e of events) {
    switch (e.type) {
      case 'hit':
        if (e.missile && e.shell) {
          addEffect({
            kind: 'word',
            text: 'CRACK!',
            x: L.lawn.x + e.x * L.cellW,
            y: laneY(e.row) - size * 0.55,
            dur: 0.7,
            size: size * 0.38,
            rot: -0.08,
            color: '#ffb15a',
          });
          addEffect({
            kind: 'pop',
            x: L.lawn.x + e.x * L.cellW,
            y: laneY(e.row) - size * 0.1,
            dur: 0.34,
            size: size * 0.42,
          });
        } else {
          addEffect({
            kind: 'pop',
            x: L.lawn.x + (e.x - 0.15) * L.cellW,
            y: laneY(e.row) - size * 0.05,
            dur: e.missile ? 0.16 : 0.22,
            size: size * (e.missile ? 0.1 : 0.16),
            gray: e.armored || e.missile,
          });
        }
        break;
      case 'kill':
        addEffect({
          kind: 'word',
          text: 'POP!',
          x: L.lawn.x + e.x * L.cellW,
          y: laneY(e.row) - size * 0.2,
          dur: 0.7,
          size: size * 0.3,
          rot: (Math.random() - 0.5) * 0.4,
          color:
            e.kind === 'beetle'
              ? '#cbb8f0'
              : e.kind === 'roller'
                ? '#fde99a'
                : e.kind === 'pogo'
                  ? '#ffc2a1'
                  : e.kind === 'crab'
                    ? '#f4a19a'
                    : e.kind === 'wisp'
                      ? '#d5e4f2'
                      : e.kind === 'skitter'
                        ? '#8ea0e0'
                        : e.kind === 'moth'
                          ? '#f7c6de'
                          : '#c8ec9f',
        });
        addEffect({
          kind: 'float',
          text: `+${e.reward}`,
          x: L.lawn.x + e.x * L.cellW,
          y: laneY(e.row) - size * 0.6,
          dur: 1,
          size: size * 0.26,
        });
        break;
      case 'leak':
        view.shakeT = 0.45;
        addEffect({
          kind: 'word',
          text: 'OUCH!',
          x: L.fortress.x + Math.max(L.fortress.w * 0.5, 60),
          y: laneY(e.row),
          dur: 1.1,
          size: 40,
          rot: -0.15,
          color: '#f4a19a',
        });
        toast(view.game.lives > 0 ? `A critter got in! ${view.game.lives} ${view.game.lives === 1 ? 'life' : 'lives'} left` : 'The fort has fallen!');
        break;
      case 'place':
        addEffect({
          kind: 'puff',
          x: L.lawn.x + (e.col + 0.5) * L.cellW,
          y: L.lawn.y + (e.row + 0.88) * L.cellH,
          dur: 0.45,
          size: size * 0.4,
        });
        addEffect({
          kind: 'word',
          text: 'SNAP!',
          x: L.lawn.x + (e.col + 0.5) * L.cellW,
          y: L.lawn.y + (e.row + 0.05) * L.cellH,
          dur: 0.5,
          size: size * 0.17,
          rot: (Math.random() - 0.5) * 0.3,
          color: '#ffffff',
        });
        break;
      case 'merge': {
        const mx = L.lawn.x + (e.col + 0.5) * L.cellW;
        const my = L.lawn.y + (e.row + 0.38) * L.cellH;
        const gap = Math.max(124, size * 1.5);
        const [top, bottom] = MERGE_CUE[e.into];
        const colors: Record<typeof e.into, [string, string]> = {
          bastion: ['#fff3a6', '#ffd7a8'],
          missiler: ['#ffb15a', '#fff3a6'],
          sticky: ['#f8d55a', '#fff6c2'],
          twin: ['#a3c2f5', '#fff3a6'],
        };
        addEffect({
          kind: 'puff',
          x: mx,
          y: L.lawn.y + (e.row + 0.88) * L.cellH,
          dur: 0.55,
          size: size * 0.62,
        });
        addEffect({
          kind: 'word',
          text: top,
          x: mx,
          y: my,
          dur: 1.7,
          size: size * 0.42,
          rot: 0.05,
          color: colors[e.into][0],
        });
        addEffect({
          kind: 'word',
          text: bottom,
          x: mx,
          y: my - gap,
          dur: 1.85,
          size: size * 0.32,
          rot: -0.06,
          color: colors[e.into][1],
        });
        break;
      }
      case 'crunch':
        addEffect({
          kind: 'word',
          text: 'CRUNCH!',
          x: L.lawn.x + (e.col + 0.5) * L.cellW,
          y: L.lawn.y + (e.row + 0.4) * L.cellH,
          dur: 0.9,
          size: size * 0.28,
          rot: 0.12,
          color: '#f4a19a',
        });
        break;
      case 'revive':
        addEffect({
          kind: 'word',
          text: 'AGAIN!',
          x: L.lawn.x + e.x * L.cellW,
          y: laneY(e.row) - size * 0.35,
          dur: 0.8,
          size: size * 0.28,
          rot: -0.08,
          color: '#c8ec9f',
        });
        break;
      case 'hop':
        addEffect({
          kind: 'word',
          text: e.kind === 'pogo' ? 'BOING!' : 'HOP!',
          x: L.lawn.x + e.x * L.cellW,
          y: laneY(e.row) - size * 0.85,
          dur: 0.55,
          size: size * 0.22,
          rot: 0.08,
          color: e.kind === 'pogo' ? '#ffc2a1' : '#fde99a',
        });
        break;
      case 'shrug':
        addEffect({
          kind: 'word',
          text: 'NOPE!',
          x: L.lawn.x + e.x * L.cellW,
          y: laneY(e.row) - size * 0.7,
          dur: 0.6,
          size: size * 0.22,
          rot: -0.1,
          color: '#f8d55a',
        });
        break;
      case 'waveStart':
        if (e.wave === 0 && view.game.endless) toast('Endless! Every critter can show up. How far can you go?');
        else if (e.wave === 0 && view.game.levelId > 1) toast(view.game.level.intro);
        addEffect({
          kind: 'word',
          text: !view.game.endless && e.wave === view.game.totalWaves - 1 ? 'FINAL WAVE!' : `WAVE ${e.wave + 1}!`,
          x: L.lawn.x + L.lawn.w / 2,
          y: L.lawn.y + L.lawn.h / 2,
          dur: 1.6,
          size: L.portrait ? 64 : 76,
          rot: -0.06,
          color: '#fde99a',
        });
        break;
      case 'waveClear':
        addEffect({
          kind: 'word',
          text: 'WAVE CLEAR!',
          x: L.lawn.x + L.lawn.w / 2,
          y: L.lawn.y + L.lawn.h / 2 - 30,
          dur: 1.8,
          size: L.portrait ? 56 : 68,
          rot: 0.05,
          color: '#c8ec9f',
        });
        addEffect({
          kind: 'float',
          text: `+${e.bonus}`,
          x: L.lawn.x + L.lawn.w / 2,
          y: L.lawn.y + L.lawn.h / 2 + 50,
          dur: 1.6,
          size: 40,
        });
        break;
      case 'bricks':
        addEffect({
          kind: 'float',
          text: `+${e.amount}`,
          x: L.bricksPill.x + L.bricksPill.w * 0.62,
          y: L.bricksPill.y + L.bricksPill.h + 26,
          dur: 0.9,
          size: 22,
        });
        break;
    }
  }
}

// ---------- input ----------

function commitOutcome() {
  if (view.outcome) return;
  const g = view.game;
  if (g.endless) {
    if (g.phase !== 'lost') return;
    const score = endlessScore({
      lives: g.lives,
      bricks: g.bricks,
      wavesCleared: g.waveIndex,
      towersBuilt: g.towersBuilt,
      bastionsBuilt: g.bastionsBuilt,
    });
    const wave = g.waveIndex + 1;
    const rec = recordEndless(view.records, wave, score);
    view.records = rec.records;
    view.outcome = {
      score,
      stars: 0,
      wave,
      bestScore: rec.best.score,
      bestStars: 0,
      bestWave: rec.best.wave,
      newScore: rec.newScore,
      newWave: rec.newWave,
    } satisfies RunOutcome;
    return;
  }
  if (g.phase !== 'won') return;
  const scored = campaignScore({
    lives: g.lives,
    bricks: g.bricks,
    wavesCleared: g.waveIndex + 1,
    towersBuilt: g.towersBuilt,
    bastionsBuilt: g.bastionsBuilt,
  });
  const rec = recordLevel(view.records, g.levelId, scored.score, scored.stars);
  view.records = rec.records;
  if (rec.revealed) view.reveal = rec.revealed;
  view.outcome = {
    score: scored.score,
    stars: scored.stars,
    wave: g.waveIndex + 1,
    bestScore: rec.best.score,
    bestStars: rec.best.stars,
    bestWave: 0,
    newScore: rec.isNew,
    newWave: false,
    revealed: rec.revealed,
  };
}

function uiTargetAt(x: number, y: number): string | null {
  const L = renderer.L;
  if (view.screen === 'title') {
    const title = titleLayout(L);
    if (hit(title.endless, x, y, 6)) return 'endless';
    for (let i = 0; i < title.levels.length; i++) if (hit(title.levels[i], x, y, 6)) return `level${LEVEL_IDS[i]}`;
    return null;
  }
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost' || view.paused) {
    const kind = g.phase === 'won' || g.phase === 'lost' ? g.phase : 'pause';
    for (const b of overlayLayout(L, kind, overlayExtra(g)).buttons) if (hit(b.rect, x, y, 6)) return b.id;
    return null;
  }
  if (hit(L.pauseBtn, x, y, 6)) return 'pause';
  if (hit(L.startBtn, x, y, 6)) return 'start';
  for (const k of g.toolOrder) if (hit(L.tools[k], x, y, 8)) return k;
  return null;
}

function onPointerDown(ev: PointerEvent) {
  ev.preventDefault();
  const { x, y } = renderer.toDesign(ev.clientX, ev.clientY);
  const target = uiTargetAt(x, y);
  switch (target) {
    case 'endless':
      newGame(3, true);
      return;
    case 'next': {
      const next = nextLevelId(view.game.levelId);
      if (next) newGame(next);
      return;
    }
    case 'restart':
      newGame();
      return;
    case 'menu':
      view.screen = 'title';
      view.paused = false;
      return;
    case 'resume':
    case 'pause':
      view.paused = !view.paused;
      return;
    case 'start':
      startWave();
      return;
    default:
      if (target?.startsWith('level')) {
        const id = Number(target.slice(5)) as LevelId;
        if (isLevelUnlocked(view.records, id)) newGame(id);
        return;
      }
      if (target && (view.game.toolOrder as readonly string[]).includes(target)) {
        selectTool(target as TowerKind);
        return;
      }
  }
  if (view.screen !== 'play' || view.paused) return;
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost') return;
  const cell = cellAt(renderer.L, x, y);
  if (cell) {
    view.hover = ev.pointerType === 'mouse' ? cell : null;
    tryPlace(cell.row, cell.col);
  }
}

function onPointerMove(ev: PointerEvent) {
  const { x, y } = renderer.toDesign(ev.clientX, ev.clientY);
  if (ev.pointerType !== 'mouse') return;
  view.hoverUi = uiTargetAt(x, y);
  view.hover = view.screen === 'play' ? cellAt(renderer.L, x, y) : null;
  canvas.style.cursor = view.hoverUi || (view.hover && view.selected) ? 'pointer' : 'default';
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerleave', () => {
  view.hover = null;
  view.hoverUi = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (view.screen === 'title') {
    if (e.key === 'Enter') newGame(1);
    else if (e.key >= '1' && e.key <= '6') {
      const id = Number(e.key) as LevelId;
      if (isLevelUnlocked(view.records, id)) newGame(id);
    } else if (e.key === '7') newGame(3, true);
    return;
  }
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost') {
    if (e.key === 'n' || e.key === 'N') {
      const next = nextLevelId(g.levelId);
      if (g.phase === 'won' && !g.endless && next) newGame(next);
      else if (g.phase === 'won' && !g.endless) newGame(3, true);
      return;
    }
    if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') newGame();
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    view.paused = !view.paused;
    return;
  }
  if (view.paused) return;
  const tools = g.toolOrder;
  if (e.key === '1' && tools[0]) selectTool(tools[0]);
  else if (e.key === '2' && tools[1]) selectTool(tools[1]);
  else if (e.key === '3' && tools[2]) selectTool(tools[2]);
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    startWave();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && view.screen === 'play') {
    const p = view.game.phase;
    if (p !== 'won' && p !== 'lost') view.paused = true;
  }
});

// ---------- loop ----------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  view.time += dt;
  if (view.screen === 'play' && !view.paused && !view.hold) {
    view.game.update(dt);
    handleEvents(view.game.drainEvents());
    commitOutcome();
  }
  if (!view.freezeFx) {
    for (const fx of view.effects) fx.t += dt;
    view.effects = view.effects.filter((fx) => fx.t < fx.dur);
  }
  if (view.toast) {
    view.toast.t += dt;
    if (view.toast.t >= view.toast.dur) view.toast = null;
  }
  view.shakeT = Math.max(0, view.shakeT - dt);
  if (view.denyTool) {
    view.denyTool.t -= dt;
    if (view.denyTool.t <= 0) view.denyTool = null;
  }
  renderer.render(view);
  requestAnimationFrame(frame);
}

let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => renderer.resize());
});

/** Dev-only fast campaign, used by `?shot=win` to reach the real win screen. */
function rushCampaign(level: LevelId, rng: () => number) {
  const g = new Game(rng, level);
  const rows = [2, 1, 3, 0, 4];
  const plan: Array<readonly [TowerKind, number, number]> = [];
  for (const col of [0, 1]) for (const row of rows) plan.push(['shooter', row, col]);
  for (const row of rows) plan.push(['wall', row, 4]);
  for (const row of rows) plan.push(['trap', row, 6]);
  let t = 0;
  while (g.phase !== 'won' && g.phase !== 'lost' && t < 900) {
    if (g.phase === 'ready' || g.phase === 'intermission') {
      for (const [kind, row, col] of plan) {
        if (g.grid[row][col]) continue;
        if (g.place(kind, row, col) !== 'ok') break;
      }
      if (g.phase === 'ready') g.startWave();
    }
    for (let i = 0; i < 8; i++) g.update(0.05);
    t += 0.4;
  }
  g.drainEvents();
  return g;
}

async function boot() {
  const fontsReady = Promise.all([
    document.fonts.load('40px "Luckiest Guy"'),
    document.fonts.load('24px "Patrick Hand"'),
  ]).catch(() => undefined);
  await Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]);
  renderer.resize();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot === '2' || shot === '3' || shot === '4' || shot === '5' || shot === '6') {
    const level = Number(shot) as 2 | 3 | 4 | 5 | 6;
    view.game = makeShowcase(level);
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    renderer.setTheme(LEVELS[level].theme);
  } else if (import.meta.env.DEV && shot === 'merge') {
    const g = new Game(mulberry32(3), 3);
    g.place('shooter', 1, 1);
    g.place('wall', 2, 4);
    g.place('shooter', 2, 4);
    g.place('trap', 3, 6);
    g.insertEnemy('pogo', 2, 7.1, { age: 0.5 });
    g.drainEvents();
    view.game = g;
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    view.selected = 'shooter';
    renderer.setTheme('quarry');
    handleEvents([{ type: 'merge', row: 2, col: 4, paid: 50, into: 'bastion' }]);
    for (const fx of view.effects) fx.t = Math.min(0.28, fx.dur * 0.22);
    view.freezeFx = true;
  } else if (import.meta.env.DEV && shot === 'missiler') {
    const g = new Game(mulberry32(6), 6);
    g.place('wall', 0, 4);
    g.place('trap', 2, 2);
    g.place('shooter', 2, 2);
    g.place('shooter', 1, 1);
    g.insertEnemy('moth', 2, 5.6, { age: 1.2, hp: 48 });
    g.insertEnemy('moth', 1, 7.4, { age: 0.6 });
    g.insertEnemy('moth', 0, 6.2, { age: 0.9 });
    g.insertEnemy('beetle', 3, 6.8, { age: 1 });
    g.studs.push({ id: 9101, row: 2, x: 4.1, missile: true });
    g.drainEvents();
    view.game = g;
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    view.selected = 'trap';
    renderer.setTheme('sky');
    handleEvents([
      { type: 'merge', row: 2, col: 2, paid: 50, into: 'missiler' },
      { type: 'hit', row: 2, x: 5.6, armored: false, missile: true, shell: true },
    ]);
    for (const fx of view.effects) fx.t = Math.min(0.22, fx.dur * 0.18);
    view.freezeFx = true;
  } else if (import.meta.env.DEV && shot === 'merges') {
    const g = new Game(mulberry32(9), 2);
    g.bricks = 800;
    g.place('wall', 1, 2);
    g.place('trap', 1, 2);
    g.place('shooter', 2, 4);
    g.place('shooter', 2, 4);
    g.place('trap', 3, 3);
    g.place('shooter', 3, 3);
    g.insertEnemy('blob', 1, 3.4, { age: 1.2, slowT: 0.8 });
    g.insertEnemy('roller', 2, 6.2, { age: 0.7 });
    g.insertEnemy('beetle', 3, 5.5, { age: 1.4 });
    g.drainEvents();
    view.game = g;
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    renderer.setTheme('lawn');
    handleEvents([
      { type: 'merge', row: 1, col: 2, paid: 30, into: 'sticky' },
      { type: 'merge', row: 2, col: 4, paid: 50, into: 'twin' },
      { type: 'merge', row: 3, col: 3, paid: 50, into: 'missiler' },
    ]);
    for (const fx of view.effects) fx.t = Math.min(0.24, fx.dur * 0.2);
    view.freezeFx = true;
  } else if (import.meta.env.DEV && shot === 'unlock') {
    view.records = {
      levels: {
        1: { score: 2140, stars: 2 },
        2: { score: 2480, stars: 2 },
        3: { score: 2710, stars: 2 },
      },
      unlockedLevel: 4,
      critters: ['blob', 'beetle', 'roller', 'pogo', 'crab', 'wisp'],
    };
    view.reveal = 'wisp';
    view.screen = 'title';
  } else if (import.meta.env.DEV && shot === 'winreveal') {
    const g = new Game(mulberry32(4), 3);
    g.phase = 'won';
    g.lives = 2;
    g.bricks = 90;
    g.waveIndex = LEVELS[3].waves.length - 1;
    view.game = g;
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    view.records = {
      levels: {
        1: { score: 2140, stars: 2 },
        2: { score: 2480, stars: 2 },
        3: { score: 2710, stars: 2 },
      },
      unlockedLevel: 4,
      critters: ['blob', 'beetle', 'roller', 'pogo', 'crab', 'wisp'],
    };
    view.reveal = 'wisp';
    view.outcome = {
      score: 2710,
      stars: 2,
      wave: 6,
      bestScore: 2710,
      bestStars: 2,
      bestWave: 0,
      newScore: true,
      newWave: false,
      revealed: 'wisp',
    };
    renderer.setTheme('quarry');
  } else if (import.meta.env.DEV && shot === 'win') {
    view.game = rushCampaign(1, mulberry32(4));
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    renderer.setTheme(view.game.theme);
    commitOutcome();
  } else if (import.meta.env.DEV && shot === 'endless') {
    newGame(3, true);
    view.hold = true;
  }
  document.body.classList.add('ready');
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

if (import.meta.env.DEV) Object.assign(window, { __brick: { view, renderer } });

boot();
