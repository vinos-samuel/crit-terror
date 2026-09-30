import { ellipsePts, hatch, INK, line, mulberry32, rectPts, shape, type Pt, type Rng } from './ink';

export const PAL = {
  red: '#ec6f5f',
  redTop: '#f59a8b',
  redSide: '#c9564a',
  blue: '#6e9ce8',
  blueTop: '#a3c2f5',
  blueSide: '#4d78c6',
  yellow: '#f8d55a',
  yellowHi: '#fde99a',
  green: '#9fd46c',
  greenDark: '#6bab48',
  purple: '#a68bdb',
  purpleDark: '#7b5fc0',
  purpleHi: '#cbb8f0',
  gray: '#a2a09b',
  grayDark: '#66635f',
  white: '#fffdf7',
  pink: '#f4a4a4',
  mouth: '#b8434a',
};

export type SpriteName =
  | 'wall0'
  | 'wall1'
  | 'wall2'
  | 'shooter'
  | 'trap'
  | 'blob'
  | 'beetleA'
  | 'beetleB'
  | 'rollerBody'
  | 'rollerWheel'
  | 'brickIcon'
  | 'heart'
  | 'heartEmpty'
  | 'flag'
  | 'stud';

export const BOIL_FRAMES = 3;

type Drawer = (ctx: CanvasRenderingContext2D, rng: Rng) => void;

const cache = new Map<string, HTMLCanvasElement>();

export function clearSpriteCache() {
  cache.clear();
}

/** Returns a cached bitmap of a sprite rendered at `px` device pixels square. */
export function sprite(name: SpriteName, px: number, frame = 0): HTMLCanvasElement {
  const size = Math.max(8, Math.round(px));
  const key = `${name}:${frame}:${size}`;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.scale(size / 100, size / 100);
    DRAWERS[name](ctx, mulberry32(hash(name) + frame * 7919));
    cache.set(key, c);
  }
  return c;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function eye(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number, lookX = 0, lookY = 0, pupil = 0.5) {
  shape(ctx, ellipsePts(x, y, r, r * 1.1, 14), rng, { fill: PAL.white, lw: 2.4, amp: 0.8, sketch: false });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + lookX * r * 0.4, y + lookY * r * 0.4, r * pupil, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.beginPath();
  ctx.arc(x + lookX * r * 0.4 - r * 0.18, y + lookY * r * 0.4 - r * 0.2, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function stud(ctx: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, rx: number, top: string, side: string) {
  const h = rx * 0.55;
  const body: Pt[] = [
    { x: cx - rx, y: cy },
    { x: cx - rx, y: cy + h },
    ...ellipsePts(cx, cy + h, rx, rx * 0.42, 12).filter((p) => p.y >= cy + h - 0.01).sort((a, b) => a.x - b.x),
    { x: cx + rx, y: cy + h },
    { x: cx + rx, y: cy },
  ];
  shape(ctx, body, rng, { fill: side, lw: 2, amp: 0.6, sketch: false, step: 6 });
  shape(ctx, ellipsePts(cx, cy, rx, rx * 0.42, 12), rng, { fill: top, lw: 2, amp: 0.6, sketch: false, step: 6 });
}

function brickBlock(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  colors: { front: string; top: string; side: string },
  studs: number,
) {
  const d = depth;
  const top: Pt[] = [
    { x, y },
    { x: x + d, y: y - d * 0.8 },
    { x: x + w + d, y: y - d * 0.8 },
    { x: x + w, y },
  ];
  const side: Pt[] = [
    { x: x + w, y },
    { x: x + w + d, y: y - d * 0.8 },
    { x: x + w + d, y: y + h - d * 0.8 },
    { x: x + w, y: y + h },
  ];
  const front = rectPts(x, y, w, h);
  shape(ctx, side, rng, { fill: colors.side, lw: 2.6, sketch: false });
  hatch(ctx, side, rng, INK, 4, 1, 0.3);
  shape(ctx, top, rng, { fill: colors.top, lw: 2.6, sketch: false });
  shape(ctx, front, rng, { fill: colors.front, lw: 3.2 });
  if (studs > 0) {
    const spacing = w / studs;
    for (let i = 0; i < studs; i++) {
      const sx = x + spacing * (i + 0.5) + d * 0.5;
      stud(ctx, rng, sx, y - d * 0.4 - 3, Math.min(spacing * 0.32, 6), colors.top, colors.front);
    }
  }
}

function mortar(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, rows: number) {
  const rh = h / rows;
  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let r = 1; r < rows; r++) {
    line(ctx, [{ x: x + 2, y: y + r * rh }, { x: x + w - 2, y: y + r * rh }], rng, 1.6);
  }
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? w / 3 : w / 6;
    for (let bx = x + off; bx < x + w - 3; bx += w / 3) {
      line(ctx, [{ x: bx, y: y + r * rh + 1 }, { x: bx, y: y + (r + 1) * rh - 1 }], rng, 1.6);
    }
  }
  ctx.restore();
}

