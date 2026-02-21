import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

export interface Task {
  id: string;
  title: string;
  context: string | null;
  source: 'slack' | 'gmail';
  source_ref: string | null;
  project: 'nexo' | 'mindhub' | 'personal';
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'done' | 'snoozed';
  snooze_until: string | null;
  created_at: string;
  updated_at: string;
}

export const db: DatabaseType = new Database(path.join(process.cwd(), 'tasks.db'));

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      context TEXT,
      source TEXT CHECK(source IN ('slack','gmail')),
      source_ref TEXT,
      project TEXT CHECK(project IN ('nexo','mindhub','personal')),
      priority TEXT CHECK(priority IN ('high','medium','low')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open','done','snoozed')),
      snooze_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
