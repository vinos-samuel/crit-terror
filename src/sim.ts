import {
  COLS,
  ENDLESS_START_BRICKS,
  ENEMIES,
  GLUE_LINGER,
  GLUE_SLOW,
  HOP_DIST,
  HOP_DUR,
  INTERMISSION,
  LEVELS,
  MISSILE_COOLDOWN,
  MISSILE_SHELL,
  MISSILE_SOFT,
  MISSILE_SPEED,
  POGO_HOP_DIST,
  POGO_HOP_DUR,
  REVIVE_HP,
  REVIVE_PAUSE,
  REVIVE_SPEED,
  ROWS,
  SHOOTER_COOLDOWN,
  START_LIVES,
  STUD_DAMAGE,
  STUD_SPEED,
  TOWERS,
  TRICKLE_AMOUNT,
  TRICKLE_EVERY,
  WAVE_BONUS,
  endlessWave,
  mergeInto,
  type EnemyKind,
  type LevelId,
  type MergeKind,
  type Theme,
  type TowerKind,
} from './config';

export interface Tower {
  id: number;
  kind: TowerKind;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  recoil: number;
  hitT: number;
  placedT: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  row: number;
  /** Center position in column units; the lawn spans 0..COLS. */
  x: number;
  hp: number;
  maxHp: number;
  slowT: number;
  eating: boolean;
  hitT: number;
  age: number;
  /** True after a Soft Blob has used its one revival. */
  revived: boolean;
  /** Seconds left in the "popping back up" pause. */
  reviveT: number;
  /** Speed multiplier. Revived blobs scurry. */
  rage: number;
  /** Seconds left in a hop arc. 0 when on the ground. */
  hopT: number;
  hopMax: number;
  /** Lane column that already showed the beetle's glue shrug. */
  shrugCol: number;
}

export interface Stud {
  id: number;
  row: number;
  x: number;
  missile?: boolean;
}

export type GameEvent =
  | { type: 'hit'; row: number; x: number; armored: boolean; missile: boolean; shell: boolean }
  | { type: 'kill'; row: number; x: number; reward: number; kind: EnemyKind }
  | { type: 'leak'; row: number }
  | { type: 'place'; row: number; col: number; kind: TowerKind }
  | { type: 'merge'; row: number; col: number; paid: number; into: MergeKind }
  | { type: 'crunch'; row: number; col: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number; bonus: number }
  | { type: 'bricks'; amount: number }
  | { type: 'revive'; row: number; x: number }
  | { type: 'hop'; row: number; x: number; kind: EnemyKind }
  | { type: 'shrug'; row: number; x: number };

export type Phase = 'ready' | 'wave' | 'intermission' | 'won' | 'lost';
export type PlaceCheck = 'ok' | 'occupied' | 'bricks' | 'blocked';

interface Spawn {
  t: number;
  kind: EnemyKind;
  row: number;
}

// Wave 1 teaches the game: critters stick to the middle lanes so a starter stash covers them.
const FIRST_WAVE_ROWS = [2, 1, 3, 2, 1, 3];

const LIGHT: EnemyKind[] = ['blob', 'roller', 'pogo', 'wisp', 'skitter', 'moth'];
const HEAVY: EnemyKind[] = ['beetle', 'crab'];

export class Game {
  bricks: number;
  lives = START_LIVES;
  waveIndex = 0;
  phase: Phase = 'ready';
  grid: (Tower | null)[][];
  enemies: Enemy[] = [];
  studs: Stud[] = [];
  events: GameEvent[] = [];
  intermissionT = 0;
  time = 0;
  readonly levelId: LevelId;
  /**
   * Infinite quarry waves. Uses Level 3 powers, map, and critter mods.
   * The roster is the full critter list (see `endlessWave`), not the title unlocks.
   */
  readonly endless: boolean;
  /** Pieces snapped onto empty squares. A merge does not increment this. */
  towersBuilt = 0;
  /**
   * Merges (Bastion, Missiler, Sticky Barricade, Twin Shot).
   * The dropped piece is counted here, not in `towersBuilt`.
   * Scoring still reads this field — every merge pays the old Bastion thrift penalty.
   */
  bastionsBuilt = 0;
  private spawns: Spawn[] = [];
  private waveTime = 0;
  private trickleT = 0;
  private nextId = 1;
  private rng: () => number;

