export const GAME_TITLE = 'Crit-terror';

export type TowerKind = 'wall' | 'shooter' | 'trap' | 'bastion';
export type EnemyKind = 'blob' | 'beetle' | 'roller' | 'pogo' | 'crab';
export type LevelId = 1 | 2 | 3;
export type Theme = 'lawn' | 'quarry';

export const ROWS = 5;
export const COLS = 9;

export const START_BRICKS = 150;
export const START_LIVES = 3;
export const TRICKLE_EVERY = 2.5;
export const TRICKLE_AMOUNT = 5;
export const WAVE_BONUS = 50;
export const INTERMISSION = 12;

export const SHOOTER_COOLDOWN = 1.1;
export const STUD_DAMAGE = 20;
export const STUD_SPEED = 7;
export const GLUE_SLOW = 0.4;
export const GLUE_LINGER = 0.9;

/** Fixed-distance hop used by rollers (walls only) and pogo punks (any tower). */
export const HOP_DUR = 0.42;
export const HOP_DIST = 1.22;
export const POGO_HOP_DUR = 0.52;
export const POGO_HOP_DIST = 1.32;

/** Soft Blob's second life on levels that enable it. */
export const REVIVE_PAUSE = 0.7;
export const REVIVE_HP = 0.65;
export const REVIVE_SPEED = 1.6;

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
  bastion: { label: 'Bastion', cost: 70, hp: 340, blurb: 'A wall that also shoots' },
};

/** Level 1 toolbar. Higher levels pick their own set. */
export const TOOL_ORDER: TowerKind[] = ['wall', 'shooter', 'trap'];

export interface EnemyStats {
  label: string;
  hp: number;
  speed: number;
  dps: number;
  reward: number;
  /** Multiplier applied to incoming stud damage while the critter is walking or chewing. */
  armor: number;
  /**
   * If set, used instead of `armor` whenever the critter is not chewing a tower.
   * Chomp Crab's shell works this way.
   */
  moveArmor?: number;
  blurb: string;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  blob: { label: 'Soft Blob', hp: 60, speed: 0.42, dps: 20, reward: 5, armor: 1, blurb: 'Bouncy and slow' },
  beetle: { label: 'Armored Beetle', hp: 150, speed: 0.26, dps: 30, reward: 15, armor: 0.6, blurb: 'Tough shell' },
  roller: { label: 'Fast Roller', hp: 40, speed: 1.0, dps: 12, reward: 8, armor: 1, blurb: 'Zooms in fast' },
  pogo: { label: 'Pogo Punk', hp: 64, speed: 0.86, dps: 8, reward: 9, armor: 1, blurb: 'Springs over towers' },
  crab: {
    label: 'Chomp Crab',
    hp: 168,
    speed: 0.3,
    dps: 46,
    reward: 18,
    armor: 1,
    moveArmor: 0.32,
    blurb: 'Shell holds until it chomps',
  },
};

export interface WaveDef {
  blob?: number;
  roller?: number;
  beetle?: number;
  pogo?: number;
  crab?: number;
  gap: number;
}

/**
 * Level 1 wave table. Phase 1 balance was tuned against this exact list —
 * leave the counts and gaps alone.
 */
export const WAVES: WaveDef[] = [
  { blob: 6, roller: 0, beetle: 0, gap: 4.5 },
  { blob: 8, roller: 3, beetle: 0, gap: 3.6 },
  { blob: 8, roller: 4, beetle: 2, gap: 3.1 },
  { blob: 9, roller: 6, beetle: 4, gap: 2.7 },
  { blob: 12, roller: 8, beetle: 6, gap: 2.3 },
];

/** Denser, clumpier, and meaner. Powers (not just counts) are the real spike. */
export const WAVES_L2: WaveDef[] = [
  { blob: 7, roller: 3, beetle: 0, gap: 3.3 },
  { blob: 8, roller: 5, beetle: 2, gap: 2.5 },
  { blob: 9, roller: 7, beetle: 4, gap: 2.0 },
  { blob: 11, roller: 8, beetle: 6, gap: 1.65 },
  { blob: 12, roller: 11, beetle: 8, gap: 1.35 },
];

