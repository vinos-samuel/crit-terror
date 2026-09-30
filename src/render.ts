import { COLS, ENEMIES, GAME_TITLE, ROWS, TOOL_ORDER, TOWERS, type TowerKind } from './config';
import {
  ellipsePts,
  hatch,
  HAND_FONT,
  INK,
  inkText,
  line,
  mulberry32,
  PAPER,
  rectPts,
  shape,
  starburstPts,
  type Pt,
  type Rng,
} from './ink';
import { pickLayout, type Layout, type Rect } from './layout';
import type { Enemy, Game, Tower } from './sim';
import { BOIL_FRAMES, clearSpriteCache, PAL, sprite, type SpriteName } from './sprites';

export type Screen = 'title' | 'play';

export interface Effect {
  kind: 'word' | 'float' | 'pop' | 'puff';
  x: number;
  y: number;
  t: number;
  dur: number;
  text?: string;
  color?: string;
  size?: number;
  rot?: number;
  gray?: boolean;
}

export interface ViewState {
  screen: Screen;
  game: Game;
  paused: boolean;
  selected: TowerKind | null;
  hover: { row: number; col: number } | null;
  hoverUi: string | null;
  effects: Effect[];
  toast: { text: string; t: number; dur: number } | null;
  shakeT: number;
  denyTool: { kind: TowerKind; t: number } | null;
  time: number;
}

export interface UiButton {
  id: string;
  label: string;
  color: string;
  rect: Rect;
}

const LAWN_A = '#97d267';
const LAWN_B = '#87c65a';
const DARK_PILL = '#3a3835';
const GREEN_BTN = '#86d06b';

export function titleLayout(L: Layout) {
  if (L.portrait) {
    const oy = (L.H - 1180) / 2;
    const pw = 330;
    const ph = 236;
    const panels: Rect[] = [];
    for (let i = 0; i < 6; i++) {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      panels.push({ x: 20 + col * (pw + 20), y: oy + 236 + row * (ph + 18), w: pw, h: ph });
    }
    return {
      banner: { x: 40, y: oy + 40, w: 640, h: 118 },
      subtitle: { x: 360, y: oy + 190 },
      panels,
      play: { x: 190, y: oy + 1006, w: 340, h: 116 },
      footer: { x: 360, y: oy + 1150 },
    };
  }
  const pw = 384;
  const ph = 178;
  const panels: Rect[] = [];
  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    panels.push({ x: 40 + col * (pw + 24), y: 168 + row * (ph + 18), w: pw, h: ph });
  }
  return {
    banner: { x: 290, y: 16, w: 700, h: 110 },
    subtitle: { x: 640, y: 144 },
    panels,
    play: { x: 490, y: 566, w: 300, h: 104 },
    footer: { x: 640, y: 698 },
  };
}

