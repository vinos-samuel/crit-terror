import {
  BASE_CRITTERS,
  CRITTER_ORDER,
  LEVEL_IDS,
  REVEAL_ON_CLEAR,
  type EnemyKind,
  type LevelId,
} from './config';

/**
 * Campaign score (shown on a win):
 *
 *   brickPoints = min(bricks left, 250)
 *   thrift      = max(0, 700 - 28 * towersBuilt - 22 * bastionsBuilt)
 *   style       = lives * 500 + brickPoints + thrift
 *   score       = style + wavesCleared * 200
 *
 * `towersBuilt` counts pieces snapped onto empty squares.
 * `bastionsBuilt` counts every merge (Bastion, Missiler, Sticky Barricade, Twin Shot).
 * The dropped piece is not a second tower. The thrift penalty is the same for each merge.
 * Stars use `style` so a longer level does not get free stars just for having more waves:
 *   3 stars at style >= 1880, 2 stars at style >= 950, otherwise 1 star for the win.
 * A full build with 3 lives and a full brick bonus (style 1750, thrift 0) is 2 stars.
 * 3 stars needs lives in the bank and a smaller build.
 *
 * Endless score (shown when the run ends):
 *
 *   score = wavesCleared * 500 + lives * 150 + min(bricks, 200)
 *         + max(0, 400 - 12 * towersBuilt - 8 * bastionsBuilt)
 *
 * Endless "wave reached" is the 1-based wave you were on when the run ended.
 */

export const STAR_3_STYLE = 1880;
export const STAR_2_STYLE = 950;
const BRICK_CAP = 250;
const THRIFT_POOL = 700;
const TOWER_PENALTY = 28;
const BASTION_PENALTY = 22;

const STORAGE_KEY = 'crit-terror.records.v1';

export interface ScoreInput {
  lives: number;
  bricks: number;
  wavesCleared: number;
  towersBuilt: number;
  bastionsBuilt: number;
}

export interface CampaignScore {
  score: number;
  stars: 1 | 2 | 3;
  style: number;
}

export interface LevelBest {
  score: number;
  stars: 1 | 2 | 3;
}

export interface EndlessBest {
  wave: number;
  score: number;
}

export interface Records {
  levels: Partial<Record<LevelId, LevelBest>>;
  endless?: EndlessBest;
  /** Highest campaign level that can be started. Level 1 is always open. Endless is never gated. */
  unlockedLevel: LevelId;
  /** Critters revealed on the title gallery. Endless still spawns the full roster. */
  critters: EnemyKind[];
}

export interface RunOutcome {
  score: number;
  stars: 0 | 1 | 2 | 3;
  wave: number;
  bestScore: number;
  bestStars: number;
  bestWave: number;
  newScore: boolean;
  newWave: boolean;
  /** Critter revealed by this clear, if it is the first time. */
  revealed?: EnemyKind;
}

export function formatScore(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US');
}

function brickPoints(bricks: number, cap: number) {
  return Math.min(cap, Math.max(0, Math.floor(bricks)));
}

function thriftPoints(towersBuilt: number, bastionsBuilt: number, pool: number, towerPenalty: number, bastionPenalty: number) {
  const spent = Math.max(0, towersBuilt) * towerPenalty + Math.max(0, bastionsBuilt) * bastionPenalty;
  return Math.max(0, pool - spent);
}

export function campaignScore(input: ScoreInput): CampaignScore {
  const bricks = brickPoints(input.bricks, BRICK_CAP);
  const thrift = thriftPoints(input.towersBuilt, input.bastionsBuilt, THRIFT_POOL, TOWER_PENALTY, BASTION_PENALTY);
  const lives = Math.max(0, input.lives) * 500;
  const style = lives + bricks + thrift;
  const score = style + Math.max(0, input.wavesCleared) * 200;
  const stars: 1 | 2 | 3 = style >= STAR_3_STYLE ? 3 : style >= STAR_2_STYLE ? 2 : 1;
  return { score, stars, style };
}

export function endlessScore(input: ScoreInput): number {
  const thrift = thriftPoints(input.towersBuilt, input.bastionsBuilt, 400, 12, 8);
  return (
    Math.max(0, input.wavesCleared) * 500 +
    Math.max(0, input.lives) * 150 +
    brickPoints(input.bricks, 200) +
    thrift
  );
}