/** Longer than level 2, with the new critters mixed into the old powers. */
export const WAVES_L3: WaveDef[] = [
  { blob: 7, pogo: 1, gap: 3.6 },
  { blob: 5, pogo: 4, beetle: 1, gap: 2.9 },
  { blob: 4, pogo: 5, beetle: 2, crab: 1, gap: 2.45 },
  { pogo: 6, roller: 3, beetle: 2, crab: 2, gap: 2.1 },
  { blob: 4, pogo: 8, roller: 4, beetle: 4, crab: 3, gap: 1.65 },
  { blob: 6, pogo: 9, roller: 5, beetle: 4, crab: 4, gap: 1.38 },
];

/** Per-level tweaks layered on the base critter stats. Level 1 leaves this empty. */
export type EnemyMod = Partial<Pick<EnemyStats, 'hp' | 'speed' | 'armor' | 'dps'>>;

export interface LevelPowers {
  /** Armored Beetle walks through glue with no slow. */
  beetleGlueImmune: boolean;
  /** Fast Roller hops wall tiles instead of stopping to chew them. */
  rollerHopsWalls: boolean;
  /** Soft Blob gets back up once, then scurries faster. */
  blobRevives: boolean;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  tagline: string;
  /** One line shown before the first tower is placed. */
  intro: string;
  theme: Theme;
  tools: TowerKind[];
  waves: WaveDef[];
  startBricks: number;
  /** Max critters in a row that may share a lane. Level 1 stays at 2. */
  rowStreak: number;
  /**
   * On the last two waves, bias spawns into the middle lanes so a built defense
   * can still be overwhelmed. Off for level 1.
   */
  /** How many of the final waves bunch critters into the middle lanes. 0 keeps level 1 even. */
  hotWaves: number;
  enemyMods?: Partial<Record<EnemyKind, EnemyMod>>;
  powers: LevelPowers;
}

export const LEVELS: Record<LevelId, LevelDef> = {
  1: {
    id: 1,
    name: 'Sunny Lawn',
    tagline: 'The classic lawn',
    intro: 'Pick a tower below, then tap the lawn to snap it down!',
    theme: 'lawn',
    tools: ['wall', 'shooter', 'trap'],
    waves: WAVES,
    startBricks: START_BRICKS,
    rowStreak: 2,
    hotWaves: 0,
    powers: { beetleGlueImmune: false, rollerHopsWalls: false, blobRevives: false },
  },
  2: {
    id: 2,
    name: 'Critter Powers',
    tagline: 'Same lawn, trickier bugs',
    intro: 'Beetles skip glue, rollers hop walls, blobs bounce back once!',
    theme: 'lawn',
    tools: ['wall', 'shooter', 'trap'],
    waves: WAVES_L2,
    startBricks: START_BRICKS,
    rowStreak: 4,
    hotWaves: 2,
    enemyMods: {
      // Tough enough to reach walls and glue, so the new powers actually show up.
      blob: { hp: 100, speed: 0.52 },
      beetle: { hp: 200, speed: 0.32, armor: 0.5 },
      roller: { hp: 86, speed: 1.62 },
    },
    powers: { beetleGlueImmune: true, rollerHopsWalls: true, blobRevives: true },
  },
  3: {
    id: 3,
    name: 'Quarry Dusk',
    tagline: 'New map, bastion towers',
    intro: 'Bastions block and shoot. Pogos spring, crabs chomp!',
    theme: 'quarry',
    tools: ['wall', 'bastion', 'trap'],
    waves: WAVES_L3,
    // Three bastions, matching Level 1's opening of three shooters.
    startBricks: 220,
    rowStreak: 4,
    hotWaves: 3,
    enemyMods: {
      blob: { hp: 88, speed: 0.5 },
      beetle: { hp: 180, speed: 0.3, armor: 0.52 },
      roller: { hp: 76, speed: 1.5 },
      pogo: { hp: 64, speed: 0.9 },
      crab: { hp: 168, speed: 0.3, dps: 44 },
    },
    powers: { beetleGlueImmune: true, rollerHopsWalls: true, blobRevives: true },
  },
};

export const LEVEL_IDS: LevelId[] = [1, 2, 3];