  constructor(rng: () => number = Math.random, levelId: LevelId = 1, endless = false) {
    this.rng = rng;
    this.endless = endless;
    this.levelId = endless ? 3 : levelId;
    this.bricks = endless ? ENDLESS_START_BRICKS : LEVELS[this.levelId].startBricks;
    this.grid = Array.from({ length: ROWS }, () => Array<Tower | null>(COLS).fill(null));
  }

  get level() {
    return LEVELS[this.levelId];
  }

  get theme(): Theme {
    return this.level.theme;
  }

  get toolOrder() {
    return this.level.tools;
  }

  get totalWaves() {
    return this.endless ? Number.POSITIVE_INFINITY : this.level.waves.length;
  }

  get remaining() {
    return this.spawns.length + this.enemies.length;
  }

  towers(): Tower[] {
    const out: Tower[] = [];
    for (const row of this.grid) for (const t of row) if (t) out.push(t);
    return out;
  }

  canPlace(kind: TowerKind, row: number, col: number): PlaceCheck {
    if (this.phase === 'won' || this.phase === 'lost') return 'blocked';
    if (kind !== 'wall' && kind !== 'shooter' && kind !== 'trap') return 'blocked';
    if (!this.toolOrder.includes(kind)) return 'blocked';
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 'blocked';
    const existing = this.grid[row][col];
    if (existing && !mergeInto(kind, existing.kind, this.level.extraMerges)) return 'occupied';
    if (this.bricks < TOWERS[kind].cost) return 'bricks';
    return 'ok';
  }

  place(kind: TowerKind, row: number, col: number): PlaceCheck {
    const check = this.canPlace(kind, row, col);
    if (check !== 'ok') return check;
    const existing = this.grid[row][col];
    const cost = TOWERS[kind].cost;
    this.bricks -= cost;
    const into = existing ? mergeInto(kind, existing.kind, this.level.extraMerges) : null;
    if (existing && into) {
      const stats = TOWERS[into];
      existing.kind = into;
      existing.hp = stats.hp;
      existing.maxHp = stats.hp;
      existing.cooldown = 0.25;
      existing.recoil = 0;
      existing.hitT = 0;
      existing.placedT = 0;
      this.bastionsBuilt++;
      this.events.push({ type: 'merge', row, col, paid: cost, into });
      return 'ok';
    }
    const stats = TOWERS[kind];
    this.grid[row][col] = {
      id: this.nextId++,
      kind,
      row,
      col,
      hp: stats.hp,
      maxHp: stats.hp,
      cooldown: 0.3,
      recoil: 0,
      hitT: 0,
      placedT: 0,
    };
    this.towersBuilt++;
    this.events.push({ type: 'place', row, col, kind });
    return 'ok';
  }

  startWave() {
    if (this.phase !== 'ready' && this.phase !== 'intermission') return;
    this.phase = 'wave';
    this.waveTime = 0;
    this.trickleT = 0;
    this.spawns = this.buildWave(this.waveIndex);
    this.events.push({ type: 'waveStart', wave: this.waveIndex });
  }

  private countOf(def: { [K in EnemyKind]?: number }, kind: EnemyKind) {
    return def[kind] ?? 0;
  }