function crack(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, len: number) {
  const pts: Pt[] = [{ x, y }];
  let cx = x;
  let cy = y;
  for (let i = 0; i < 4; i++) {
    cx += (rng() - 0.3) * len * 0.4;
    cy += len * 0.25;
    pts.push({ x: cx, y: cy });
  }
  line(ctx, pts, rng, 1.8, INK, 0.6);
}

function drawWall(damage: number): Drawer {
  return (ctx, rng) => {
    ground(ctx, rng, 50, 88, 40);
    const x = 10,
      y = 34,
      w = 74,
      h = 52;
    brickBlock(ctx, rng, x, y, w, h, 9, { front: PAL.red, top: PAL.redTop, side: PAL.redSide }, 4);
    mortar(ctx, rng, x, y, w, h, 3);
    if (damage >= 1) {
      crack(ctx, rng, 22, 36, 30);
      crack(ctx, rng, 70, 56, 26);
    }
    if (damage >= 2) {
      crack(ctx, rng, 46, 36, 44);
      crack(ctx, rng, 14, 64, 20);
    }
    const worried = damage >= 2;
    eye(ctx, rng, 36, 56, 8, -0.4, worried ? -0.5 : 0, worried ? 0.35 : 0.5);
    eye(ctx, rng, 58, 56, 8, -0.4, worried ? -0.5 : 0, worried ? 0.35 : 0.5);
    if (worried) {
      line(ctx, [{ x: 28, y: 44 }, { x: 42, y: 47 }], rng, 2.4);
      line(ctx, [{ x: 66, y: 44 }, { x: 52, y: 47 }], rng, 2.4);
    }
  };
}

