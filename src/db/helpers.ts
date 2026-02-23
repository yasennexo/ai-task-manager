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

export function updateStatus(id: string, status: 'open' | 'done' | 'snoozed', snoozeUntil?: string): number {
  const result = db.prepare(`
    UPDATE tasks SET status = ?, snooze_until = ?, updated_at = datetime('now') WHERE id LIKE ?
  `).run(status, snoozeUntil ?? null, `${id}%`);
  return result.changes;
}

export type UpdateTaskInput = {
  title?: string;
  context?: string;
  project?: 'nexo' | 'mindhub' | 'personal';
  priority?: 'high' | 'medium' | 'low';
};

export function updateTask(id: string, fields: UpdateTaskInput): number {
  const allowed = ['title', 'context', 'project', 'priority'] as const;
  const updates = allowed.filter(k => fields[k] !== undefined);
  if (updates.length === 0) return 0;
  const sql = `UPDATE tasks SET ${updates.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id LIKE ?`;
  const values = [...updates.map(k => fields[k]), `${id}%`];
  const result = db.prepare(sql).run(...values);
  return result.changes;
}

export function reopenSnoozedDueTasks(): number {
  const result = db.prepare(`
    UPDATE tasks SET status = 'open', snooze_until = NULL, updated_at = datetime('now')
    WHERE status = 'snoozed' AND snooze_until <= date('now')
  `).run();
  return result.changes;
}

export function taskExistsByTitle(title: string): boolean {
  const row = db.prepare(`
    SELECT 1 FROM tasks WHERE LOWER(title) = LOWER(?) LIMIT 1
  `).get(title);
  return !!row;
}

export type TaskSummary = { id: string; title: string; status: string };

export function getTasksByStatus(status: 'open' | 'done' | 'snoozed'): TaskSummary[] {
  return db.prepare(`
    SELECT id, title, status FROM tasks WHERE status = ? ORDER BY LOWER(title)
  `).all(status) as TaskSummary[];
}

export type ExactDupe = { open_id: string; done_id: string; title: string };

export function getExactDupes(): ExactDupe[] {
  return db.prepare(`
    SELECT o.id as open_id, d.id as done_id, o.title
    FROM tasks o
    JOIN tasks d ON LOWER(o.title) = LOWER(d.title) AND o.id != d.id
    WHERE o.status = 'open' AND d.status = 'done'
  `).all() as ExactDupe[];
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