export function overlayLayout(L: Layout, kind: 'pause' | 'won' | 'lost') {
  const pw = 640;
  const ph = L.portrait ? 560 : 460;
  const panel: Rect = { x: (L.W - pw) / 2, y: (L.H - ph) / 2, w: pw, h: ph };
  const bw = 262;
  const bh = 96;
  const by = panel.y + ph - bh - 32;
  const left: Rect = { x: panel.x + pw / 2 - bw - 14, y: by, w: bw, h: bh };
  const right: Rect = { x: panel.x + pw / 2 + 14, y: by, w: bw, h: bh };
  const buttons: UiButton[] =
    kind === 'pause'
      ? [
          { id: 'resume', label: 'Resume', color: GREEN_BTN, rect: left },
          { id: 'restart', label: 'Restart', color: PAL.red, rect: right },
        ]
      : [
          { id: 'restart', label: kind === 'won' ? 'Play Again' : 'Try Again', color: PAL.blue, rect: left },
          { id: 'menu', label: 'Menu', color: PAL.yellow, rect: right },
        ];
  return { panel, buttons };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  L: Layout = pickLayout(1280, 720);
  dpr = 1;
  cssW = 1280;
  cssH = 720;
  scale = 1;
  offX = 0;
  offY = 0;
  private paperLayer = document.createElement('canvas');
  private fieldLayer = document.createElement('canvas');

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.L = pickLayout(this.cssW, this.cssH);
    this.scale = Math.min(this.cssW / this.L.W, this.cssH / this.L.H);
    this.offX = (this.cssW - this.L.W * this.scale) / 2;
    this.offY = (this.cssH - this.L.H * this.scale) / 2;
    clearSpriteCache();
    this.buildStatic();
  }

  toDesign(clientX: number, clientY: number) {
    const b = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - b.left - this.offX) / this.scale,
      y: (clientY - b.top - this.offY) / this.scale,
    };
  }

  /** Device pixels for a length in design units. */
  private px(n: number) {
    return n * this.scale * this.dpr;
  }

  private designTransform(ctx: CanvasRenderingContext2D, sx = 0, sy = 0) {
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, this.dpr * (this.offX + sx * this.scale), this.dpr * (this.offY + sy * this.scale));
  }

  private buildStatic() {
    for (const layer of [this.paperLayer, this.fieldLayer]) {
      layer.width = this.canvas.width;
      layer.height = this.canvas.height;
    }
    const pctx = this.paperLayer.getContext('2d')!;
    drawPaper(pctx, this.paperLayer.width, this.paperLayer.height, this.dpr, mulberry32(7));

    const fctx = this.fieldLayer.getContext('2d')!;
    fctx.drawImage(this.paperLayer, 0, 0);
    this.designTransform(fctx);
    const L = this.L;
    drawFortress(fctx, L, mulberry32(11));
    drawLawn(fctx, L, mulberry32(21));
    drawRift(fctx, L, mulberry32(31));
    this.drawBanner(fctx, L.banner, mulberry32(41));
  }

  render(v: ViewState) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (v.screen === 'title') {
      ctx.drawImage(this.paperLayer, 0, 0);
      this.designTransform(ctx);
      this.drawTitle(v);
      return;
    }
    let sx = 0;
    let sy = 0;
    if (v.shakeT > 0) {
      const k = v.shakeT * 18;
      sx = (Math.random() - 0.5) * k;
      sy = (Math.random() - 0.5) * k;
    }
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.fieldLayer, sx * this.scale * this.dpr, sy * this.scale * this.dpr);
    this.designTransform(ctx, sx, sy);
    this.drawScene(v);
    this.designTransform(ctx);
    this.drawHud(v);
    this.drawToolbar(v);
    this.drawEffects(v, true);
    this.drawToast(v);
    const g = v.game;
    if (g.phase === 'won' || g.phase === 'lost') this.drawOverlay(v, g.phase);
    else if (v.paused) this.drawOverlay(v, 'pause');
  }

  // ---------- scene ----------

  private boil(t: number) {
    return Math.floor(t * 5) % BOIL_FRAMES;
  }

  private drawSprite(
    name: SpriteName,
    cx: number,
    bottom: number,
    size: number,
    frame: number,
    o: { sx?: number; sy?: number; rot?: number; alpha?: number } = {},
  ) {
    const ctx = this.ctx;
    const img = sprite(name, this.px(size), frame);
    ctx.save();
    ctx.translate(cx, bottom);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx ?? 1, o.sy ?? 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.drawImage(img, -size / 2, -size * 0.9, size, size);
    ctx.restore();
  }

  private drawRoller(cx: number, bottom: number, size: number, frame: number, spin: number, alpha = 1) {
    this.drawSprite('rollerBody', cx, bottom, size, frame, { alpha });
    const ctx = this.ctx;
    const wheel = size * 0.44;
    const wx = cx + size * 0.12;
    const wy = bottom - size * 0.2;
    const img = sprite('rollerWheel', this.px(wheel), frame);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(wx, wy);
    ctx.rotate(spin);
    ctx.drawImage(img, -wheel / 2, -wheel / 2, wheel, wheel);
    ctx.restore();
  }

  private cellBottom(row: number) {
    return this.L.lawn.y + (row + 1) * this.L.cellH - this.L.cellH * 0.1;
  }

  private unitSize() {
    return Math.min(this.L.cellW * 1.2, this.L.cellH * 1.22);
  }

  private drawScene(v: ViewState) {
    const ctx = this.ctx;
    const L = this.L;
    const g = v.game;
    const t = v.time;
    const frame = this.boil(t);

    this.drawRiftArrows(t);

    if (v.selected && g.phase !== 'won' && g.phase !== 'lost') {
      ctx.save();
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -t * 20;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2.5;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (g.grid[r][c]) continue;
          ctx.strokeRect(L.lawn.x + c * L.cellW + 7, L.lawn.y + r * L.cellH + 7, L.cellW - 14, L.cellH - 14);
        }
      ctx.restore();
    }

    if (v.hover && v.selected && !v.paused) {
      const { row, col } = v.hover;
      const check = g.canPlace(v.selected, row, col);
      const x = L.lawn.x + col * L.cellW;
      const y = L.lawn.y + row * L.cellH;
      ctx.save();
      ctx.fillStyle = check === 'ok' ? 'rgba(255,255,255,0.35)' : 'rgba(236,90,80,0.35)';
      ctx.fillRect(x + 3, y + 3, L.cellW - 6, L.cellH - 6);
      ctx.restore();
      if (check === 'ok') {
        this.drawTowerSprite(v.selected, x + L.cellW / 2, this.cellBottom(row), this.unitSize(), frame, 0, 0.55);
      }
    }

    const size = this.unitSize();
    for (const tw of g.towers()) {
      if (tw.kind === 'trap') this.drawTower(tw, size, frame);
    }
    for (let r = 0; r < ROWS; r++) {
      for (const e of g.enemies) if (e.row === r && e.slowT > 0) this.drawGoo(e, size);
      for (let c = 0; c < COLS; c++) {
        const tw = g.grid[r][c];
        if (tw && tw.kind !== 'trap') this.drawTower(tw, size, frame);
      }
      const inRow = g.enemies.filter((e) => e.row === r).sort((a, b) => b.x - a.x);
      for (const e of inRow) this.drawEnemy(e, size, frame);
    }

    for (const s of g.studs) {
      const sx = L.lawn.x + s.x * L.cellW;
      const sy = this.cellBottom(s.row) - size * 0.46;
      const d = size * 0.2;
      ctx.save();
      ctx.globalAlpha = 0.5;
      line(ctx, [{ x: sx - d * 2.2, y: sy }, { x: sx - d * 0.8, y: sy }], mulberry32(s.id), 2, INK, 0.5);
      ctx.restore();
      ctx.drawImage(sprite('stud', this.px(d), 0), sx - d / 2, sy - d / 2, d, d);
    }

    this.drawEffects(v, false);
  }

  private drawTowerSprite(kind: TowerKind, cx: number, bottom: number, size: number, frame: number, hpRatio: number, alpha?: number) {
    let name: SpriteName = kind === 'wall' ? 'wall0' : kind;
    if (kind === 'wall') name = hpRatio < 0.34 ? 'wall2' : hpRatio < 0.67 ? 'wall1' : 'wall0';
    const o = alpha === undefined ? {} : { alpha };
    if (kind === 'trap') this.drawSprite(name, cx, bottom + size * 0.06, size * 0.96, frame, o);
    else this.drawSprite(name, cx, bottom, size, frame, o);
  }

  private drawTower(tw: Tower, size: number, frame: number) {
    const L = this.L;
    let cx = L.lawn.x + (tw.col + 0.5) * L.cellW;
    const bottom = this.cellBottom(tw.row);
    const ratio = tw.hp / tw.maxHp;
    if (tw.hitT > 0) cx += Math.sin(tw.placedT * 70) * 1.8;
    if (tw.kind === 'shooter') cx -= tw.recoil * 4;
    const pop = tw.placedT < 0.3 ? 1 + Math.sin((tw.placedT / 0.3) * Math.PI) * 0.18 : 1;
    this.ctx.save();
    this.ctx.translate(cx, bottom);
    this.ctx.scale(pop, 2 - pop);
    this.drawTowerSprite(tw.kind, 0, 0, size, frame, ratio);
    this.ctx.restore();
    if (tw.kind === 'shooter' && tw.recoil > 0.6) {
      const mx = cx + size * 0.44;
      const my = bottom - size * 0.46;
      shape(this.ctx, starburstPts(mx, my, size * 0.12, size * 0.05, 6, mulberry32(tw.id + frame)), mulberry32(3), {
        fill: '#fff7c2',
        lw: 2,
        sketch: false,
      });
    }
    if (tw.kind !== 'trap' && ratio < 1) this.hpBar(cx, bottom - size * 0.9, size * 0.6, ratio);
  }

  private drawGoo(e: Enemy, size: number) {
    const L = this.L;
    const cx = L.lawn.x + e.x * L.cellW;
    const by = this.cellBottom(e.row);
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, e.slowT / 0.4);
    shape(this.ctx, ellipsePts(cx, by - 2, size * 0.34, size * 0.08, 14), mulberry32(e.id), {
      fill: PAL.yellow,
      lw: 2,
      sketch: false,
    });
    this.ctx.restore();
  }

  private drawEnemy(e: Enemy, size: number, frame: number) {
    const L = this.L;
    const stats = ENEMIES[e.kind];
    let cx = L.lawn.x + e.x * L.cellW;
    let bottom = this.cellBottom(e.row);
    const slow = e.slowT > 0 ? 0.45 : 1;
    const a = e.age * slow;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    if (e.hitT > 0) {
      cx += (e.hitT / 0.18) * 4;
      sx = 1.08;
      sy = 0.92;
    }
    const alpha = e.x > COLS + 0.1 ? Math.max(0.35, 1 - (e.x - COLS - 0.1) * 2) : 1;
    if (e.kind === 'blob') {
      const hop = Math.abs(Math.sin(a * 5 + e.id));
      bottom -= e.eating ? 0 : hop * size * 0.08;
      const squash = e.eating ? Math.sin(a * 12) * 0.06 : (1 - hop) * 0.12;
      sx *= 1 + squash;
      sy *= 1 - squash;
      this.drawSprite('blob', cx, bottom, size * 0.86, frame, { sx, sy, alpha });
    } else if (e.kind === 'beetle') {
      if (e.eating) rot = Math.sin(a * 10) * 0.06;
      const step = Math.floor(a * 6) % 2 === 0 ? 'beetleA' : 'beetleB';
      this.drawSprite(e.eating ? 'beetleA' : step, cx, bottom, size * 1.02, frame, { sx, sy, rot, alpha });
    } else {
      const spinR = size * 0.22;
      const spin = (cx - L.lawn.x) / spinR;
      if (!e.eating) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.35 * alpha;
        line(this.ctx, [{ x: cx + size * 0.45, y: bottom - size * 0.1 }, { x: cx + size * 0.75, y: bottom - size * 0.1 }], mulberry32(e.id + frame), 2);
        line(this.ctx, [{ x: cx + size * 0.4, y: bottom - size * 0.3 }, { x: cx + size * 0.62, y: bottom - size * 0.3 }], mulberry32(e.id + frame + 1), 2);
        this.ctx.restore();
      }
      const bob = e.eating ? Math.sin(a * 14) * 2 : Math.sin(a * 20) * 1.2;
      this.drawRoller(cx, bottom + bob, size * 0.9, frame, spin, alpha);
    }
    const barH = e.kind === 'blob' ? 0.72 : e.kind === 'beetle' ? 0.8 : 0.78;
    if (e.hp < stats.hp) this.hpBar(cx, bottom - size * barH, size * 0.5, e.hp / e.maxHp);
  }

  private hpBar(cx: number, y: number, w: number, ratio: number) {
    const ctx = this.ctx;
    const h = 7;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 - 2, y - 2, w + 4, h + 4, 5);
    ctx.fill();
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(cx - w / 2, y, w, h);
    ctx.fillStyle = ratio > 0.6 ? '#7fd05b' : ratio > 0.3 ? '#f5c745' : '#ee6358';
    ctx.fillRect(cx - w / 2, y, w * Math.max(0, ratio), h);
    ctx.restore();
  }

  private drawRiftArrows(t: number) {
    const ctx = this.ctx;
    const L = this.L;
    for (let r = 0; r < ROWS; r++) {
      const y = L.lawn.y + (r + 0.5) * L.cellH;
      const wob = Math.sin(t * 3 + r * 1.3) * 5;
      const tail = L.rift.x + L.rift.w * (L.portrait ? 0.95 : 0.6);
      const head = L.rift.x - (L.portrait ? 8 : 16) + wob;
      const rng = mulberry32(900 + r);
      const pts: Pt[] = [
        { x: tail, y: y + 3 },
        { x: (tail + head) / 2, y: y - 1 },
        { x: head + 10, y },
      ];
      line(ctx, pts, rng, 9, INK, 1);
      line(ctx, pts, rng, 4.5, '#9a6ee6', 0.8);
      shape(
        ctx,
        [
          { x: head, y },
          { x: head + 18, y: y - 10 },
          { x: head + 15, y },
          { x: head + 18, y: y + 10 },
        ],
        rng,
        { fill: '#9a6ee6', lw: 2.6, sketch: false, step: 6 },
      );
    }
  }

  // ---------- static art ----------

  private drawBanner(ctx: CanvasRenderingContext2D, b: Rect, rng: Rng) {
    const iconSize = b.h * 0.78;
    const stripX = b.x + iconSize * 0.95;
    const strip: Rect = { x: stripX, y: b.y + b.h * 0.5, w: b.x + b.w - stripX, h: b.h * 0.44 };
    shape(ctx, rectPts(strip.x + 5, strip.y + 5, strip.w, strip.h, 4), rng, { fill: INK, stroke: 'none' });
    shape(ctx, rectPts(strip.x, strip.y, strip.w, strip.h, 3), rng, { fill: PAL.red, lw: 3.4 });
    ctx.save();
    ctx.globalAlpha = 0.75;
    const rows = 2;
    const rh = strip.h / rows;
    line(ctx, [{ x: strip.x + 3, y: strip.y + rh }, { x: strip.x + strip.w - 3, y: strip.y + rh }], rng, 2);
    const bw = strip.h * 1.05;
    for (let r = 0; r < rows; r++) {
      for (let x = strip.x + (r % 2 ? bw / 2 : bw); x < strip.x + strip.w - 4; x += bw) {
        line(ctx, [{ x, y: strip.y + r * rh + 2 }, { x, y: strip.y + (r + 1) * rh - 2 }], rng, 2);
      }
    }
    ctx.restore();
    const icon = sprite('brickIcon', this.px(iconSize), 0);
    ctx.drawImage(icon, b.x, b.y + b.h * 0.14, iconSize, iconSize);
    for (const [x1, y1, x2, y2] of [
      [b.x + iconSize * 0.2, b.y + b.h * 0.18, b.x + iconSize * 0.05, b.y + b.h * 0.05],
      [b.x + iconSize * 0.5, b.y + b.h * 0.12, b.x + iconSize * 0.5, b.y - b.h * 0.02],
      [b.x + b.w - 20, b.y + b.h * 0.2, b.x + b.w - 4, b.y + b.h * 0.06],
      [b.x + b.w - 10, b.y + b.h * 0.34, b.x + b.w + 8, b.y + b.h * 0.3],
    ]) {
      line(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], rng, 3);
    }
    inkText(ctx, GAME_TITLE, strip.x + strip.w / 2, b.y + b.h * 0.5, {
      size: b.h * 0.6,
      fill: '#fffdf7',
      lw: b.h * 0.1,
      maxWidth: strip.w * 0.96,
    });
  }

  // ---------- HUD ----------

  private pill(r: Rect, seed: number, fill = DARK_PILL) {
    const ctx = this.ctx;
    const rng = mulberry32(seed);
    shape(ctx, rectPts(r.x + 4, r.y + 5, r.w, r.h, 16), rng, { fill: 'rgba(42,38,34,0.35)', stroke: 'none' });
    shape(ctx, rectPts(r.x, r.y, r.w, r.h, 16), rng, { fill, lw: 3.6 });
    ctx.save();
    ctx.globalAlpha = 0.25;
    shape(ctx, rectPts(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 11), rng, { stroke: '#fff', lw: 1.6, sketch: false });
    ctx.restore();
  }

  private drawHud(v: ViewState) {
    const L = this.L;
    const g = v.game;
    const frame = this.boil(v.time);

    this.pill(L.livesPill, 101);
    const hs = Math.min(L.livesPill.h * 0.62, (L.livesPill.w - 20) / 3);
    for (let i = 0; i < 3; i++) {
      const name: SpriteName = i < g.lives ? 'heart' : 'heartEmpty';
      const img = sprite(name, this.px(hs), frame);
      const x = L.livesPill.x + L.livesPill.w / 2 + (i - 1) * hs * 1.1 - hs / 2;
      this.ctx.drawImage(img, x, L.livesPill.y + (L.livesPill.h - hs) / 2, hs, hs);
    }

    const bp = L.bricksPill;
    this.pill(bp, 102);
    const is = bp.h * 0.8;
    this.ctx.drawImage(sprite('brickIcon', this.px(is), 0), bp.x + 8, bp.y + (bp.h - is) / 2, is, is);
    inkText(this.ctx, String(g.bricks), bp.x + is + 8 + (bp.w - is - 16) / 2, bp.y + bp.h / 2, {
      size: bp.h * 0.6,
      fill: '#fffdf7',
      shadow: false,
      lw: 0,
      outline: 'none',
    });

    const wp = L.wavePill;
    this.pill(wp, 103);
    const shown = Math.min(g.waveIndex + 1, g.totalWaves);
    inkText(this.ctx, 'WAVE', wp.x + 16, wp.y + wp.h * 0.32, {
      size: wp.h * 0.3,
      fill: '#fffdf7',
      align: 'left',
      shadow: false,
      outline: 'none',
    });
    inkText(this.ctx, `${shown} OF ${g.totalWaves}`, wp.x + 16, wp.y + wp.h * 0.68, {
      size: wp.h * 0.34,
      fill: '#fffdf7',
      align: 'left',
      shadow: false,
      outline: 'none',
    });
    const fs = wp.h * 0.78;
    this.ctx.drawImage(sprite('flag', this.px(fs), frame), wp.x + wp.w - fs - 6, wp.y + (wp.h - fs) / 2, fs, fs);

    const pb = L.pauseBtn;
    const lift = v.hoverUi === 'pause' ? -2 : 0;
    this.pill({ ...pb, y: pb.y + lift }, 104);
    const ctx = this.ctx;
    const cx = pb.x + pb.w / 2;
    const cy = pb.y + pb.h / 2 + lift;
    const bh = pb.h * 0.42;
    if (v.paused) {
      shape(
        ctx,
        [
          { x: cx - bh * 0.35, y: cy - bh / 2 },
          { x: cx + bh * 0.5, y: cy },
          { x: cx - bh * 0.35, y: cy + bh / 2 },
        ],
        mulberry32(5),
        { fill: '#fffdf7', stroke: '#fffdf7', lw: 3, sketch: false, step: 8 },
      );
    } else {
      for (const dx of [-bh * 0.28, bh * 0.28]) {
        shape(ctx, rectPts(cx + dx - bh * 0.12, cy - bh / 2, bh * 0.24, bh, 3), mulberry32(6), {
          fill: '#fffdf7',
          stroke: '#fffdf7',
          lw: 2,
          sketch: false,
        });
      }
    }
  }

  private button(
    r: Rect,
    color: string,
    seed: number,
    o: { lift?: number; selected?: boolean; disabled?: boolean; radius?: number } = {},
  ) {
    const ctx = this.ctx;
    const rng = mulberry32(seed);
    const y = r.y - (o.lift ?? 0);
    const rad = o.radius ?? 18;
    shape(ctx, rectPts(r.x + 3, r.y + 7, r.w, r.h, rad), rng, { fill: INK, stroke: 'none' });
    if (o.selected) {
      shape(ctx, rectPts(r.x - 7, y - 7, r.w + 14, r.h + 14, rad + 6), rng, { fill: '#fffdf7', lw: 3.4 });
    }
    shape(ctx, rectPts(r.x, y, r.w, r.h, rad), rng, { fill: color, lw: 4.2 });
    ctx.save();
    ctx.globalAlpha = 0.45;
    shape(ctx, rectPts(r.x + 7, y + 7, r.w - 14, r.h - 14, rad - 6), rng, { stroke: '#fffdf7', lw: 2, sketch: false });
    ctx.restore();
    hatch(ctx, rectPts(r.x + 4, y + r.h * 0.72, r.w - 8, r.h * 0.26, 10), rng, INK, 6, 1.2, 0.18);
    return y;
  }

  private drawToolbar(v: ViewState) {
    const L = this.L;
    const g = v.game;
    const frame = this.boil(v.time);
    const colors: Record<TowerKind, string> = { wall: PAL.red, shooter: PAL.blue, trap: PAL.yellow };
    TOOL_ORDER.forEach((kind, i) => {
      const r = L.tools[kind];
      const stats = TOWERS[kind];
      const selected = v.selected === kind;
      const affordable = g.bricks >= stats.cost;
      const lift = selected ? 8 : v.hoverUi === kind ? 3 : 0;
      let dx = 0;
      if (v.denyTool?.kind === kind) dx = Math.sin(v.denyTool.t * 50) * 6 * (v.denyTool.t / 0.4);
      const rr = { ...r, x: r.x + dx };
      const y = this.button(rr, colors[kind], 200 + i, { lift, selected });
      const labelSize = L.portrait ? 38 : 40;
      inkText(this.ctx, stats.label, rr.x + rr.w / 2, y + (L.portrait ? 40 : 32), { size: labelSize, fill: '#fffdf7' });
      const icon = L.portrait ? 110 : 84;
      const bounce = selected ? Math.abs(Math.sin(v.time * 5)) * 5 : 0;
      const iconBottom = y + rr.h - (L.portrait ? 30 : 4) - bounce;
      const iconX = L.portrait ? rr.x + rr.w / 2 : rr.x + rr.w / 2 - 22;
      this.drawTowerSprite(kind, iconX, iconBottom, icon, frame, 1);
      const tag: Rect = L.portrait
        ? { x: rr.x + rr.w / 2 - 46, y: y + rr.h - 18, w: 92, h: 36 }
        : { x: rr.x + rr.w - 102, y: y + rr.h - 48, w: 92, h: 36 };
      shape(this.ctx, rectPts(tag.x, tag.y, tag.w, tag.h, 12), mulberry32(300 + i), { fill: '#fffdf7', lw: 3 });
      const bi = 32;
      this.ctx.drawImage(sprite('brickIcon', this.px(bi), 0), tag.x + 4, tag.y + 1, bi, bi);
      inkText(this.ctx, String(stats.cost), tag.x + 60, tag.y + tag.h / 2, {
        size: 24,
        fill: affordable ? INK : '#d9453b',
        shadow: false,
        outline: 'none',
      });
      if (!affordable) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.38;
        shape(this.ctx, rectPts(rr.x, y, rr.w, rr.h, 18), mulberry32(400 + i), { fill: '#6e6a64', stroke: 'none' });
        this.ctx.restore();
      }
    });

    const sb = L.startBtn;
    const phase = g.phase;
    const ready = phase === 'ready' || phase === 'intermission';
    const pulse = ready ? Math.abs(Math.sin(v.time * 3)) * 4 : 0;
    const y = this.button(sb, ready ? GREEN_BTN : '#c9c3b6', 500, {
      lift: (v.hoverUi === 'start' && ready ? 3 : 0) + pulse,
      radius: 20,
    });
    const cx = sb.x + sb.w / 2;
    let top = '';
    let bottom = '';
    const n = g.waveIndex + 1;
    if (phase === 'ready') {
      top = 'Start';
      bottom = `Wave ${n} ▶`;
    } else if (phase === 'intermission') {
      top = `Wave ${n}`;
      bottom = `in ${Math.ceil(g.intermissionT)}s ▶`;
    } else {
      top = 'Critters';
      bottom = `left: ${g.remaining}`;
    }
    if (L.portrait) {
      inkText(this.ctx, `${top} ${bottom}`, cx, y + sb.h / 2, { size: 40, fill: '#fffdf7', maxWidth: sb.w - 30 });
    } else {
      inkText(this.ctx, top, cx, y + sb.h * 0.33, { size: 28, fill: '#fffdf7', maxWidth: sb.w - 20 });
      inkText(this.ctx, bottom, cx, y + sb.h * 0.67, { size: 28, fill: '#fffdf7', maxWidth: sb.w - 20 });
    }

    const hint = this.hintText(v);
    if (hint) {
      const ctx = this.ctx;
      ctx.font = `24px ${HAND_FONT}`;
      const w = Math.min(L.hint.w, ctx.measureText(hint).width + 36);
      const hr: Rect = { x: L.hint.x - w / 2, y: L.hint.y - 17, w, h: 34 };
      shape(ctx, rectPts(hr.x, hr.y, hr.w, hr.h, 6), mulberry32(600), { fill: '#fffdf7', lw: 2.6 });
      inkText(ctx, hint, L.hint.x, L.hint.y + 1, {
        size: 24,
        font: 'hand',
        fill: INK,
        outline: 'none',
        maxWidth: w - 20,
      });
    }
  }

  private hintText(v: ViewState): string {
    const g = v.game;
    if (g.phase === 'won' || g.phase === 'lost') return '';
    if (v.selected) {
      const s = TOWERS[v.selected];
      if (g.bricks < s.cost) return `${s.label} costs ${s.cost} bricks. Beat critters to earn more!`;
      return `Tap an empty lawn square to place a ${s.label}. ${s.blurb}.`;
    }
    if (g.phase === 'ready') {
      return g.towers().length === 0
        ? 'Pick a tower below, then tap the lawn to snap it down!'
        : 'Ready? Hit Start when your bricks are in place.';
    }
    if (g.phase === 'intermission') return 'Wave cleared! Spend your bricks before the next wave.';
    return '';
  }

  private drawToast(v: ViewState) {
    if (!v.toast) return;
    const L = this.L;
    const { text, t, dur } = v.toast;
    const a = Math.min(1, t * 8, (dur - t) * 4);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `28px ${HAND_FONT}`;
    const w = ctx.measureText(text).width + 48;
    const cx = L.lawn.x + L.lawn.w / 2;
    const cy = L.lawn.y + 40;
    const rng = mulberry32(700);
    const pts = rectPts(cx - w / 2, cy - 26, w, 52, 22);
    shape(ctx, pts, rng, { fill: '#fffdf7', lw: 3.4 });
    inkText(ctx, text, cx, cy + 1, { size: 28, font: 'hand', fill: '#c8392f', outline: 'none' });
    ctx.restore();
  }

  // ---------- effects ----------

  private drawEffects(v: ViewState, ui: boolean) {
    const ctx = this.ctx;
    for (const fx of v.effects) {
      const isUi = fx.kind === 'float' || fx.kind === 'word';
      if (isUi !== ui) continue;
      const p = fx.t / fx.dur;
      const rng = mulberry32(Math.floor(fx.x * 13 + fx.y * 7));
      ctx.save();
      if (fx.kind === 'pop') {
        const s = (fx.size ?? 16) * (0.6 + p * 0.8);
        ctx.globalAlpha = 1 - p;
        shape(ctx, starburstPts(fx.x, fx.y, s, s * 0.45, 7, rng), rng, {
          fill: fx.gray ? '#d6d3cc' : '#fffbe0',
          lw: 2.2,
          sketch: false,
        });
      } else if (fx.kind === 'puff') {
        ctx.globalAlpha = 1 - p;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          const d = (fx.size ?? 30) * (0.4 + p);
          const r = (fx.size ?? 30) * 0.22 * (1 - p * 0.5);
          shape(ctx, ellipsePts(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * 0.4, r, r * 0.8, 10), rng, {
            fill: '#f1ebdd',
            lw: 2,
            sketch: false,
          });
        }
      } else if (fx.kind === 'float') {
        ctx.globalAlpha = Math.min(1, (1 - p) * 2);
        const y = fx.y - p * 40;
        const size = fx.size ?? 26;
        inkText(ctx, fx.text ?? '', fx.x + size * 0.45, y, { size, fill: fx.color ?? '#fffdf7' });
        const bi = size * 1.2;
        ctx.drawImage(sprite('brickIcon', this.px(bi), 0), fx.x - size * 0.45 - bi, y - bi / 2 - 2, bi, bi);
      } else if (fx.kind === 'word') {
        const size = fx.size ?? 34;
        const grow = p < 0.15 ? 0.5 + (p / 0.15) * 0.7 : p < 0.25 ? 1.2 - ((p - 0.15) / 0.1) * 0.2 : 1;
        ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
        ctx.translate(fx.x, fx.y - p * 12);
        ctx.rotate(fx.rot ?? 0);
        ctx.scale(grow, grow);
        ctx.font = `${size}px "Luckiest Guy"`;
        const tw = ctx.measureText(fx.text ?? '').width;
        const rx = tw * 0.5 + size * 0.7;
        shape(ctx, starburstPts(0, 0, rx, rx * 0.72, 13, rng, Math.min(1, (size * 1.25) / rx)), rng, {
          fill: fx.color ?? '#fff3a6',
          lw: 3,
          sketch: false,
        });
        inkText(ctx, fx.text ?? '', 0, 0, { size, fill: '#fffdf7' });
      }
      ctx.restore();
    }
  }

  // ---------- overlays ----------

  private drawOverlay(v: ViewState, kind: 'pause' | 'won' | 'lost') {
    const ctx = this.ctx;
    const L = this.L;
    const { panel, buttons } = overlayLayout(L, kind);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(42,38,34,0.55)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    const rng = mulberry32(800);
    ctx.save();
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate(-0.012);
    ctx.translate(-(panel.x + panel.w / 2), -(panel.y + panel.h / 2));
    shape(ctx, rectPts(panel.x + 8, panel.y + 12, panel.w, panel.h, 10), rng, { fill: INK, stroke: 'none' });
    shape(ctx, rectPts(panel.x, panel.y, panel.w, panel.h, 10), rng, { fill: '#fffdf7', lw: 6 });
    ctx.save();
    ctx.globalAlpha = 0.6;
    shape(ctx, rectPts(panel.x + 12, panel.y + 12, panel.w - 24, panel.h - 24, 6), rng, { lw: 2, sketch: false });
    ctx.restore();

    const cx = panel.x + panel.w / 2;
    const frame = this.boil(v.time);
    const g = v.game;
    const title = kind === 'pause' ? 'Paused' : kind === 'won' ? 'Fort Saved!' : 'Oh No!';
    const burstColor = kind === 'won' ? PAL.yellow : kind === 'lost' ? '#f4a19a' : PAL.blueTop;
    shape(ctx, starburstPts(cx, panel.y + 86, 250, 190, 16, mulberry32(801), 0.36), mulberry32(802), {
      fill: burstColor,
      lw: 3,
      sketch: false,
    });
    inkText(ctx, title, cx, panel.y + 88, { size: 70, fill: '#fffdf7', lw: 10 });

    let sub = '';
    let sub2 = '';
    if (kind === 'pause') {
      sub = 'Take a breather. The critters will wait.';
      sub2 = `Wave ${Math.min(g.waveIndex + 1, g.totalWaves)} of ${g.totalWaves}  ·  ${g.bricks} bricks`;
    } else if (kind === 'won') {
      sub = `You beat ${GAME_TITLE}! All ${g.totalWaves} waves stopped.`;
      sub2 = `Lives left: ${g.lives}  ·  Bricks saved: ${g.bricks}`;
    } else {
      sub = `${GAME_TITLE} wins this time. Three critters got in.`;
      sub2 = `You reached wave ${Math.min(g.waveIndex + 1, g.totalWaves)} of ${g.totalWaves}. Try a new plan!`;
    }
    inkText(ctx, sub, cx, panel.y + 176, { size: 30, font: 'hand', fill: INK, outline: 'none', maxWidth: panel.w - 60 });
    inkText(ctx, sub2, cx, panel.y + 214, { size: 26, font: 'hand', fill: '#6b655c', outline: 'none', maxWidth: panel.w - 60 });

    const rowY = buttons[0].rect.y - 18;
    const s = L.portrait ? 130 : 100;
    const bob = Math.sin(v.time * 4) * 3;
    if (kind === 'lost') {
      this.drawSprite('blob', cx - 170, rowY + bob, s * 0.86, frame);
      this.drawSprite('beetleA', cx, rowY - bob, s, frame);
      this.drawRoller(cx + 170, rowY + bob, s * 0.9, frame, v.time * -4);
    } else {
      this.drawSprite('wall0', cx - 170, rowY + bob, s, frame);
      this.drawSprite('shooter', cx, rowY - bob, s, frame);
      this.drawSprite('trap', cx + 170, rowY + s * 0.06, s, frame);
    }
    ctx.restore();

    buttons.forEach((b, i) => {
      const y = this.button(b.rect, b.color, 850 + i, { lift: v.hoverUi === b.id ? 3 : 0 });
      inkText(ctx, b.label, b.rect.x + b.rect.w / 2, y + b.rect.h / 2, { size: 40, fill: '#fffdf7' });
    });
  }

  // ---------- title ----------

  private drawTitle(v: ViewState) {
    const ctx = this.ctx;
    const L = this.L;
    const T = titleLayout(L);
    const frame = this.boil(v.time);
    this.drawBanner(ctx, T.banner, mulberry32(41));
    inkText(ctx, 'Snap brick towers onto the lawn. Stop the critters before they reach your fort!', T.subtitle.x, T.subtitle.y, {
      size: L.portrait ? 26 : 28,
      font: 'hand',
      fill: INK,
      outline: 'none',
      maxWidth: L.W - 60,
    });

    const cards: { name: SpriteName | 'roller'; title: string; blurb: string; cost?: number }[] = [
      { name: 'wall0', title: '1) Brick Wall', blurb: 'Blocks the path. Super tough!', cost: TOWERS.wall.cost },
      { name: 'shooter', title: '2) Stud Shooter', blurb: 'Fires studs down its lane.', cost: TOWERS.shooter.cost },
      { name: 'trap', title: '3) Glue Trap', blurb: 'Sticky goo slows critters.', cost: TOWERS.trap.cost },
      { name: 'blob', title: '4) Soft Blob', blurb: 'Bouncy, squishy, slow.' },
      { name: 'beetleA', title: '5) Armored Beetle', blurb: 'Hard shell shrugs off studs.' },
      { name: 'roller', title: '6) Fast Roller', blurb: 'Zooms in on one wheel!' },
    ];
    cards.forEach((c, i) => {
      const r = T.panels[i];
      const rng = mulberry32(1000 + i);
      ctx.save();
      const tilt = (i % 2 ? 1 : -1) * 0.008;
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(tilt);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      shape(ctx, rectPts(r.x + 5, r.y + 7, r.w, r.h, 6), rng, { fill: 'rgba(42,38,34,0.25)', stroke: 'none' });
      shape(ctx, rectPts(r.x, r.y, r.w, r.h, 6), rng, { fill: i < 3 ? '#fffdf7' : '#fbf6ea', lw: 4 });
      const isEnemy = i >= 3;
      const bob = Math.sin(v.time * 4 + i) * 3;
      let sx: number, sb: number, size: number, tx: number, ty: number, align: CanvasTextAlign;
      if (L.portrait) {
        size = 130;
        sx = r.x + r.w / 2;
        sb = r.y + 140;
        tx = r.x + r.w / 2;
        ty = r.y + 170;
        align = 'center';
      } else {
        size = 140;
        sx = r.x + 84;
        sb = r.y + r.h - 18;
        tx = r.x + 168;
        ty = r.y + 62;
        align = 'left';
      }
      if (c.name === 'roller') this.drawRoller(sx, sb + bob, size * 0.9, frame, -v.time * 5);
      else if (c.name === 'blob') {
        const hop = Math.abs(Math.sin(v.time * 5));
        this.drawSprite('blob', sx, sb - hop * 10, size * 0.86, frame, { sx: 1 + (1 - hop) * 0.08, sy: 1 - (1 - hop) * 0.08 });
      } else if (c.name === 'beetleA') {
        this.drawSprite(Math.floor(v.time * 6) % 2 ? 'beetleA' : 'beetleB', sx, sb, size, frame);
      } else this.drawSprite(c.name, sx, sb + (isEnemy ? bob : 0), size, frame);

      const maxW = L.portrait ? r.w - 20 : r.w - 180;
      inkText(ctx, c.title.toUpperCase(), tx, ty, { size: L.portrait ? 26 : 25, fill: INK, align, outline: 'none', shadow: false, maxWidth: maxW });
      inkText(ctx, c.blurb, tx, ty + (L.portrait ? 32 : 36), { size: L.portrait ? 23 : 24, font: 'hand', fill: '#5d574e', align, outline: 'none', maxWidth: maxW });
      if (c.cost !== undefined) {
        const tagX = L.portrait ? r.x + r.w - 96 : tx;
        const tagY = L.portrait ? r.y + 12 : ty + 64;
        shape(ctx, rectPts(tagX, tagY, 86, 34, 12), rng, { fill: PAL.yellowHi, lw: 2.6 });
        ctx.drawImage(sprite('brickIcon', this.px(30), 0), tagX + 4, tagY + 1, 30, 30);
        inkText(ctx, String(c.cost), tagX + 58, tagY + 18, { size: 22, fill: INK, outline: 'none', shadow: false });
      } else if (!L.portrait) {
        inkText(ctx, `${ENEMIES[c.name === 'beetleA' ? 'beetle' : (c.name as 'blob' | 'roller')].reward} bricks each`, tx, ty + 76, {
          size: 22,
          font: 'hand',
          fill: '#8a8378',
          align,
          outline: 'none',
          maxWidth: maxW,
        });
      }
      ctx.restore();
    });

    const p = T.play;
    const pulse = Math.abs(Math.sin(v.time * 3)) * 5;
    const y = this.button(p, GREEN_BTN, 1100, { lift: pulse + (v.hoverUi === 'play' ? 3 : 0), radius: 26 });
    inkText(ctx, 'Play ▶', p.x + p.w / 2, y + p.h / 2, { size: 58, fill: '#fffdf7', lw: 9 });
    inkText(ctx, 'A tiny tower-defense game for Savyr', T.footer.x, T.footer.y, {
      size: 22,
      font: 'hand',
      fill: '#8a8378',
      outline: 'none',
    });
  }
}

