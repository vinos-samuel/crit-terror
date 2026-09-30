import { COLS, ROWS, type ToolKind } from './config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  W: number;
  H: number;
  portrait: boolean;
  banner: Rect;
  livesPill: Rect;
  bricksPill: Rect;
  wavePill: Rect;
  pauseBtn: Rect;
  fortress: Rect;
  lawn: Rect;
  rift: Rect;
  cellW: number;
  cellH: number;
  tools: Record<ToolKind, Rect>;
  startBtn: Rect;
  hint: { x: number; y: number; w: number };
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

function landscape(): Layout {
  const cellW = 94;
  const cellH = 86;
  return {
    W: 1280,
    H: 720,
    portrait: false,
    banner: r(16, 10, 560, 96),
    livesPill: r(596, 24, 150, 68),
    bricksPill: r(760, 24, 172, 68),
    wavePill: r(946, 24, 204, 68),
    pauseBtn: r(1164, 24, 96, 68),
    fortress: r(0, 104, 236, 470),
    lawn: r(236, 118, cellW * COLS, cellH * ROWS),
    rift: r(236 + cellW * COLS, 96, 1280 - (236 + cellW * COLS), 474),
    cellW,
    cellH,
    tools: {
      wall: r(160, 574, 278, 126),
      shooter: r(470, 574, 302, 126),
      trap: r(804, 574, 278, 126),
    },
    startBtn: r(1104, 586, 164, 104),
    hint: { x: 658, y: 553, w: 820 },
  };
}

/** Portrait design is 720 wide; taller phones get a taller design so nothing is letterboxed. */
function portrait(aspect: number): Layout {
  const H = Math.round(Math.min(1600, Math.max(1180, 720 / aspect)));
  const extra = H - 1180;
  const grow = Math.min(extra * 0.45, 110);
  const rest = extra - grow;
  const cellW = 69;
  const cellH = 90 + grow / ROWS;
  const lawnX = 56;
  const top = 18 + rest * 0.2;
  const pillsY = top + 120;
  const lawnY = pillsY + 108 + rest * 0.1;
  const lawnH = cellH * ROWS;
  const toolsY = lawnY + lawnH + 70 + rest * 0.15;
  const toolH = 196 + rest * 0.2;
  const startY = toolsY + toolH + 28 + rest * 0.1;
  return {
    W: 720,
    H,
    portrait: true,
    banner: r(60, top, 600, 104),
    livesPill: r(16, pillsY, 150, 66),
    bricksPill: r(176, pillsY, 172, 66),
    wavePill: r(358, pillsY, 238, 66),
    pauseBtn: r(606, pillsY, 98, 66),
    fortress: r(0, lawnY - 20, lawnX, lawnH + 40),
    lawn: r(lawnX, lawnY, cellW * COLS, lawnH),
    rift: r(lawnX + cellW * COLS, lawnY - 20, 720 - (lawnX + cellW * COLS), lawnH + 40),
    cellW,
    cellH,
    tools: {
      wall: r(16, toolsY, 222, toolH),
      shooter: r(249, toolsY, 222, toolH),
      trap: r(482, toolsY, 222, toolH),
    },
    startBtn: r(150, startY, 420, 104),
    hint: { x: 360, y: lawnY + lawnH + 36, w: 680 },
  };
}

export function pickLayout(viewW: number, viewH: number): Layout {
  const aspect = viewW / viewH;
  return aspect < 0.9 ? portrait(aspect) : landscape();
}

export function hit(rect: Rect, x: number, y: number, pad = 0) {
  return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}

export function cellAt(L: Layout, x: number, y: number): { row: number; col: number } | null {
  const col = Math.floor((x - L.lawn.x) / L.cellW);
  const row = Math.floor((y - L.lawn.y) / L.cellH);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { row, col };
}
