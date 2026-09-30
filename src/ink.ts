export const INK = '#2a2622';
export const PAPER = '#f4efe3';

export type Rng = () => number;
export interface Pt {
  x: number;
  y: number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function jitter(pts: Pt[], closed: boolean, rng: Rng, amp: number, step = 12): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push({
        x: a.x + (b.x - a.x) * t + (rng() - 0.5) * amp,
        y: a.y + (b.y - a.y) * t + (rng() - 0.5) * amp,
      });
    }
  }
  if (!closed) {
    const last = pts[n - 1];
    out.push({ x: last.x + (rng() - 0.5) * amp * 0.5, y: last.y + (rng() - 0.5) * amp * 0.5 });
  }
  return out;
}

export function trace(ctx: CanvasRenderingContext2D, pts: Pt[], closed: boolean) {
  ctx.beginPath();
  const n = pts.length;
  if (n < 2) return;
  if (closed) {
    const m0 = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const m = mid(p, pts[(i + 1) % n]);
      ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function rectPts(x: number, y: number, w: number, h: number, r = 0): Pt[] {
  if (r <= 0) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  r = Math.min(r, w / 2, h / 2);
  const pts: Pt[] = [];
  const corners = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }
  return pts;
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 20, rng?: Rng, lumpy = 0): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = rng && lumpy ? 1 + (rng() - 0.5) * lumpy : 1;
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return pts;
}

export interface ShapeOpts {
  fill?: string | CanvasGradient | CanvasPattern;
  stroke?: string;
  lw?: number;
  amp?: number;
  closed?: boolean;
  sketch?: boolean;
  step?: number;
}

/** Fill + inked outline with a slightly misregistered second pencil pass, comic style. */
export function shape(ctx: CanvasRenderingContext2D, pts: Pt[], rng: Rng, o: ShapeOpts = {}) {
  const closed = o.closed ?? true;
  const amp = o.amp ?? 1.6;
  const step = o.step ?? 12;
  const lw = o.lw ?? 3.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.fill && closed) {
    trace(ctx, jitter(pts, true, rng, amp * 0.6, step), true);
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke !== 'none') {
    ctx.strokeStyle = o.stroke ?? INK;
    ctx.lineWidth = lw;
    trace(ctx, jitter(pts, closed, rng, amp, step), closed);
    ctx.stroke();
    if (o.sketch ?? true) {
      ctx.globalAlpha *= 0.45;
      ctx.lineWidth = Math.max(0.8, lw * 0.35);
      trace(ctx, jitter(pts, closed, rng, amp * 2.2, step), closed);
      ctx.stroke();
      ctx.globalAlpha /= 0.45;
    }
  }
}

export function line(ctx: CanvasRenderingContext2D, pts: Pt[], rng: Rng, lw = 2.5, color = INK, amp = 1.4) {
  shape(ctx, pts, rng, { closed: false, lw, stroke: color, amp, sketch: false, step: 10 });
}

/** Diagonal pencil hatching clipped to a region — comic shading. */
export function hatch(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  rng: Rng,
  color: string,
  spacing = 6,
  lw = 1.2,
  alpha = 0.35,
) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  ctx.save();
  trace(ctx, pts, true);
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  const h = maxY - minY;
  for (let x = minX - h; x < maxX; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + (rng() - 0.5) * 2, maxY + 2);
    ctx.lineTo(x + h + (rng() - 0.5) * 2, minY - 2);
    ctx.stroke();
  }
  ctx.restore();
}

export interface TextOpts {
  size: number;
  fill?: string;
  outline?: string;
  lw?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  font?: 'display' | 'hand';
  shadow?: boolean;
  rotate?: number;
  maxWidth?: number;
}

export const DISPLAY_FONT = '"Luckiest Guy", "Comic Sans MS", system-ui, sans-serif';
export const HAND_FONT = '"Patrick Hand", "Comic Sans MS", system-ui, sans-serif';

export function inkText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts) {
  ctx.save();
  ctx.translate(x, y);
  if (o.rotate) ctx.rotate(o.rotate);
  const family = o.font === 'hand' ? HAND_FONT : DISPLAY_FONT;
  ctx.font = `${o.size}px ${family}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  const lw = o.lw ?? (o.outline === 'none' ? 0 : Math.max(2, o.size * 0.16));
  const dy = o.font === 'hand' ? 0 : o.size * 0.06;
  if (o.shadow ?? o.font !== 'hand') {
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    if (lw) ctx.strokeText(text, 2, dy + o.size * 0.07, o.maxWidth);
    ctx.fillText(text, 2, dy + o.size * 0.07, o.maxWidth);
  }
  if (lw && o.outline !== 'none') {
    ctx.strokeStyle = o.outline ?? INK;
    ctx.lineWidth = lw;
    ctx.strokeText(text, 0, dy, o.maxWidth);
  }
  ctx.fillStyle = o.fill ?? '#fff';
  ctx.fillText(text, 0, dy, o.maxWidth);
  ctx.restore();
}

export function starburstPts(cx: number, cy: number, r1: number, r2: number, spikes: number, rng: Rng, squash = 1): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = (i % 2 === 0 ? r1 : r2) * (0.85 + rng() * 0.3);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * squash });
  }
  return pts;
}