function ground(ctx: CanvasRenderingContext2D, _rng: Rng, cx: number, cy: number, rx: number) {
  ctx.fillStyle = 'rgba(40,50,30,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

const drawShooter: Drawer = (ctx, rng) => {
  ground(ctx, rng, 48, 89, 40);
  brickBlock(ctx, rng, 10, 58, 64, 30, 8, { front: PAL.blue, top: PAL.blueTop, side: PAL.blueSide }, 4);
  // barrel sits behind the upper block so the muzzle reads clearly
  const barrel = rectPts(52, 36, 34, 16, 3);
  shape(ctx, barrel, rng, { fill: PAL.gray, lw: 3 });
  hatch(ctx, rectPts(52, 45, 34, 7), rng, INK, 4, 1, 0.35);
  shape(ctx, rectPts(80, 33, 10, 22, 3), rng, { fill: PAL.grayDark, lw: 3 });
  shape(ctx, ellipsePts(90, 44, 3.5, 8, 12), rng, { fill: INK, lw: 2, sketch: false });
  brickBlock(ctx, rng, 20, 30, 36, 28, 7, { front: PAL.blue, top: PAL.blueTop, side: PAL.blueSide }, 2);
  line(ctx, [{ x: 22, y: 44 }, { x: 54, y: 44 }], rng, 1.4, INK);
  ctx.save();
  ctx.globalAlpha = 0.7;
  line(ctx, [{ x: 30, y: 73 }, { x: 72, y: 73 }], rng, 1.4, INK);
  ctx.restore();
  eye(ctx, rng, 31, 49, 4.6, 0.6, 0, 0.55);
  eye(ctx, rng, 44, 49, 4.6, 0.6, 0, 0.55);
};

const drawTrap: Drawer = (ctx, rng) => {
  const splat = ellipsePts(50, 72, 44, 20, 26, rng, 0.35);
  shape(ctx, splat, rng, { fill: PAL.yellow, lw: 3 });
  ctx.save();
  const inner = ellipsePts(50, 73, 30, 11, 20);
  ctx.beginPath();
  inner.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = INK;
  for (let x = 6; x < 100; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 90);
    ctx.lineTo(x + 8, 90);
    ctx.lineTo(x + 26, 56);
    ctx.lineTo(x + 18, 56);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  shape(ctx, inner, rng, { stroke: INK, lw: 2, sketch: false });
  shape(ctx, ellipsePts(34, 62, 8, 3, 10), rng, { fill: PAL.yellowHi, stroke: 'none' });
  for (const [dx, dy, r] of [
    [8, 58, 4],
    [94, 64, 3.5],
    [88, 86, 3],
    [14, 88, 3],
    [60, 50, 3],
  ]) {
    shape(ctx, ellipsePts(dx, dy, r, r * 0.8, 10), rng, { fill: PAL.yellow, lw: 2, sketch: false, amp: 0.6 });
  }
};

const drawBlob: Drawer = (ctx, rng) => {
  ground(ctx, rng, 50, 90, 36);
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    pts.push({ x: 50 + Math.cos(a) * 40, y: 80 + Math.sin(a) * 52 * (0.95 + rng() * 0.1) });
  }
  pts.push({ x: 92, y: 86 }, { x: 78, y: 90 }, { x: 64, y: 86 }, { x: 50, y: 90 }, { x: 36, y: 86 }, { x: 22, y: 90 }, { x: 8, y: 86 });
  shape(ctx, pts, rng, { fill: PAL.green, lw: 3.4 });
  hatch(ctx, pts.filter((p) => p.x > 60), rng, PAL.greenDark, 5, 1.4, 0.5);
  for (const [sx, sy, r] of [
    [24, 58, 5],
    [70, 44, 6],
    [78, 66, 4.5],
    [40, 34, 4],
    [58, 76, 4],
    [20, 76, 3.5],
  ]) {
    shape(ctx, ellipsePts(sx, sy, r, r * 0.85, 10, rng, 0.3), rng, { fill: PAL.greenDark, lw: 1.4, sketch: false, amp: 0.5 });
  }
  shape(ctx, ellipsePts(34, 42, 7, 4, 10), rng, { fill: 'rgba(255,255,255,0.6)', stroke: 'none' });
  eye(ctx, rng, 38, 54, 7.5, -0.5, 0, 0.5);
  eye(ctx, rng, 58, 54, 7.5, -0.5, 0, 0.5);
  const mouth: Pt[] = [
    { x: 38, y: 66 },
    { x: 58, y: 66 },
    { x: 55, y: 74 },
    { x: 48, y: 77 },
    { x: 41, y: 74 },
  ];
  shape(ctx, mouth, rng, { fill: PAL.mouth, lw: 2.4, sketch: false, step: 6 });
  shape(ctx, ellipsePts(48, 74, 5, 2.4, 10), rng, { fill: PAL.pink, stroke: 'none' });
  ctx.fillStyle = 'rgba(244,120,120,0.5)';
  ctx.beginPath();
  ctx.ellipse(26, 64, 5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(70, 64, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
};

function drawBeetle(step: number): Drawer {
  return (ctx, rng) => {
    ground(ctx, rng, 52, 90, 40);
    const legX = [36, 54, 72];
    legX.forEach((lx, i) => {
      const swing = (i % 2 === step ? 1 : -1) * 5;
      line(
        ctx,
        [
          { x: lx, y: 66 },
          { x: lx - 4 + swing * 0.5, y: 78 },
          { x: lx - 8 + swing, y: 88 },
        ],
        rng,
        3.4,
        INK,
      );
      line(
        ctx,
        [
          { x: lx - 8 + swing, y: 88 },
          { x: lx - 13 + swing, y: 89 },
        ],
        rng,
        3,
        INK,
      );
    });
    const body = ellipsePts(58, 56, 34, 22, 26);
    shape(ctx, body, rng, { fill: PAL.purple, lw: 3.4 });
    hatch(ctx, ellipsePts(58, 66, 32, 12, 20), rng, INK, 4.5, 1.1, 0.3);
    for (const sx of [44, 58, 72]) {
      line(
        ctx,
        [
          { x: sx - 3, y: 36 },
          { x: sx + 2, y: 56 },
          { x: sx - 2, y: 76 },
        ],
        rng,
        2.4,
        INK,
      );
    }
    line(ctx, [{ x: 28, y: 52 }, { x: 58, y: 50 }, { x: 90, y: 54 }], rng, 2.2, INK);
    shape(ctx, ellipsePts(52, 42, 10, 4, 12), rng, { fill: PAL.purpleHi, stroke: 'none' });
    const horn: Pt[] = [
      { x: 22, y: 50 },
      { x: 12, y: 40 },
      { x: 8, y: 26 },
      { x: 16, y: 36 },
      { x: 28, y: 46 },
    ];
    shape(ctx, horn, rng, { fill: PAL.purpleHi, lw: 2.6, sketch: false, step: 6 });
    const head = ellipsePts(24, 62, 14, 13, 18);
    shape(ctx, head, rng, { fill: PAL.purpleDark, lw: 3.2 });
    eye(ctx, rng, 20, 59, 5.4, -0.6, 0.2, 0.55);
    line(ctx, [{ x: 13, y: 51 }, { x: 27, y: 55 }], rng, 3);
    line(ctx, [{ x: 12, y: 70 }, { x: 4, y: 76 }], rng, 2.6);
    line(ctx, [{ x: 18, y: 73 }, { x: 12, y: 82 }], rng, 2.6);
  };
}

const drawRollerBody: Drawer = (ctx, rng) => {
  for (const [y, w] of [
    [30, 12],
    [44, 16],
    [58, 10],
  ]) {
    line(ctx, [{ x: 84, y }, { x: 84 + w, y: y + 1 }], rng, 2, INK);
  }
  const fin: Pt[] = [
    { x: 64, y: 40 },
    { x: 84, y: 26 },
    { x: 80, y: 44 },
    { x: 88, y: 54 },
    { x: 66, y: 54 },
  ];
  shape(ctx, fin, rng, { fill: PAL.yellow, lw: 2.8, sketch: false, step: 6 });
  const body = ellipsePts(46, 46, 28, 25, 24);
  shape(ctx, body, rng, { fill: PAL.yellow, lw: 3.4 });
  hatch(ctx, ellipsePts(52, 58, 22, 12, 16), rng, '#b98a1c', 4.5, 1.2, 0.5);
  shape(ctx, ellipsePts(38, 30, 8, 4, 10), rng, { fill: PAL.yellowHi, stroke: 'none' });
  eye(ctx, rng, 32, 38, 7, -0.6, 0, 0.5);
  eye(ctx, rng, 48, 36, 7.5, -0.6, 0, 0.5);
  const mouth: Pt[] = [
    { x: 22, y: 52 },
    { x: 46, y: 54 },
    { x: 40, y: 64 },
    { x: 28, y: 62 },
  ];
  shape(ctx, mouth, rng, { fill: PAL.mouth, lw: 2.4, sketch: false, step: 6 });
  ctx.fillStyle = PAL.white;
  for (const [tx, ty] of [
    [26, 53],
    [32, 53.5],
    [38, 54],
  ]) {
    ctx.beginPath();
    ctx.moveTo(tx - 2.5, ty);
    ctx.lineTo(tx + 2.5, ty);
    ctx.lineTo(tx, ty + 4.5);
    ctx.closePath();
    ctx.fill();
  }
  line(ctx, [{ x: 18, y: 58 }, { x: 8, y: 54 }, { x: 4, y: 60 }], rng, 2.6);
};

const drawRollerWheel: Drawer = (ctx, rng) => {
  shape(ctx, ellipsePts(50, 50, 46, 46, 28), rng, { fill: '#6f6c68', lw: 5 });
  hatch(ctx, ellipsePts(50, 50, 44, 44, 20), rng, INK, 7, 1.6, 0.25);
  shape(ctx, ellipsePts(50, 50, 28, 28, 22), rng, { fill: PAL.yellow, lw: 4 });
  shape(ctx, ellipsePts(50, 50, 12, 12, 14), rng, { fill: '#d9a92a', lw: 3.4 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  line(ctx, [{ x: 50, y: 6 }, { x: 50, y: 20 }], rng, 5, PAL.yellow, 0.4);
};

const drawBrickIcon: Drawer = (ctx, rng) => {
  brickBlock(ctx, rng, 10, 44, 66, 38, 14, { front: PAL.red, top: PAL.redTop, side: PAL.redSide }, 3);
  mortar(ctx, rng, 10, 44, 66, 38, 2);
};

function heartPts(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: 50 + x * 2.6, y: 48 - y * 2.6 });
  }
  return pts;
}

const drawHeart: Drawer = (ctx, rng) => {
  shape(ctx, heartPts(), rng, { fill: '#f0666e', lw: 5, step: 8 });
  shape(ctx, ellipsePts(34, 34, 8, 5, 10), rng, { fill: 'rgba(255,255,255,0.65)', stroke: 'none' });
};

const drawHeartEmpty: Drawer = (ctx, rng) => {
  shape(ctx, heartPts(), rng, { fill: '#5a5652', lw: 5, step: 8, stroke: '#1d1b19' });
};

const drawFlag: Drawer = (ctx, rng) => {
  line(ctx, [{ x: 22, y: 90 }, { x: 22, y: 10 }], rng, 6, PAL.white, 0.6);
  const flag: Pt[] = [
    { x: 24, y: 12 },
    { x: 50, y: 20 },
    { x: 86, y: 12 },
    { x: 74, y: 32 },
    { x: 88, y: 52 },
    { x: 52, y: 46 },
    { x: 24, y: 52 },
  ];
  shape(ctx, flag, rng, { fill: PAL.white, stroke: PAL.white, lw: 3, sketch: false, step: 8 });
};

const drawStud: Drawer = (ctx, rng) => {
  shape(ctx, ellipsePts(50, 50, 40, 40, 20), rng, { fill: '#4f86e8', lw: 8, sketch: false });
  shape(ctx, ellipsePts(38, 36, 13, 9, 12), rng, { fill: 'rgba(255,255,255,0.75)', stroke: 'none' });
};

const DRAWERS: Record<SpriteName, Drawer> = {
  wall0: drawWall(0),
  wall1: drawWall(1),
  wall2: drawWall(2),
  shooter: drawShooter,
  trap: drawTrap,
  blob: drawBlob,
  beetleA: drawBeetle(0),
  beetleB: drawBeetle(1),
  rollerBody: drawRollerBody,
  rollerWheel: drawRollerWheel,
  brickIcon: drawBrickIcon,
  heart: drawHeart,
  heartEmpty: drawHeartEmpty,
  flag: drawFlag,
  stud: drawStud,
};
