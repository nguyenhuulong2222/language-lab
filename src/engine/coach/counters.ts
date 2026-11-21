/**
 * src/engine/coach/counters.ts
 *
 * Counters of the AI coach on a Cloudflare D1 database bound as COACH_DB (spec REQ-C12). Each
 * increment is one statement that adds 1 only while the count is under its limit, so concurrent
 * requests cannot pass a limit. Spend is kept in micro-dollars and reserved before a call.
 *
 * `D1Like` is the small part of the D1 binding this file uses, so tests can run the same SQL on
 * Node's built-in SQLite. Pure module apart from the database it is given.
 */

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
}

export interface CounterStore {
  /** Add 1 if the count is under `limit`. False when the limit is reached (nothing added). */
  increment(key: string, day: string, limit: number): Promise<boolean>;
  /** Reserve `micro` against `capMicro`. False when it would pass the cap (nothing reserved). */
  reserve(key: string, day: string, micro: number, capMicro: number): Promise<boolean>;
  /** Give back part of a reserve once the actual cost is known. */
  refund(key: string, micro: number): Promise<void>;
  /** Delete up to `batch` rows of days before `keepFromDay`. */
  cleanup(keepFromDay: string, batch: number): Promise<void>;
}

export const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS coach_counters (
  key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  micro_usd INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS coach_counters_day ON coach_counters(day);`;

const INCREMENT_SQL =
  "INSERT INTO coach_counters (key, day, count) VALUES (?1, ?2, 1) " +
  "ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < ?3 RETURNING count";
const RESERVE_SQL =
  "INSERT INTO coach_counters (key, day, count, micro_usd) VALUES (?1, ?2, 0, ?3) " +
  "ON CONFLICT(key) DO UPDATE SET micro_usd = micro_usd + ?3 WHERE micro_usd + ?3 <= ?4 RETURNING micro_usd";
const REFUND_SQL = "UPDATE coach_counters SET micro_usd = MAX(0, micro_usd - ?2) WHERE key = ?1";
const CLEANUP_SQL = "DELETE FROM coach_counters WHERE key IN (SELECT key FROM coach_counters WHERE day < ?1 LIMIT ?2)";

export function createD1CounterStore(db: D1Like): CounterStore {
  return {
    async increment(key, day, limit) {
      if (limit < 1) return false;
      const row = await db.prepare(INCREMENT_SQL).bind(key, day, limit).first<{ count: number }>();
      return row !== null;
    },
    async reserve(key, day, micro, capMicro) {
      if (micro > capMicro) return false;
      const row = await db.prepare(RESERVE_SQL).bind(key, day, micro, capMicro).first<{ micro_usd: number }>();
      return row !== null;
    },
    async refund(key, micro) {
      if (micro <= 0) return;
      await db.prepare(REFUND_SQL).bind(key, micro).run();
    },
    async cleanup(keepFromDay, batch) {
      await db.prepare(CLEANUP_SQL).bind(keepFromDay, batch).run();
    },
  };
}

/** In-memory store with the same rules, for tests of the handler. */
export function createMemoryCounterStore(): CounterStore & { rows: Map<string, { day: string; count: number; micro: number }> } {
  const rows = new Map<string, { day: string; count: number; micro: number }>();
  return {
    rows,
    async increment(key, day, limit) {
      const row = rows.get(key) ?? { day, count: 0, micro: 0 };
      if (row.count >= limit) return false;
      row.count += 1;
      rows.set(key, row);
      return true;
    },
    async reserve(key, day, micro, capMicro) {
      const row = rows.get(key) ?? { day, count: 0, micro: 0 };
      if (row.micro + micro > capMicro) return false;
      row.micro += micro;
      rows.set(key, row);
      return true;
    },
    async refund(key, micro) {
      const row = rows.get(key);
      if (row && micro > 0) row.micro = Math.max(0, row.micro - micro);
    },
    async cleanup(keepFromDay, batch) {
      let n = 0;
      for (const [key, row] of rows) {
        if (n >= batch) break;
        if (row.day < keepFromDay) {
          rows.delete(key);
          n++;
        }
      }
    },
  };
}
