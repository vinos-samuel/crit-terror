import '@fontsource/luckiest-guy/400.css';
import '@fontsource/patrick-hand/400.css';
import './style.css';
import { TOOL_ORDER, TOWERS, type TowerKind } from './config';
import { cellAt, hit } from './layout';
import { overlayLayout, Renderer, titleLayout, type Effect, type ViewState } from './render';
import { Game, type GameEvent } from './sim';

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
};

function newGame() {
  view.game = new Game();
  view.paused = false;
  view.selected = null;
  view.effects = [];
  view.toast = null;
  view.shakeT = 0;
  view.screen = 'play';
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
          color: e.kind === 'beetle' ? '#cbb8f0' : e.kind === 'roller' ? '#fde99a' : '#c8ec9f',
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
      case 'waveStart':
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
  if (view.screen === 'title') return hit(titleLayout(L).play, x, y, 6) ? 'play' : null;
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost' || view.paused) {
    const kind = g.phase === 'won' || g.phase === 'lost' ? g.phase : 'pause';
    for (const b of overlayLayout(L, kind).buttons) if (hit(b.rect, x, y, 6)) return b.id;
    return null;
  }
  if (hit(L.pauseBtn, x, y, 6)) return 'pause';
  if (hit(L.startBtn, x, y, 6)) return 'start';
  for (const k of TOOL_ORDER) if (hit(L.tools[k], x, y, 8)) return k;
  return null;
}

function onPointerDown(ev: PointerEvent) {
  ev.preventDefault();
  const { x, y } = renderer.toDesign(ev.clientX, ev.clientY);
  const target = uiTargetAt(x, y);
  switch (target) {
    case 'play':
    case 'restart':
      newGame();
      return;
    case 'menu':
      view.screen = 'title';
      return;
    case 'resume':
    case 'pause':
      view.paused = !view.paused;
      return;
    case 'start':
      startWave();
      return;
    case 'wall':
    case 'shooter':
    case 'trap':
      selectTool(target);
      return;
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
    if (e.key === 'Enter' || e.key === ' ') newGame();
    return;
  }
  const g = view.game;
  if (g.phase === 'won' || g.phase === 'lost') {
    if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') newGame();
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    view.paused = !view.paused;
    return;
  }
  if (view.paused) return;
  if (e.key === '1') selectTool('wall');
  else if (e.key === '2') selectTool('shooter');
  else if (e.key === '3') selectTool('trap');
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
  if (view.screen === 'play' && !view.paused) {
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
  document.body.classList.add('ready');
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

if (import.meta.env.DEV) Object.assign(window, { __brick: { view, renderer } });

boot();
