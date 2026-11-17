import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { ensureDataDirs, paths } from './config.js'

ensureDataDirs()

export const db = new Database(paths.db)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    site_url TEXT NOT NULL,
    public_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS criteria (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    criterion_id TEXT NOT NULL,
    criterion_text TEXT NOT NULL,
    position INTEGER NOT NULL,
    status TEXT NOT NULL,
    one_liner TEXT,
    summary TEXT,
    reason TEXT,
    duration_s REAL,
    steps_json TEXT NOT NULL DEFAULT '[]',
    screenshot_path TEXT,
    evidence_path TEXT,
    log_path TEXT,
    test_url TEXT,
    error_message TEXT,
    kane_exit_code INTEGER,
    credits REAL,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS signoffs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_criteria_project ON criteria(project_id, position);
  CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id, position);
  CREATE INDEX IF NOT EXISTS idx_signoffs_project ON signoffs(project_id);
`)

export const nowIso = () => new Date().toISOString()

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
}

export function newToken() {
  return crypto.randomBytes(18).toString('base64url')
}
