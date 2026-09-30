import {
  COLS,
  ENEMIES,
  GLUE_LINGER,
  GLUE_SLOW,
  INTERMISSION,
  ROWS,
  SHOOTER_COOLDOWN,
  START_BRICKS,
  START_LIVES,
  STUD_DAMAGE,
  STUD_SPEED,
  TOWERS,
  TRICKLE_AMOUNT,
  TRICKLE_EVERY,
  WAVE_BONUS,
  WAVES,
  type EnemyKind,
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
}

export interface Stud {
  id: number;
  row: number;
  x: number;
}

export type GameEvent =
  | { type: 'hit'; row: number; x: number; armored: boolean }
  | { type: 'kill'; row: number; x: number; reward: number; kind: EnemyKind }
  | { type: 'leak'; row: number }
  | { type: 'place'; row: number; col: number; kind: TowerKind }
  | { type: 'crunch'; row: number; col: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number; bonus: number }
  | { type: 'bricks'; amount: number };

export type Phase = 'ready' | 'wave' | 'intermission' | 'won' | 'lost';
export type PlaceCheck = 'ok' | 'occupied' | 'bricks' | 'blocked';

interface Spawn {
  t: number;
  kind: EnemyKind;
  row: number;
}

// Wave 1 teaches the game: critters stick to the middle lanes so a starter stash covers them.
const FIRST_WAVE_ROWS = [2, 1, 3, 2, 1, 3];

export class Game {
  bricks = START_BRICKS;
  lives = START_LIVES;
  waveIndex = 0;
  phase: Phase = 'ready';
  grid: (Tower | null)[][];
  enemies: Enemy[] = [];
  studs: Stud[] = [];
  events: GameEvent[] = [];
  intermissionT = 0;
  time = 0;
  private spawns: Spawn[] = [];
  private waveTime = 0;
  private trickleT = 0;
  private nextId = 1;
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.grid = Array.from({ length: ROWS }, () => Array<Tower | null>(COLS).fill(null));
  }

  get totalWaves() {
    return WAVES.length;
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
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 'blocked';
    if (this.grid[row][col]) return 'occupied';
    if (this.bricks < TOWERS[kind].cost) return 'bricks';
    return 'ok';
  }

  place(kind: TowerKind, row: number, col: number): PlaceCheck {
    const check = this.canPlace(kind, row, col);
    if (check !== 'ok') return check;
    const stats = TOWERS[kind];
    this.bricks -= stats.cost;
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

  private buildWave(index: number): Spawn[] {
    const def = WAVES[index];
    const light: EnemyKind[] = [];
    for (let i = 0; i < def.blob; i++) light.push('blob');
    for (let i = 0; i < def.roller; i++) light.push('roller');
    shuffle(light, this.rng);
    // Beetles arrive in the back half so each wave ramps up.
    const kinds = [...light];
    for (let i = 0; i < def.beetle; i++) {
      const lo = Math.floor(kinds.length * 0.4);
      const pos = lo + Math.floor(this.rng() * (kinds.length - lo + 1));
      kinds.splice(pos, 0, 'beetle');
    }
    const out: Spawn[] = [];
    let t = 2;
    let lastRow = -1;
    let repeat = 0;
    const finalPushFrom = index === WAVES.length - 1 ? Math.floor(kinds.length * 0.7) : Infinity;
    kinds.forEach((kind, i) => {
      let row: number;
      if (index === 0) {
        row = FIRST_WAVE_ROWS[i % FIRST_WAVE_ROWS.length];
      } else {
        do {
          row = Math.floor(this.rng() * ROWS);
        } while (row === lastRow && repeat >= 1);
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
        const stats = ENEMIES[s.kind];
        this.enemies.push({
          id: this.nextId++,
          kind: s.kind,
          row: s.row,
          x: COLS + 0.45,
          hp: stats.hp,
          maxHp: stats.hp,
          slowT: 0,
          eating: false,
          hitT: 0,
          age: 0,
        });
      }
    }

    this.updateTowers(dt);
    this.updateStuds(dt);
    this.updateEnemies(dt);

    if (this.phase === 'wave' && this.spawns.length === 0 && this.enemies.length === 0) {
      if (this.waveIndex >= WAVES.length - 1) {
        this.phase = 'won';
      } else {
        this.bricks += WAVE_BONUS;
        this.events.push({ type: 'waveClear', wave: this.waveIndex, bonus: WAVE_BONUS });
        this.waveIndex++;
        this.phase = 'intermission';
        this.intermissionT = INTERMISSION;
      }
    }
  }

  private updateTowers(dt: number) {
    for (const t of this.towers()) {
      if (t.kind !== 'shooter') continue;
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const target = this.enemies.some((e) => e.row === t.row && e.x > t.col + 0.3 && e.x < COLS - 0.05);
      if (target) {
        this.studs.push({ id: this.nextId++, row: t.row, x: t.col + 0.85 });
        t.cooldown = SHOOTER_COOLDOWN;
        t.recoil = 1;
      }
    }
  }

  private updateStuds(dt: number) {
    const keep: Stud[] = [];
    for (const s of this.studs) {
      s.x += STUD_SPEED * dt;
      let target: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.row !== s.row || e.hp <= 0) continue;
        if (Math.abs(e.x - s.x) < 0.32 && (!target || e.x < target.x)) target = e;
      }
      if (target) {
        const stats = ENEMIES[target.kind];
        target.hp -= STUD_DAMAGE * stats.armor;
        target.hitT = 0.18;
        this.events.push({ type: 'hit', row: s.row, x: target.x, armored: stats.armor < 1 });
        if (target.hp <= 0) {
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

  private blockerFor(e: Enemy): Tower | null {
    const c0 = Math.floor(e.x - 0.3);
    for (let c = Math.min(COLS - 1, c0 + 1); c >= Math.max(0, c0 - 1); c--) {
      const t = this.grid[e.row][c];
      if (!t || t.kind === 'trap') continue;
      if (e.x > c + 0.5 && e.x - 0.3 <= c + 0.95) return t;
    }
    return null;
  }

  private updateEnemies(dt: number) {
    const keep: Enemy[] = [];
    for (const e of this.enemies) {
      const stats = ENEMIES[e.kind];
      e.age += dt;
      e.hitT = Math.max(0, e.hitT - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      const col = Math.floor(e.x);
      if (col >= 0 && col < COLS) {
        const t = this.grid[e.row][col];
        if (t?.kind === 'trap' && Math.abs(e.x - (col + 0.5)) < 0.45) e.slowT = GLUE_LINGER;
      }
      const blocker = this.blockerFor(e);
      e.eating = !!blocker;
      if (blocker) {
        blocker.hp -= stats.dps * dt;
        blocker.hitT = 0.12;
        if (blocker.hp <= 0) {
          this.grid[blocker.row][blocker.col] = null;
          this.events.push({ type: 'crunch', row: blocker.row, col: blocker.col });
        }
      } else {
        e.x -= stats.speed * (e.slowT > 0 ? GLUE_SLOW : 1) * dt;
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