// ---------- static drawing helpers ----------

function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, rng: Rng) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const n = Math.floor((w * h) / (900 * dpr * dpr));
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = (8 + rng() * 30) * dpr;
    const a = -0.9 + (rng() - 0.5) * 0.5;
    ctx.strokeStyle = `rgba(110,98,82,${0.04 + rng() * 0.06})`;
    ctx.lineWidth = (0.6 + rng() * 0.8) * dpr;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(90,70,40,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function rock(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number) {
  const pts = ellipsePts(x, y, r, r * 0.72, 12, rng, 0.3);
  shape(ctx, pts, rng, { fill: rng() > 0.5 ? '#bdb9b1' : '#aaa69e', lw: 2.4, sketch: false, amp: 1 });
  hatch(ctx, ellipsePts(x + r * 0.2, y + r * 0.3, r * 0.8, r * 0.4, 10), rng, INK, 3.5, 1, 0.3);
}

function drawLawn(ctx: CanvasRenderingContext2D, L: Layout, rng: Rng) {
  const { x, y, w, h } = L.lawn;
  shape(ctx, rectPts(x - 8, y - 8, w + 16, h + 16, 12), rng, { fill: '#79b84d', lw: 3, amp: 3 });
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = x + c * L.cellW;
      const cy = y + r * L.cellH;
      ctx.fillStyle = (r + c) % 2 === 0 ? LAWN_A : LAWN_B;
      ctx.fillRect(cx, cy, L.cellW, L.cellH);
      ctx.lineCap = 'round';
      const blades = Math.floor((L.cellW * L.cellH) / 170);
      for (let i = 0; i < blades; i++) {
        const bx = cx + 4 + rng() * (L.cellW - 8);
        const by = cy + 6 + rng() * (L.cellH - 8);
        const dark = rng() > 0.4;
        ctx.strokeStyle = dark ? 'rgba(78,138,48,0.55)' : 'rgba(200,236,160,0.6)';
        ctx.lineWidth = dark ? 1.4 : 1.2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (rng() - 0.5) * 3, by - 3 - rng() * 5);
        ctx.stroke();
      }
      if (rng() > 0.8) {
        const px = cx + 10 + rng() * (L.cellW - 20);
        const py = cy + 10 + rng() * (L.cellH - 20);
        shape(ctx, ellipsePts(px, py, 3.2, 2.4, 8), rng, { fill: '#c9c4b8', lw: 1.4, sketch: false, amp: 0.4 });
      }
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let c = 1; c < COLS; c++) {
    line(ctx, [{ x: x + c * L.cellW, y: y + 2 }, { x: x + c * L.cellW, y: y + h - 2 }], rng, 1.6, '#4f8a32', 1.4);
  }
  for (let r = 1; r < ROWS; r++) {
    line(ctx, [{ x: x + 2, y: y + r * L.cellH }, { x: x + w - 2, y: y + r * L.cellH }], rng, 1.6, '#4f8a32', 1.4);
  }
  ctx.restore();
  shape(ctx, rectPts(x, y, w, h, 4), rng, { lw: 4.2, amp: 2 });
  for (let tx = x + 10; tx < x + w - 10; tx += 22 + rng() * 18) {
    for (const [edge, dir] of [
      [y, -1],
      [y + h, 1],
    ]) {
      const bx = tx + (rng() - 0.5) * 8;
      line(
        ctx,
        [
          { x: bx - 5, y: edge + dir * 2 },
          { x: bx - 2, y: edge + dir * 9 },
          { x: bx, y: edge + dir * 3 },
          { x: bx + 3, y: edge + dir * 11 },
          { x: bx + 5, y: edge + dir * 2 },
        ],
        rng,
        1.6,
        '#3f7a28',
        0.6,
      );
    }
  }
}