  private buildWave(index: number): Spawn[] {
    const def = this.endless ? endlessWave(index) : this.level.waves[index];
    const light: EnemyKind[] = [];
    for (const kind of LIGHT) {
      for (let i = 0; i < this.countOf(def, kind); i++) light.push(kind);
    }
    shuffle(light, this.rng);
    // Heavy critters arrive in the back half so each wave ramps up.
    const kinds = [...light];
    for (const kind of HEAVY) {
      for (let i = 0; i < this.countOf(def, kind); i++) {
        const lo = Math.floor(kinds.length * 0.4);
        const pos = lo + Math.floor(this.rng() * (kinds.length - lo + 1));
        kinds.splice(pos, 0, kind);
      }
    }
    const out: Spawn[] = [];
    let t = 2;
    let lastRow = -1;
    let repeat = 0;
    const streakCap = this.level.rowStreak - 1;
    const finalPushFrom =
      this.endless || index === this.level.waves.length - 1 ? Math.floor(kinds.length * 0.7) : Infinity;
    const hot = this.endless
      ? index >= 3
      : this.level.hotWaves > 0 && index >= this.level.waves.length - this.level.hotWaves;
    const opening = this.level.openingRows ?? FIRST_WAVE_ROWS;
    kinds.forEach((kind, i) => {
      let row: number;
      if (index === 0) {
        row = opening[i % opening.length];
      } else if (hot && this.rng() < 0.62) {
        row = 1 + Math.floor(this.rng() * 3);
      } else {
        do {
          row = Math.floor(this.rng() * ROWS);
        } while (row === lastRow && repeat >= streakCap);
      }
      repeat = row === lastRow ? repeat + 1 : 0;
      lastRow = row;
      out.push({ t, kind, row });
      const gap = i >= finalPushFrom ? def.gap * 0.5 : def.gap;
      t += gap * (0.75 + this.rng() * 0.5);
    });
    return out;
  }

  update(dt: number) {
    this.time += dt;
    if (this.phase === 'won' || this.phase === 'lost') return;

    for (const t of this.towers()) {
      t.hitT = Math.max(0, t.hitT - dt);
      t.recoil = Math.max(0, t.recoil - dt * 5);
      t.placedT += dt;
    }

    if (this.phase === 'intermission') {
      this.intermissionT -= dt;
      if (this.intermissionT <= 0) this.startWave();
    }

    if (this.phase === 'wave') {
      this.waveTime += dt;
      this.trickleT += dt;
      while (this.trickleT >= TRICKLE_EVERY) {
        this.trickleT -= TRICKLE_EVERY;
        this.bricks += TRICKLE_AMOUNT;
        this.events.push({ type: 'bricks', amount: TRICKLE_AMOUNT });
      }
      while (this.spawns.length && this.spawns[0].t <= this.waveTime) {
        const s = this.spawns.shift()!;
        this.spawn(s.kind, s.row, COLS + 0.45);
      }
    }

    this.updateTowers(dt);
    this.updateStuds(dt);
    this.updateEnemies(dt);

    if (this.phase === 'wave' && this.spawns.length === 0 && this.enemies.length === 0) {
      const bonus = this.endless ? WAVE_BONUS + Math.min(80, this.waveIndex * 6) : WAVE_BONUS;
      if (!this.endless && this.waveIndex >= this.level.waves.length - 1) {
        this.phase = 'won';
      } else {
        this.bricks += bonus;
        this.events.push({ type: 'waveClear', wave: this.waveIndex, bonus });
        this.waveIndex++;
        this.phase = 'intermission';
        this.intermissionT = INTERMISSION;
      }
    }
  }

  /** Used by the screenshot tableau to drop a critter in mid-animation. */
  insertEnemy(kind: EnemyKind, row: number, x: number, extra: Partial<Enemy> = {}): Enemy {
    return this.spawn(kind, row, x, extra);
  }

  private statsFor(kind: EnemyKind) {
    const base = ENEMIES[kind];
    const mod = this.level.enemyMods?.[kind];
    const stats = mod ? { ...base, ...mod } : base;
    if (!this.endless || this.waveIndex === 0) return stats;
    const n = this.waveIndex;
    return {
      ...stats,
      hp: Math.round(stats.hp * (1 + n * 0.05)),
      speed: stats.speed * (1 + Math.min(0.22, n * 0.012)),
      dps: Math.round(stats.dps * (1 + n * 0.03)),
      reward: Math.round(stats.reward * (1 + n * 0.05)),
    };
  }

