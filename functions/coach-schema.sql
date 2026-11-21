-- D1 schema for the AI coach counters (spec REQ-C12). Same text as SCHEMA_SQL in
-- src/engine/coach/counters.ts (a test keeps them equal). Apply once:
--   npx wrangler d1 execute language-lab-coach --remote --file=functions/coach-schema.sql
CREATE TABLE IF NOT EXISTS coach_counters (
  key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  micro_usd INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS coach_counters_day ON coach_counters(day);
