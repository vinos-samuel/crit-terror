export const GAME_TITLE = 'Crit-terror';

export type TowerKind = 'wall' | 'shooter' | 'trap' | 'bastion' | 'missiler' | 'sticky' | 'twin' | 'spike';
/** Toolbar pieces. Merges are never buttons. */
export type ToolKind = 'wall' | 'shooter' | 'trap';
export type MergeKind = 'bastion' | 'missiler' | 'sticky' | 'twin' | 'spike';
export type EnemyKind = 'blob' | 'beetle' | 'roller' | 'pogo' | 'crab' | 'wisp' | 'skitter' | 'moth';
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;
export type Theme = 'lawn' | 'quarry' | 'fog' | 'night' | 'sky';

export const ROWS = 5;
export const COLS = 9;

export const START_BRICKS = 150;
export const START_LIVES = 3;
export const TRICKLE_EVERY = 2.5;
export const TRICKLE_AMOUNT = 5;
export const WAVE_BONUS = 50;
export const INTERMISSION = 12;

/**
 * Leftover bricks carried into the next campaign level, on top of that level's stash.
 * `carryBonus` keeps the whole leftover up to this cap so a thrifty clear helps the
 * opener (one extra Wall or Shooter) without rewriting later budgets.
 * Endless never reads or writes it.
 */
export const CARRY_CAP = 60;

export function carryBonus(bricksLeft: number): number {
  if (!Number.isFinite(bricksLeft) || bricksLeft <= 0) return 0;
  return Math.min(CARRY_CAP, Math.floor(bricksLeft));
}

/** Poke per second while a critter is chewing a Spike Wall. A stop, not a shell crack. */
export const SPIKE_DPS = 4;

export const SHOOTER_COOLDOWN = 1.1;
export const STUD_DAMAGE = 20;
export const STUD_SPEED = 7;
/** Missiles are slower and easier to see than studs. */
export const MISSILE_COOLDOWN = 1.28;
export const MISSILE_SPEED = 4.6;
/** Soft critters: a missile hurts, but a stud is the better tool. */
export const MISSILE_SOFT = 14;
/** Shells ignore their armor and take this flat crack. Obvious next to a stud. */
export const MISSILE_SHELL = 54;
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
  /**
   * Not sold on the toolbar. A Bastion is a Wall merged with a Shooter.
   * `cost` is the from-scratch total (40 + 50). The merge itself charges only
   * the piece you drop: 50 for a Shooter onto a Wall, or 40 for a Wall onto a Shooter.
   */
  bastion: { label: 'Bastion', cost: 90, hp: 340, blurb: 'Blocks and shoots' },
  /**
   * Trap + Shooter, either order. `cost` is 30 + 50. You pay only the piece you drop.
   * Fires missiles. Shells take MISSILE_SHELL and crack; everyone else takes MISSILE_SOFT.
   */
  missiler: { label: 'Missiler', cost: 80, hp: 200, blurb: 'Missiles crack shells' },
  /** Wall + Trap. Blocks, and critters in neighboring squares get glue-slow. */
  sticky: { label: 'Sticky Barricade', cost: 70, hp: 380, blurb: 'Blocks and gums up neighbors' },
  /** Shooter + Shooter. One volley, two studs. */
  twin: { label: 'Twin Shot', cost: 100, hp: 170, blurb: 'Fires two studs at once' },
  /**
   * Wall + Wall. `cost` is 40 + 40. You pay only the second Wall.
   * Blocks flyers. Spikes poke whoever is chewing it (SPIKE_DPS). Missiles still crack shells.
   */
  spike: { label: 'Spike Wall', cost: 80, hp: 480, blurb: 'Stops flyers. Spikes poke' },
};

/**
 * Dropping `placed` onto `existing`.
 * Bastion works on every level. Missiler, Sticky Barricade, Twin Shot, and Spike Wall need `extraMerges` (Level 2+).
 * Already-merged squares never merge again.
 */