  private spawn(kind: EnemyKind, row: number, x: number, extra: Partial<Enemy> = {}): Enemy {
    const stats = this.statsFor(kind);
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      row,
      x,
      hp: stats.hp,
      maxHp: stats.hp,
      slowT: 0,
      eating: false,
      hitT: 0,
      age: 0,
      revived: false,
      reviveT: 0,
      rage: 1,
      hopT: 0,
      hopMax: 0,
      shrugCol: -1,
      ...extra,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private shoots(kind: TowerKind) {
    return kind === 'shooter' || kind === 'bastion' || kind === 'missiler' || kind === 'twin';
  }

  private updateTowers(dt: number) {
    for (const t of this.towers()) {
      if (!this.shoots(t.kind)) continue;
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const target = this.enemies.some((e) => e.row === t.row && e.x > t.col + 0.3 && e.x < COLS - 0.05);
      if (target) {
        const missile = t.kind === 'missiler';
        const shots = t.kind === 'twin' ? 2 : 1;
        for (let i = 0; i < shots; i++) {
          this.studs.push({ id: this.nextId++, row: t.row, x: t.col + 0.85 - i * 0.42, missile });
        }
        t.cooldown = missile ? MISSILE_COOLDOWN : SHOOTER_COOLDOWN;
        t.recoil = 1;
      }
    }
  }

  private armorOf(target: Enemy) {
    const stats = this.statsFor(target.kind);
    if (!target.eating && stats.moveArmor !== undefined) return stats.moveArmor;
    return stats.armor;
  }

  /** Soft Blob pops back up once. Returns true if this death was cancelled. */
  private tryRevive(target: Enemy): boolean {
    if (target.kind !== 'blob' || !this.level.powers.blobRevives || target.revived) return false;
    const stats = this.statsFor('blob');
    target.revived = true;
    target.hp = Math.max(8, Math.round(stats.hp * REVIVE_HP));
    target.reviveT = REVIVE_PAUSE;
    target.rage = REVIVE_SPEED;
    target.hitT = 0.2;
    target.eating = false;
    this.events.push({ type: 'revive', row: target.row, x: target.x });
    return true;
  }

  private updateStuds(dt: number) {
    const keep: Stud[] = [];
    for (const s of this.studs) {
      s.x += (s.missile ? MISSILE_SPEED : STUD_SPEED) * dt;
      let target: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.row !== s.row || e.hp <= 0) continue;
        if (Math.abs(e.x - s.x) < 0.32 && (!target || e.x < target.x)) target = e;
      }
      if (target) {
        const stats = this.statsFor(target.kind);
        const armor = this.armorOf(target);
        const shell = !!stats.shell;
        const damage = s.missile ? (shell ? MISSILE_SHELL : MISSILE_SOFT * armor) : STUD_DAMAGE * armor;
        target.hp -= damage;
        target.hitT = 0.18;
        this.events.push({ type: 'hit', row: s.row, x: target.x, armored: !s.missile && armor < 1, missile: !!s.missile, shell });
        if (target.hp <= 0 && !this.tryRevive(target)) {
          this.bricks += stats.reward;
          this.events.push({ type: 'kill', row: target.row, x: target.x, reward: stats.reward, kind: target.kind });
        }
        continue;
      }
      if (s.x < COLS + 0.2) keep.push(s);
    }
    this.studs = keep;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  private flies(e: Enemy) {
    return !!this.statsFor(e.kind).flying;
  }

  private blockerFor(e: Enemy): Tower | null {
    if (this.flies(e)) return null;
    const c0 = Math.floor(e.x - 0.3);
    for (let c = Math.min(COLS - 1, c0 + 1); c >= Math.max(0, c0 - 1); c--) {
      const t = this.grid[e.row][c];
      if (!t || t.kind === 'trap') continue;
      if (e.x > c + 0.5 && e.x - 0.3 <= c + 0.95) return t;
    }
    return null;
  }

  /** Sticky Barricade gums critters in the next squares and the lanes beside it. */
  private nearSticky(e: Enemy) {
    if (this.flies(e)) return false;
    const col = Math.floor(e.x);
    for (const dc of [-1, 0, 1]) {
      const c = col + dc;
      if (c < 0 || c >= COLS) continue;
      const t = this.grid[e.row][c];
      if (t?.kind === 'sticky' && Math.abs(e.x - (c + 0.5)) < 1.15) return true;
    }
    for (const dr of [-1, 1]) {
      const r = e.row + dr;
      if (r < 0 || r >= ROWS) continue;
      if (col < 0 || col >= COLS) continue;
      const t = this.grid[r][col];
      if (t?.kind === 'sticky' && Math.abs(e.x - (col + 0.5)) < 0.7) return true;
    }
    return false;
  }

