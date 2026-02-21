import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { runMigrations } from './db/schema';
import { insertTask, updateStatus, getOpenTasks, reopenSnoozedDueTasks } from './db/helpers';

function showChannels(): void {
  const file = path.join(process.cwd(), 'slack.json');
  if (!fs.existsSync(file)) { console.error('slack.json not found'); process.exit(1); }
  const { channels: { private: priv, public: pub }, dms } = JSON.parse(fs.readFileSync(file, 'utf8'));

  console.log(`\n=== Private Channels (${priv.length}) ===\n`);
  for (const c of priv) console.log(`  🔒 #${c.name.padEnd(45)} ${c.id}`);

  console.log(`\n=== Public Channels (${pub.length}) ===\n`);
  for (const c of pub) console.log(`  🌐 #${c.name.padEnd(45)} ${c.id}`);

  if (dms?.length) {
    console.log(`\n=== DMs (${dms.length}) ===\n`);
    for (const d of dms) console.log(`  💬 ${d.name.padEnd(45)} ${d.id}`);
  }

  console.log(`\nTotal: ${priv.length + pub.length} channels, ${dms?.length ?? 0} DMs`);
}

const PRIORITY_LABEL: Record<string, string> = { high: '[HIGH]', medium: '[MED] ', low: '[LOW] ' };
const PROJECT_EMOJI: Record<string, string> = { nexo: '🔵', mindhub: '🟣', personal: '🟢' };
const PROJECT_LABEL: Record<string, string> = { nexo: 'NEXO', mindhub: 'MINDHUB', personal: 'PERSONAL' };

function showTasks(): void {
  const reopened = reopenSnoozedDueTasks();
  if (reopened > 0) console.log(`⏰ ${reopened} snoozed task(s) reopened\n`);

  const projects = ['nexo', 'mindhub', 'personal'] as const;
  let total = 0;

  console.log('\n=== Open Tasks ===\n');
  for (const project of projects) {
    const tasks = getOpenTasks(project);
    if (tasks.length === 0) continue;
    total += tasks.length;
    console.log(`${PROJECT_EMOJI[project]} ${PROJECT_LABEL[project]} (${tasks.length})`);
    for (const t of tasks) {
      console.log(`  ${PRIORITY_LABEL[t.priority] ?? '[???]'} ${t.id.slice(0, 8)} · ${t.title}`);
      if (t.context) console.log(`           ${t.context}`);
    }
    console.log();
  }

  console.log(`Total open: ${total}`);
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'init': {
    runMigrations();
    console.log('✓ Database initialised');
    break;
  }

  case 'show': {
    showTasks();
    break;
  }

  case 'insert': {
    if (!args[0]) { console.error('Usage: cli insert <json>'); process.exit(1); }
    const data = JSON.parse(args[0]);
    insertTask(data);
    console.log(`✓ Task inserted: ${data.title}`);
    break;
  }

  case 'done': {
    if (!args[0]) { console.error('Usage: cli done <task-id>'); process.exit(1); }
    const doneCount = updateStatus(args[0], 'done');
    if (doneCount === 0) { console.error(`✗ No task found with ID starting with: ${args[0]}`); process.exit(1); }
    console.log(`✓ Task ${args[0]} marked as done`);
    break;
  }

  case 'snooze': {
    if (!args[0] || !args[1]) { console.error('Usage: cli snooze <task-id> <YYYY-MM-DD>'); process.exit(1); }
    const snoozeCount = updateStatus(args[0], 'snoozed', args[1]);
    if (snoozeCount === 0) { console.error(`✗ No task found with ID starting with: ${args[0]}`); process.exit(1); }
    console.log(`✓ Task ${args[0]} snoozed until ${args[1]}`);
    break;
  }

  case 'reopen': {
    if (!args[0]) { console.error('Usage: cli reopen <task-id>'); process.exit(1); }
    const reopenCount = updateStatus(args[0], 'open');
    if (reopenCount === 0) { console.error(`✗ No task found with ID starting with: ${args[0]}`); process.exit(1); }
    console.log(`✓ Task ${args[0]} reopened`);
    break;
  }

  case 'channels': {
    showChannels();
    break;
  }

  default: {
    console.log('Commands: init | show | insert <json> | done <id> | snooze <id> <date> | reopen <id> | channels');
  }
}