export function mergeInto(placed: TowerKind, existing: TowerKind, extraMerges: boolean): MergeKind | null {
  if ((placed === 'shooter' && existing === 'wall') || (placed === 'wall' && existing === 'shooter')) return 'bastion';
  if (!extraMerges) return null;
  if ((placed === 'shooter' && existing === 'trap') || (placed === 'trap' && existing === 'shooter')) return 'missiler';
  if ((placed === 'wall' && existing === 'trap') || (placed === 'trap' && existing === 'wall')) return 'sticky';
  if (placed === 'shooter' && existing === 'shooter') return 'twin';
  if (placed === 'wall' && existing === 'wall') return 'spike';
  return null;
}

/** True when dropping `placed` onto `existing` should become a Bastion. */
export function isBastionMerge(placed: TowerKind, existing: TowerKind): boolean {
  return mergeInto(placed, existing, false) === 'bastion';
}

export const MERGE_CUE: Record<MergeKind, readonly [string, string]> = {
  bastion: ['MERGE!', 'BASTION!'],
  missiler: ['MISSILE!', 'LOCK ON!'],
  sticky: ['STICKY!', 'SPLAT!'],
  twin: ['TWIN!', 'DOUBLE!'],
  spike: ['SPIKES!', 'SNAG!'],
};

/** Level 1 toolbar. Higher levels pick their own set — still only the three base pieces. */
export const TOOL_ORDER: ToolKind[] = ['wall', 'shooter', 'trap'];

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
  /** Hard shell. Missiles crack it (bonus damage, big CRACK!). Studs do not. */
  shell?: boolean;
  /** Flies over every tower except a Spike Wall. Glue does nothing. Shoot it, or snag it. */
  flying?: boolean;
  blurb: string;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  blob: { label: 'Soft Blob', hp: 60, speed: 0.42, dps: 20, reward: 5, armor: 1, blurb: 'Bouncy and slow' },
  beetle: {
    label: 'Armored Beetle',
    hp: 150,
    speed: 0.26,
    dps: 30,
    reward: 15,
    armor: 0.6,
    shell: true,
    blurb: 'Tough shell. Missiles crack it.',
  },
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
    shell: true,
    blurb: 'Shell holds until it chomps. Missiles crack it.',
  },
  wisp: { label: 'Fog Wisp', hp: 74, speed: 0.38, dps: 16, reward: 7, armor: 1, blurb: 'Hides in the fog' },
  skitter: { label: 'Night Skitter', hp: 44, speed: 1.42, dps: 14, reward: 8, armor: 1, blurb: 'Zips out of the dark' },
  moth: {
    label: 'Shell Moth',
    hp: 96,
    speed: 0.56,
    dps: 8,
    reward: 14,
    armor: 0.35,
    shell: true,
    flying: true,
    blurb: 'Flies over plain walls. Spikes snag it. Missiles crack the shell.',
  },
};

/** Critters the title always shows, before any level is cleared. */
export const BASE_CRITTERS: EnemyKind[] = ['blob', 'beetle', 'roller'];

export const CRITTER_ORDER: EnemyKind[] = ['blob', 'beetle', 'roller', 'pogo', 'crab', 'wisp', 'skitter', 'moth'];

/**
 * Clearing a level reveals one critter for later levels (title gallery).
 * The critter shows up in a later level's waves, not as a second mechanic on the level you just beat.
 */
export const REVEAL_ON_CLEAR: Partial<Record<LevelId, EnemyKind>> = {
  1: 'pogo',
  2: 'crab',
  3: 'wisp',
  4: 'skitter',
  5: 'moth',
};

