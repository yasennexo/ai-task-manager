import { db, Task } from './schema';
import { nanoid } from 'nanoid';

export type InsertTaskInput = {
  id?: string;
  title: string;
  context?: string | null;
  source: 'slack' | 'gmail';
  source_ref?: string | null;
  project: 'nexo' | 'mindhub' | 'personal';
  priority: 'high' | 'medium' | 'low';
  status?: 'open' | 'done' | 'snoozed';
  snooze_until?: string | null;
};

export function insertTask(task: InsertTaskInput): void {
  const id = task.id ?? nanoid();
  db.prepare(`
    INSERT OR IGNORE INTO tasks (id, title, context, source, source_ref, project, priority, status, snooze_until)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    task.title,
    task.context ?? null,
    task.source,
    task.source_ref ?? null,
    task.project,
    task.priority,
    task.status ?? 'open',
    task.snooze_until ?? null,
  );
}

export function updateStatus(id: string, status: 'open' | 'done' | 'snoozed', snoozeUntil?: string): void {
  db.prepare(`
    UPDATE tasks SET status = ?, snooze_until = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, snoozeUntil ?? null, id);
}

export function reopenSnoozedDueTasks(): number {
  const result = db.prepare(`
    UPDATE tasks SET status = 'open', snooze_until = NULL, updated_at = datetime('now')
    WHERE status = 'snoozed' AND snooze_until <= date('now')
  `).run();
  return result.changes;
}

export function getOpenTasks(project?: 'nexo' | 'mindhub' | 'personal'): Task[] {
  if (project) {
    return db.prepare(`
      SELECT * FROM tasks WHERE status = 'open' AND project = ?
      ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END
    `).all(project) as Task[];
  }
  return db.prepare(`
    SELECT * FROM tasks WHERE status = 'open'
    ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END
  `).all() as Task[];
}
