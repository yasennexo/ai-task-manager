import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { runMigrations } from './db/schema';
import { insertTask, updateStatus, updateTask, getOpenTasks, reopenSnoozedDueTasks, taskExistsByTitle, getTasksByStatus, getExactDupes, getDoneTasks } from './db/helpers';

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
    if (args[0] === 'done') {
      const doneTasks = getDoneTasks();
      console.log(`\n=== Done Tasks (${doneTasks.length}) ===\n`);
      for (const t of doneTasks) {
        console.log(`  ✓ ${t.id.slice(0, 8)} · ${t.title}`);
        if (t.context) console.log(`           ${t.context}`);
      }
      console.log();
    } else {
      showTasks();
    }
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

  case 'update': {
    if (!args[0] || !args[1]) { console.error('Usage: cli update <task-id> <json>'); process.exit(1); }
    const fields = JSON.parse(args[1]);
    const updateCount = updateTask(args[0], fields);
    if (updateCount === 0) { console.error(`✗ No task found with ID starting with: ${args[0]}`); process.exit(1); }
    console.log(`✓ Task ${args[0]} updated`);
    break;
  }

  case 'dupes': {
    const exact = getExactDupes();
    if (exact.length > 0) {
      console.log('\n⚠️  Exact duplicates (open task already exists as done):\n');
      for (const d of exact) {
        console.log(`  OPEN  ${d.open_id.slice(0, 8)} · ${d.title}`);
        console.log(`  DONE  ${d.done_id.slice(0, 8)} · ${d.title}\n`);
      }
    } else {
      console.log('\n✓ No exact duplicates found\n');
    }

    const open = getTasksByStatus('open');
    const done = getTasksByStatus('done');

    console.log(`=== OPEN (${open.length}) ===\n`);
    for (const t of open) console.log(`  ${t.id.slice(0, 8)} · ${t.title}`);

    console.log(`\n=== DONE (${done.length}) ===\n`);
    for (const t of done) console.log(`  ${t.id.slice(0, 8)} · ${t.title}`);
    break;
  }

  case 'exists': {
    if (!args[0]) { console.error('Usage: cli exists <title>'); process.exit(1); }
    const exists = taskExistsByTitle(args[0]);
    console.log(exists ? 'true' : 'false');
    process.exit(exists ? 0 : 1);
  }

  case 'channels': {
    showChannels();
    break;
  }

  default: {
    console.log('Commands: init | show [done] | insert <json> | done <id> | snooze <id> <date> | reopen <id> | update <id> <json> | exists <title> | dupes | channels');
  }
}