  private glueImmune(e: Enemy) {
    return e.kind === 'beetle' && this.level.powers.beetleGlueImmune;
  }

  private canHop(e: Enemy, blocker: Tower) {
    if (e.kind === 'pogo') return true;
    return e.kind === 'roller' && this.level.powers.rollerHopsWalls && blocker.kind === 'wall';
  }

  private beginHop(e: Enemy) {
    const dur = e.kind === 'pogo' ? POGO_HOP_DUR : HOP_DUR;
    e.hopT = dur;
    e.hopMax = dur;
    e.eating = false;
    this.events.push({ type: 'hop', row: e.row, x: e.x, kind: e.kind });
  }

  private hopSpeed(e: Enemy) {
    const dist = e.kind === 'pogo' ? POGO_HOP_DIST : HOP_DIST;
    const dur = e.kind === 'pogo' ? POGO_HOP_DUR : HOP_DUR;
    return dist / dur;
  }

  private updateEnemies(dt: number) {
    const keep: Enemy[] = [];
    for (const e of this.enemies) {
      const stats = this.statsFor(e.kind);
      e.age += dt;
      e.hitT = Math.max(0, e.hitT - dt);
      e.slowT = Math.max(0, e.slowT - dt);

      if (e.hopT > 0) {
        e.hopT = Math.max(0, e.hopT - dt);
        e.eating = false;
        e.x -= this.hopSpeed(e) * dt;
      } else if (e.reviveT > 0) {
        e.reviveT = Math.max(0, e.reviveT - dt);
        e.eating = false;
      } else {
        const col = Math.floor(e.x);
        if (!this.flies(e) && col >= 0 && col < COLS) {
          const t = this.grid[e.row][col];
          const onTrap = t?.kind === 'trap' && Math.abs(e.x - (col + 0.5)) < 0.45;
          if (onTrap && this.glueImmune(e)) {
            if (e.shrugCol !== col) {
              e.shrugCol = col;
              this.events.push({ type: 'shrug', row: e.row, x: e.x });
            }
          } else if ((onTrap || this.nearSticky(e)) && !this.glueImmune(e)) {
            e.slowT = GLUE_LINGER;
          }
        }
        const blocker = this.blockerFor(e);
        if (blocker && this.canHop(e, blocker)) {
          this.beginHop(e);
        } else {
          e.eating = !!blocker;
          if (blocker) {
            blocker.hp -= stats.dps * dt;
            blocker.hitT = 0.12;
            if (blocker.hp <= 0) {
              this.grid[blocker.row][blocker.col] = null;
              this.events.push({ type: 'crunch', row: blocker.row, col: blocker.col });
            }
          } else {
            e.x -= stats.speed * e.rage * (e.slowT > 0 ? GLUE_SLOW : 1) * dt;
          }
        }
      }

      if (e.x < -0.4) {
        this.lives--;
        this.events.push({ type: 'leak', row: e.row });
        if (this.lives <= 0) {
          this.lives = 0;
          this.phase = 'lost';
        }
        continue;
      }
      keep.push(e);
    }
    this.enemies = keep;
  }

  drainEvents(): GameEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}

function shuffle<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * A still scene for screenshots: towers down, powers mid-animation, sim not required to be running.
 * Bricks are topped up so the tableau can place a full lane of towers.
 */