function drawFortress(ctx: CanvasRenderingContext2D, L: Layout, rng: Rng) {
  const f = L.fortress;
  if (f.w / f.h < 0.3) {
    drawRampart(ctx, L, rng);
    return;
  }
  const s = Math.min(f.w / 236, f.h / 470);
  ctx.save();
  ctx.translate(f.x, f.y + (f.h - 470 * s) / 2);
  ctx.scale(s, s);

  const dirt: Pt[] = [
    { x: 146, y: 318 },
    { x: 180, y: 300 },
    { x: 214, y: 250 },
    { x: 250, y: 200 },
    { x: 250, y: 470 },
    { x: 120, y: 470 },
    { x: 150, y: 420 },
    { x: 156, y: 360 },
  ];
  shape(ctx, dirt, rng, { fill: '#dcc08f', lw: 2.4, amp: 3, sketch: false });
  ctx.save();
  ctx.beginPath();
  dirt.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.clip();
  ctx.fillStyle = 'rgba(150,115,70,0.45)';
  for (let i = 0; i < 90; i++) {
    const px = 130 + rng() * 110;
    const py = 200 + rng() * 270;
    ctx.beginPath();
    ctx.arc(px, py, 0.8 + rng() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (let i = 0; i < 16; i++) rock(ctx, rng, 8 + rng() * 150, 350 + rng() * 90, 10 + rng() * 12);
  for (let yy = 30; yy < 450; yy += 34 + rng() * 20) rock(ctx, rng, 226 + rng() * 10, yy, 7 + rng() * 5);

  const body = rectPts(20, 176, 146, 166);
  shape(ctx, body, rng, { fill: PAL.red, lw: 4 });
  ctx.save();
  ctx.globalAlpha = 0.7;
  const rows = 8;
  const rh = 166 / rows;
  for (let r = 1; r < rows; r++) line(ctx, [{ x: 22, y: 176 + r * rh }, { x: 164, y: 176 + r * rh }], rng, 1.6);
  for (let r = 0; r < rows; r++) {
    for (let bx = 20 + (r % 2 ? 18 : 36); bx < 164; bx += 36) {
      line(ctx, [{ x: bx, y: 176 + r * rh + 1 }, { x: bx, y: 176 + (r + 1) * rh - 1 }], rng, 1.6);
    }
  }
  ctx.restore();
  hatch(ctx, rectPts(130, 176, 36, 166), rng, INK, 5, 1.2, 0.3);

  shape(ctx, rectPts(10, 148, 166, 32), rng, { fill: '#bdb9b1', lw: 3.6 });
  for (let i = 0; i < 4; i++) {
    shape(ctx, rectPts(10 + i * 46, 118, 28, 32), rng, { fill: '#c9c5bd', lw: 3.4 });
    hatch(ctx, rectPts(28 + i * 46, 118, 10, 32), rng, INK, 4, 1, 0.3);
  }
  line(ctx, [{ x: 40, y: 164 }, { x: 40, y: 180 }], rng, 1.6);
  line(ctx, [{ x: 100, y: 148 }, { x: 100, y: 164 }], rng, 1.6);
  line(ctx, [{ x: 140, y: 164 }, { x: 140, y: 180 }], rng, 1.6);

  const arch = (x: number, y: number, w: number, h: number): Pt[] => {
    const pts: Pt[] = [{ x, y: y + h }];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      pts.push({ x: x + w / 2 + Math.cos(a) * (w / 2), y: y + w / 2 + Math.sin(a) * (w / 2) });
    }
    pts.push({ x: x + w, y: y + h });
    return pts;
  };
  shape(ctx, arch(38, 204, 34, 46), rng, { fill: '#3b2f29', lw: 3.4 });
  shape(ctx, arch(96, 262, 54, 80), rng, { fill: '#b9b5ad', lw: 3.6 });
  shape(ctx, arch(104, 272, 38, 70), rng, { fill: '#2f2622', lw: 3 });

  line(ctx, [{ x: 92, y: 120 }, { x: 92, y: 26 }], rng, 5, INK, 0.6);
  line(ctx, [{ x: 92, y: 120 }, { x: 92, y: 26 }], rng, 2.4, '#d8d4cc', 0.4);
  shape(ctx, ellipsePts(92, 24, 5, 5, 10), rng, { fill: PAL.yellow, lw: 2.4, sketch: false });
  const flag: Pt[] = [
    { x: 94, y: 30 },
    { x: 124, y: 22 },
    { x: 156, y: 32 },
    { x: 142, y: 48 },
    { x: 160, y: 66 },
    { x: 126, y: 60 },
    { x: 94, y: 70 },
  ];
  shape(ctx, flag, rng, { fill: '#5d91e2', lw: 3.4, step: 8 });
  const star: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? 5 : 11;
    star.push({ x: 122 + Math.cos(a) * rr, y: 46 + Math.sin(a) * rr });
  }
  shape(ctx, star, rng, { fill: '#fffdf7', lw: 1.8, sketch: false, step: 4 });

  for (const [px, py] of [
    [58, 392],
    [104, 404],
  ]) {
    shape(ctx, rectPts(px, py, 13, 44, 3), rng, { fill: '#c49a5c', lw: 2.6 });
  }
  shape(ctx, rectPts(50, 408, 76, 9, 2), rng, { fill: '#d4ad70', lw: 2.4 });
  ctx.restore();
}

