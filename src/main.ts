import '@fontsource/luckiest-guy/400.css';
import '@fontsource/patrick-hand/400.css';
import './style.css';
import { LEVELS, TOWERS, type LevelId, type TowerKind } from './config';
import { cellAt, hit } from './layout';
import { overlayLayout, Renderer, titleLayout, type Effect, type ViewState } from './render';
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
};

function newGame(level: LevelId = view.game.levelId) {
  view.game = new Game(Math.random, level);
  view.paused = false;
  view.selected = null;
  view.effects = [];
  view.toast = null;
  view.shakeT = 0;
  view.hold = false;
  view.screen = 'play';
  renderer.setTheme(view.game.theme);
}

function toast(text: string) {
  view.toast = { text, t: 0, dur: 1.6 };
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
        addEffect({
          kind: 'pop',
          x: L.lawn.x + (e.x - 0.15) * L.cellW,
          y: laneY(e.row) - size * 0.05,
          dur: 0.22,
          size: size * 0.16,
          gray: e.armored,
        });
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
          color: e.kind === 'beetle' ? '#cbb8f0' : e.kind === 'roller' ? '#fde99a' : e.kind === 'pogo' ? '#ffc2a1' : e.kind === 'crab' ? '#f4a19a' : '#c8ec9f',
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
        if (e.wave === 0 && view.game.levelId > 1) toast(view.game.level.intro);
        addEffect({
          kind: 'word',
          text: e.wave === view.game.totalWaves - 1 ? 'FINAL WAVE!' : `WAVE ${e.wave + 1}!`,
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

function uiTargetAt(x: number, y: number): string | null {
  const L = renderer.L;
  if (view.screen === 'title') {
    const levels = titleLayout(L).levels;
    for (let i = 0; i < levels.length; i++) if (hit(levels[i], x, y, 6)) return `level${i + 1}`;
    return null;
  }
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost' || view.paused) {
    const kind = g.phase === 'won' || g.phase === 'lost' ? g.phase : 'pause';
    const offerNext = kind === 'won' && g.levelId < 3;
    for (const b of overlayLayout(L, kind, offerNext).buttons) if (hit(b.rect, x, y, 6)) return b.id;
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
    case 'level1':
      newGame(1);
      return;
    case 'level2':
      newGame(2);
      return;
    case 'level3':
      newGame(3);
      return;
    case 'next':
      newGame((view.game.levelId + 1) as LevelId);
      return;
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
    if (e.key === '1' || e.key === 'Enter') newGame(1);
    else if (e.key === '2') newGame(2);
    else if (e.key === '3') newGame(3);
    return;
  }
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost') {
    if (e.key === 'n' || e.key === 'N') {
      if (g.phase === 'won' && g.levelId < 3) newGame((g.levelId + 1) as LevelId);
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
  }
  for (const fx of view.effects) fx.t += dt;
  view.effects = view.effects.filter((fx) => fx.t < fx.dur);
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

async function boot() {
  const fontsReady = Promise.all([
    document.fonts.load('40px "Luckiest Guy"'),
    document.fonts.load('24px "Patrick Hand"'),
  ]).catch(() => undefined);
  await Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]);
  renderer.resize();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot === '2' || shot === '3') {
    const level = shot === '2' ? 2 : 3;
    view.game = makeShowcase(level);
    view.screen = 'play';
    view.hold = true;
    view.paused = false;
    renderer.setTheme(LEVELS[level].theme);
  }
  document.body.classList.add('ready');
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

if (import.meta.env.DEV) Object.assign(window, { __brick: { view, renderer } });

boot();