export function makeShowcase(levelId: 2 | 3 | 4 | 5 | 6): Game {
  const g = new Game(() => 0.5, levelId);
  g.bricks = 4000;
  if (levelId === 2) {
    for (const row of [0, 1, 2, 3, 4]) {
      g.place('shooter', row, 1);
      g.place('wall', row, 4);
      g.place('trap', row, 6);
    }
    g.place('shooter', 2, 2);
    g.insertEnemy('roller', 2, 4.92, { hopT: HOP_DUR * 0.55, hopMax: HOP_DUR, age: 1.6 });
    g.insertEnemy('beetle', 1, 6.5, { age: 2.1, shrugCol: 6 });
    g.insertEnemy('blob', 3, 3.15, {
      age: 2.4,
      revived: true,
      reviveT: REVIVE_PAUSE * 0.72,
      rage: REVIVE_SPEED,
      hp: Math.round(ENEMIES.blob.hp * REVIVE_HP),
    });
    g.insertEnemy('blob', 0, 7.6, { age: 1.1 });
    g.insertEnemy('roller', 4, 8.15, { age: 0.8 });
    g.studs.push({ id: 9001, row: 2, x: 3.15 });
  } else if (levelId === 3) {
    for (const row of [0, 1, 2, 3, 4]) {
      g.place('wall', row, 2);
      g.place('shooter', row, 2);
      g.place('trap', row, 5);
    }
    g.place('wall', 2, 4);
    g.place('wall', 1, 1);
    g.place('shooter', 1, 1);
    g.insertEnemy('pogo', 1, 2.95, { hopT: POGO_HOP_DUR * 0.5, hopMax: POGO_HOP_DUR, age: 1.8 });
    g.insertEnemy('crab', 2, 4.2, { eating: true, age: 3, hp: 110 });
    g.insertEnemy('crab', 3, 7.35, { age: 1.2 });
    g.insertEnemy('pogo', 0, 6.5, { age: 0.9 });
    g.insertEnemy('beetle', 4, 5.5, { age: 1.7, shrugCol: 5 });
    g.insertEnemy('blob', 1, 8.2, { age: 0.6 });
    g.studs.push({ id: 9002, row: 1, x: 2.7 });
    g.studs.push({ id: 9003, row: 2, x: 3.4 });
  } else if (levelId === 4) {
    for (const row of [0, 4]) {
      g.place('trap', row, 5);
      g.place('shooter', row, 2);
    }
    g.place('wall', 2, 3);
    g.place('trap', 2, 3);
    g.place('shooter', 1, 1);
    g.place('shooter', 3, 1);
    g.insertEnemy('wisp', 0, 6.4, { age: 1.4 });
    g.insertEnemy('wisp', 4, 7.2, { age: 1.1 });
    g.insertEnemy('wisp', 0, 2.4, { age: 2.2, slowT: 0.8 });
    g.insertEnemy('blob', 2, 5.5, { age: 1.6 });
    g.insertEnemy('beetle', 1, 7.8, { age: 0.8 });
    g.studs.push({ id: 9004, row: 0, x: 3.2 });
  } else if (levelId === 5) {
    for (const row of [1, 2, 3]) g.place('shooter', row, 1);
    g.place('wall', 2, 3);
    g.place('shooter', 0, 2);
    g.place('trap', 4, 4);
    g.insertEnemy('skitter', 1, 6.8, { age: 0.6 });
    g.insertEnemy('skitter', 2, 7.6, { age: 0.4 });
    g.insertEnemy('skitter', 3, 4.2, { age: 1.5 });
    g.insertEnemy('blob', 0, 6.2, { age: 1.2 });
    g.insertEnemy('beetle', 4, 7.4, { age: 0.9 });
    g.studs.push({ id: 9005, row: 2, x: 3.1 });
  } else {
    for (const row of [1, 2, 3]) {
      g.place('trap', row, 2);
      g.place('shooter', row, 2);
    }
    g.place('wall', 0, 3);
    g.place('wall', 4, 4);
    g.place('shooter', 0, 1);
    g.insertEnemy('moth', 2, 6.4, { age: 1.3, hp: 40 });
    g.insertEnemy('moth', 1, 7.5, { age: 0.7 });
    g.insertEnemy('moth', 3, 5.2, { age: 1.8 });
    g.insertEnemy('moth', 0, 8.1, { age: 0.4 });
    g.studs.push({ id: 9006, row: 2, x: 4.2, missile: true });
    g.studs.push({ id: 9007, row: 1, x: 3.4, missile: true });
  }
  for (const t of g.towers()) t.placedT = 8;
  g.bricks = levelId === 2 ? 85 : levelId === 6 ? 70 : 110;
  g.lives = 2;
  g.waveIndex = levelId === 2 ? 2 : 3;
  g.phase = 'wave';
  g.events = [];
  return g;
}