function drawRampart(ctx: CanvasRenderingContext2D, L: Layout, rng: Rng) {
  const f = L.fortress;
  const top = L.lawn.y - 10;
  const bottom = L.lawn.y + L.lawn.h + 10;
  const w = f.w * 0.62;
  shape(ctx, rectPts(f.x - 6, top, w + 6, bottom - top), rng, { fill: PAL.red, lw: 3.4 });
  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let yy = top + 16, r = 0; yy < bottom; yy += 16, r++) {
    line(ctx, [{ x: f.x, y: yy }, { x: f.x + w - 2, y: yy }], rng, 1.4);
    const bx = f.x + (r % 2 ? w * 0.3 : w * 0.7);
    line(ctx, [{ x: bx, y: yy - 15 }, { x: bx, y: yy - 1 }], rng, 1.4);
  }
  ctx.restore();
  for (let yy = top + 8; yy < bottom - 20; yy += 44) {
    shape(ctx, rectPts(f.x + w - 2, yy, f.w - w - 2, 24), rng, { fill: '#c9c5bd', lw: 2.6, sketch: false });
  }
  line(ctx, [{ x: f.x + w * 0.5, y: top }, { x: f.x + w * 0.5, y: top - 34 }], rng, 3.4);
  shape(
    ctx,
    [
      { x: f.x + w * 0.5 + 1, y: top - 34 },
      { x: f.x + w * 0.5 + 28, y: top - 28 },
      { x: f.x + w * 0.5 + 1, y: top - 18 },
    ],
    rng,
    { fill: '#5d91e2', lw: 2.4, sketch: false, step: 6 },
  );
  for (let i = 0; i < 4; i++) rock(ctx, rng, f.x + 8 + rng() * (f.w - 12), bottom + 4 + rng() * 10, 7 + rng() * 4);
}

