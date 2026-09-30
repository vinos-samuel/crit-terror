export const GAME_TITLE = 'Crit-terror';

export type TowerKind = 'wall' | 'shooter' | 'trap';
export type EnemyKind = 'blob' | 'beetle' | 'roller';

export const ROWS = 5;
export const COLS = 9;

export const START_BRICKS = 150;
export const START_LIVES = 3;
export const TRICKLE_EVERY = 2.5;
export const TRICKLE_AMOUNT = 5;
export const WAVE_BONUS = 50;
export const INTERMISSION = 12;

export interface TowerStats {
  label: string;
  cost: number;
  hp: number;
  blurb: string;
}

export const TOWERS: Record<TowerKind, TowerStats> = {
  wall: { label: 'Wall', cost: 40, hp: 420, blurb: 'Blocks the path' },
  shooter: { label: 'Shooter', cost: 50, hp: 120, blurb: 'Fires studs down its lane' },
  trap: { label: 'Trap', cost: 30, hp: Infinity, blurb: 'Sticky glue slows critters' },
};

export const TOOL_ORDER: TowerKind[] = ['wall', 'shooter', 'trap'];

export const SHOOTER_COOLDOWN = 1.1;
export const STUD_DAMAGE = 20;
export const STUD_SPEED = 7;
export const GLUE_SLOW = 0.4;
export const GLUE_LINGER = 0.9;

export interface EnemyStats {
  label: string;
  hp: number;
  speed: number;
  dps: number;
  reward: number;
  /** Multiplier applied to incoming stud damage. */
  armor: number;
  blurb: string;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  blob: { label: 'Soft Blob', hp: 60, speed: 0.42, dps: 20, reward: 5, armor: 1, blurb: 'Bouncy and slow' },
  beetle: { label: 'Armored Beetle', hp: 150, speed: 0.26, dps: 30, reward: 15, armor: 0.6, blurb: 'Tough shell' },
  roller: { label: 'Fast Roller', hp: 40, speed: 1.0, dps: 12, reward: 8, armor: 1, blurb: 'Zooms in fast' },
};

export interface WaveDef {
  blob: number;
  roller: number;
  beetle: number;
  gap: number;
}

export const WAVES: WaveDef[] = [
  { blob: 6, roller: 0, beetle: 0, gap: 4.5 },
  { blob: 8, roller: 3, beetle: 0, gap: 3.6 },
  { blob: 8, roller: 4, beetle: 2, gap: 3.1 },
  { blob: 9, roller: 6, beetle: 4, gap: 2.7 },
  { blob: 12, roller: 8, beetle: 6, gap: 2.3 },
];