function emptyRecords(): Records {
  return { levels: {}, unlockedLevel: 1, critters: [...BASE_CRITTERS] };
}

export function isLevelUnlocked(records: Records, id: LevelId) {
  return id <= records.unlockedLevel;
}

function applyUnlocks(records: Records): { records: Records; changed: boolean } {
  let unlocked: LevelId = records.unlockedLevel ?? 1;
  const critters = new Set<EnemyKind>(records.critters?.length ? records.critters : BASE_CRITTERS);
  for (const id of BASE_CRITTERS) critters.add(id);
  let changed = false;
  for (const id of LEVEL_IDS) {
    if (!records.levels[id]) continue;
    const next = Math.min(6, id + 1) as LevelId;
    if (next > unlocked) {
      unlocked = next;
      changed = true;
    }
    const reveal = REVEAL_ON_CLEAR[id];
    if (reveal && !critters.has(reveal)) {
      critters.add(reveal);
      changed = true;
    }
  }
  if ((records.unlockedLevel ?? 1) !== unlocked) changed = true;
  const ordered = CRITTER_ORDER.filter((k) => critters.has(k));
  if (ordered.length !== (records.critters?.length ?? 0)) changed = true;
  return {
    records: { ...records, unlockedLevel: unlocked, critters: ordered },
    changed,
  };
}

export function loadRecords(): Records {
  try {
    if (typeof localStorage === 'undefined') return emptyRecords();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyRecords();
    const data = JSON.parse(raw) as Partial<Records>;
    const levels: Records['levels'] = {};
    for (const id of LEVEL_IDS) {
      const row = data.levels?.[id];
      if (!row || !Number.isFinite(row.score) || row.score < 0) continue;
      if (row.stars !== 1 && row.stars !== 2 && row.stars !== 3) continue;
      levels[id] = { score: Math.floor(row.score), stars: row.stars };
    }
    let endless: EndlessBest | undefined;
    if (data.endless && Number.isFinite(data.endless.wave) && Number.isFinite(data.endless.score) && data.endless.wave > 0) {
      endless = {
        wave: Math.floor(data.endless.wave),
        score: Math.max(0, Math.floor(data.endless.score)),
      };
    }
    const critters = CRITTER_ORDER.filter((k) => Array.isArray(data.critters) && data.critters.includes(k));
    const unlockedLevel = LEVEL_IDS.includes(data.unlockedLevel as LevelId) ? (data.unlockedLevel as LevelId) : 1;
    return applyUnlocks({ levels, endless, unlockedLevel, critters: critters.length ? critters : [...BASE_CRITTERS] }).records;
  } catch {
    return emptyRecords();
  }
}

function saveRecords(records: Records) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Private mode and full disks still show this run's score.
  }
}

export function recordLevel(
  records: Records,
  level: LevelId,
  score: number,
  stars: 1 | 2 | 3,
): { records: Records; best: LevelBest; isNew: boolean; revealed?: EnemyKind } {
  const prev = records.levels[level];
  const isNew = !prev || score > prev.score;
  const firstClear = !prev;
  const withScore: Records = isNew ? { ...records, levels: { ...records.levels, [level]: { score, stars } } } : records;
  const unlocked = applyUnlocks(withScore);
  const revealed = firstClear ? REVEAL_ON_CLEAR[level] : undefined;
  if (isNew || unlocked.changed) saveRecords(unlocked.records);
  return { records: unlocked.records, best: unlocked.records.levels[level]!, isNew, revealed };
}

export function recordEndless(
  records: Records,
  wave: number,
  score: number,
): { records: Records; best: EndlessBest; newWave: boolean; newScore: boolean } {
  const prev = records.endless;
  const newWave = !prev || wave > prev.wave;
  const newScore = !prev || score > prev.score;
  const best: EndlessBest = {
    wave: Math.max(wave, prev?.wave ?? 0),
    score: Math.max(score, prev?.score ?? 0),
  };
  const next: Records = { ...records, endless: best };
  if (newWave || newScore) saveRecords(next);
  return { records: next, best, newWave, newScore };
}