function drawRift(ctx: CanvasRenderingContext2D, L: Layout, rng: Rng) {
  const { x, y, w, h } = L.rift;
  const build = (inset: number, tipX: number, valleyX: number, spikes: number): Pt[] => {
    const pts: Pt[] = [];
    const topY = y + inset;
    const botY = y + h - inset;
    const right = x + w + 30;
    pts.push({ x: right, y: topY });
    for (let i = 0; i <= 5; i++) {
      const px = right - ((right - (x + valleyX)) * i) / 5;
      pts.push({ x: px, y: topY + (i % 2 ? inset * 0.9 + 6 : 0) });
    }
    for (let i = 0; i <= spikes * 2; i++) {
      const py = topY + ((botY - topY) * i) / (spikes * 2);
      const px = i % 2 ? x + tipX + (rng() - 0.5) * 6 : x + valleyX + (rng() - 0.5) * w * 0.12;
      pts.push({ x: px, y: py });
    }
    for (let i = 0; i <= 5; i++) {
      const px = x + valleyX + ((right - (x + valleyX)) * i) / 5;
      pts.push({ x: px, y: botY - (i % 2 ? inset * 0.9 + 6 : 0) });
    }
    pts.push({ x: right, y: botY });
    return pts;
  };
  const spikes = Math.round(h / 44);
  const inset = Math.min(16, w * 0.3);
  const outer = build(0, L.portrait ? -4 : 2, w * 0.3, spikes);
  shape(ctx, outer, rng, { fill: '#fffdf7', lw: 4, step: 30, amp: 1 });
  const inner = build(inset, L.portrait ? 8 : 20, w * 0.44, spikes + 1);
  shape(ctx, inner, rng, { fill: '#3e2a69', lw: 3.4, step: 30, amp: 1 });
  ctx.save();
  ctx.beginPath();
  inner.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < (w * h) / 220; i++) {
    const sx = x + rng() * w;
    const sy = y + rng() * h;
    const len = 8 + rng() * 26;
    const a = -1.1 + (rng() - 0.5) * 0.8;
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(122,88,196,0.8)' : 'rgba(160,126,228,0.55)';
    ctx.lineWidth = 1.5 + rng() * 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    ctx.stroke();
  }
  for (let i = 0; i < (w * h) / 1400; i++) {
    const rx = x + rng() * w;
    const ry = y + rng() * h;
    const r = 2.5 + rng() * 5;
    shape(ctx, ellipsePts(rx, ry, r, r * 0.8, 6, rng, 0.5), rng, { fill: '#8f8b98', lw: 1.6, sketch: false, amp: 0.6 });
  }
  ctx.restore();
  hatch(ctx, inner, rng, '#120b22', 5, 1.2, 0.35);
}