export interface WaveDef {
  blob?: number;
  roller?: number;
  beetle?: number;
  pogo?: number;
  crab?: number;
  wisp?: number;
  skitter?: number;
  moth?: number;
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

/**
 * Longer than level 2. Bastions are merged (90 bricks from scratch, was a 70-brick
 * button), so the opener stash covers three of them and the late waves are a touch
 * looser than the button-Bastion version.
 */
export const WAVES_L3: WaveDef[] = [
  { blob: 6, pogo: 1, gap: 3.8 },
  { blob: 6, pogo: 3, beetle: 1, gap: 3.05 },
  { blob: 5, pogo: 4, beetle: 2, crab: 1, gap: 2.55 },
  { pogo: 5, roller: 3, beetle: 2, crab: 2, gap: 2.2 },
  { blob: 4, pogo: 6, roller: 4, beetle: 3, crab: 2, gap: 1.8 },
  { blob: 5, pogo: 7, roller: 4, beetle: 4, crab: 3, gap: 1.5 },
];

/** Fog lanes. Wisps are the critter. Blobs keep glue honest. A couple of shells late, not the lesson. */
export const WAVES_L4: WaveDef[] = [
  { wisp: 8, blob: 2, gap: 2.5 },
  { wisp: 6, beetle: 3, gap: 2.0 },
  { wisp: 8, beetle: 4, blob: 2, gap: 1.65 },
  { wisp: 8, beetle: 5, gap: 1.4 },
  { wisp: 9, beetle: 6, blob: 2, gap: 1.2 },
];

/** Night. Skitters are fast and fragile and hard to see until they cross midfield. */
export const WAVES_L5: WaveDef[] = [
  { skitter: 7, blob: 2, gap: 2.4 },
  { skitter: 9, blob: 2, gap: 1.9 },
  { skitter: 10, beetle: 2, gap: 1.6 },
  { skitter: 12, blob: 2, beetle: 2, gap: 1.35 },
  { skitter: 14, beetle: 3, gap: 1.15 },
];

/** Flying only. Shell moths ignore every tower except a Spike Wall. Studs tickle the shell; missiles crack it. */
export const WAVES_L6: WaveDef[] = [
  { moth: 5, gap: 3.1 },
  { moth: 8, gap: 2.2 },
  { moth: 10, gap: 1.7 },
  { moth: 12, gap: 1.4 },
  { moth: 14, gap: 1.15 },
];

/** Endless opener. Three merged Bastions (270) plus a few bricks, same shape as Level 3. */
export const ENDLESS_START_BRICKS = 280;

/**
 * Escalating quarry waves. Counts and the gap clamp so a late wave stays readable.
 * Endless always uses the full roster (every critter), even if the title gallery has not revealed them yet.
 */
export function endlessWave(index: number): WaveDef {
  const n = Math.max(0, index);
  return {
    blob: Math.min(14, 4 + n),
    pogo: Math.min(10, 1 + Math.floor(n * 0.55)),
    roller: n >= 1 ? Math.min(8, Math.floor(n * 0.6)) : 0,
    beetle: n >= 2 ? Math.min(7, Math.floor((n - 1) * 0.45)) : 0,
    crab: n >= 3 ? Math.min(6, Math.floor((n - 2) * 0.35)) : 0,
    wisp: n >= 2 ? Math.min(6, 1 + Math.floor((n - 2) * 0.35)) : 0,
    skitter: n >= 5 ? Math.min(8, 1 + Math.floor((n - 5) * 0.45)) : 0,
    moth: n >= 4 ? Math.min(8, 1 + Math.floor((n - 4) * 0.4)) : 0,
    gap: Math.max(1.05, 3.7 - n * 0.16),
  };
}

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

/** Thick fog on some lanes, or a dark far-lawn the critters step out of. */
export interface Veil {
  kind: 'fog' | 'night';
  /** Fog only. Night covers every lane. */
  rows?: readonly number[];
  /** Columns at and past this index are veiled. */
  fromCol: number;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  tagline: string;
  /** One line shown before the first tower is placed, and as the wave-1 toast. */
  intro: string;
  /**
   * Shown the whole ready phase when set (the one open hint).
   * Level 3 teaches Bastion. Level 6 teaches Missiler. Other levels use `intro`.
   */
  teach?: string;
  theme: Theme;
  tools: ToolKind[];
  waves: WaveDef[];
  startBricks: number;
  /** Max critters in a row that may share a lane. Level 1 stays at 2. */
  rowStreak: number;
  /** How many of the final waves bunch critters into the middle lanes. 0 keeps level 1 even. */
  hotWaves: number;
  /** Missiler, Sticky Barricade, Twin Shot, and Spike Wall. Off on Level 1 so the lawn stays Bastion-only. */
  extraMerges: boolean;
  /** Wave 1 lane list. Defaults to the middle lanes. */
  openingRows?: readonly number[];
  veil?: Veil;
  enemyMods?: Partial<Record<EnemyKind, EnemyMod>>;
  powers: LevelPowers;
}

const LATER_POWERS: LevelPowers = { beetleGlueImmune: true, rollerHopsWalls: true, blobRevives: true };

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
    extraMerges: false,
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
    extraMerges: true,
    enemyMods: {
      // Tough enough to reach walls and glue, so the new powers actually show up.
      blob: { hp: 100, speed: 0.52 },
      beetle: { hp: 200, speed: 0.32, armor: 0.5 },
      roller: { hp: 86, speed: 1.62 },
    },
    powers: LATER_POWERS,
  },
  3: {
    id: 3,
    name: 'Quarry Dusk',
    tagline: 'Merge a Wall and a Shooter',
    intro: 'Pogos spring, crabs chomp, and beetles ignore glue.',
    teach: 'Shooter on a Wall, or Wall on a Shooter, makes a Bastion. Pay only that piece.',
    theme: 'quarry',
    tools: ['wall', 'shooter', 'trap'],
    waves: WAVES_L3,
    // Three merged Bastions (3 × 90). Same opener shape as the old three 70-brick Bastions.
    startBricks: 270,
    rowStreak: 4,
    hotWaves: 3,
    extraMerges: true,
    enemyMods: {
      blob: { hp: 88, speed: 0.5 },
      beetle: { hp: 180, speed: 0.3, armor: 0.52 },
      roller: { hp: 76, speed: 1.5 },
      pogo: { hp: 64, speed: 0.9 },
      crab: { hp: 168, speed: 0.3, dps: 44 },
    },
    powers: LATER_POWERS,
  },
  4: {
    id: 4,
    name: 'Fog Lanes',
    tagline: 'The sides disappear',
    intro: 'Fog hides the side lanes. Traps still slow what you cannot see.',
    theme: 'fog',
    tools: ['wall', 'shooter', 'trap'],
    waves: WAVES_L4,
    startBricks: 180,
    rowStreak: 3,
    hotWaves: 2,
    extraMerges: true,
    openingRows: [0, 4, 0, 4, 1, 3, 0, 4],
    veil: { kind: 'fog', rows: [0, 4], fromCol: 3 },
    enemyMods: {
      blob: { hp: 84, speed: 0.48 },
      wisp: { hp: 100, speed: 0.5 },
      beetle: { hp: 170, speed: 0.32, armor: 0.5 },
    },
    powers: LATER_POWERS,
  },
  5: {
    id: 5,
    name: 'Night Map',
    tagline: 'The far lawn goes dark',
    intro: 'Night hides the far lawn. Skitters zip out of the dark!',
    theme: 'night',
    tools: ['wall', 'shooter', 'trap'],
    waves: WAVES_L5,
    startBricks: 160,
    rowStreak: 3,
    hotWaves: 2,
    extraMerges: true,
    openingRows: [0, 2, 4, 1, 3, 0, 4],
    veil: { kind: 'night', fromCol: 5 },
    enemyMods: {
      blob: { hp: 70, speed: 0.46 },
      skitter: { hp: 58, speed: 1.72 },
      beetle: { hp: 140, speed: 0.28, armor: 0.55 },
    },
    powers: LATER_POWERS,
  },
  6: {
    id: 6,
    name: 'Sky Moths',
    tagline: 'They fly over walls',
    intro: 'Shell moths fly over plain walls.',
    teach: 'Wall on a Wall snags moths. Shooter on a Trap cracks shells.',
    theme: 'sky',
    tools: ['wall', 'shooter', 'trap'],
    waves: WAVES_L6,
    // Three Missilers from scratch (3 × 80) is the idea; 200 forces a mix of shooters and one merge.
    startBricks: 200,
    rowStreak: 3,
    hotWaves: 2,
    extraMerges: true,
    openingRows: [2, 1, 3, 0, 4, 2, 1],
    enemyMods: {
      // A step down from 120 HP / 0.82 speed / 0.32 armor. Two missiles finish one (54 + 54).
      // Studs still only tickle (20 × 0.38). Speed is what used to blow past a short volley.
      moth: { hp: 100, speed: 0.7, armor: 0.38 },
    },
    powers: LATER_POWERS,
  },
};

export const LEVEL_IDS: LevelId[] = [1, 2, 3, 4, 5, 6];

export function nextLevelId(id: LevelId): LevelId | null {
  const i = LEVEL_IDS.indexOf(id);
  return i >= 0 && i < LEVEL_IDS.length - 1 ? LEVEL_IDS[i + 1] : null;
}
